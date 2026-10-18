import { spawn } from "node-pty";
import { pathToFileURL } from "node:url";

import { buildChildLaunch } from "./launch/command.js";
import type { ChildLaunch, Provider } from "./launch/command.js";
import { createSidecarView } from "./dashboard/sidecar-view.js";
import { computeSingleSessionLayout, type SingleSessionLayout } from "./layout/single-session-layout.js";
import { createProviderUsageAdapter } from "./providers/usage-adapter.js";
import type { Disposable, PtyFactory, SessionExit, TerminalSize } from "./session/contracts.js";
import { PtySession } from "./session/pty-session.js";
import { resolvePtyExecutable } from "./session/resolve-executable.js";
import { OuterRenderer } from "./terminal/outer-renderer.js";
import { ScreenModel, type ScreenSnapshot } from "./terminal/screen-model.js";
import { SidecarRenderer } from "./terminal/sidecar-renderer.js";
import { validateTerminalSize } from "./terminal/size.js";
import { ProcessTerminal, type InputCapableTerminal, type ResizableTerminal } from "./terminal/terminal-state.js";

export interface ParentTerminal {
  enter(): Promise<void>;
  render(frame: string): Promise<void>;
  restore(): Promise<void>;
}

export interface CliSession {
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (exit: SessionExit) => void): Disposable;
  write(data: string): void;
  resize(size: TerminalSize): void;
  close(): Promise<SessionExit>;
}

export interface ScreenOutputModel {
  write(data: string): Promise<void>;
  resize(size: TerminalSize): void;
  snapshot(): ScreenSnapshot;
  dispose?(): void;
}

export interface CliDependencies {
  cwd: string;
  env: NodeJS.ProcessEnv;
  size: TerminalSize;
  terminal: ParentTerminal;
  createSession(launch: ChildLaunch, size: TerminalSize): CliSession;
  createScreenModel(size: TerminalSize): ScreenOutputModel;
  createLayout?(outerSize: TerminalSize): SingleSessionLayout;
  renderSnapshot(snapshot: ScreenSnapshot, layout: SingleSessionLayout, provider: Provider): string;
  renderFallbackSnapshot?(snapshot: ScreenSnapshot): string;
}

export async function runCli(argv: readonly string[], dependencies: CliDependencies): Promise<number> {
  const [provider, ...passthrough] = argv;
  if (provider !== "codex" && provider !== "claude") {
    throw new Error("Usage: tgx <codex|claude> [provider arguments]");
  }
  const selectedProvider: Provider = provider;

  const size = validateTerminalSize(dependencies.size);
  let layout = resolveLayout(size, dependencies);
  const launch = buildChildLaunch(selectedProvider, passthrough, dependencies.cwd, dependencies.env);
  let entered = false;
  let session: CliSession | undefined;
  let screen: ScreenOutputModel | undefined;
  let outputSubscription: Disposable | undefined;
  let exitSubscription: Disposable | undefined;
  let inputSubscription: Disposable | undefined;
  let resizeSubscription: Disposable | undefined;
  let pendingRender = Promise.resolve();

  try {
    await dependencies.terminal.enter();
    entered = true;
    screen = dependencies.createScreenModel(layout.terminal);
    session = dependencies.createSession(launch, layout.terminal);

    outputSubscription = session.onData((data) => {
      pendingRender = pendingRender.then(async () => {
        await screen?.write(data);
        await renderCurrentSnapshot();
      });
    });

    const inputTerminal = dependencies.terminal as ParentTerminal & Partial<InputCapableTerminal>;
    if (inputTerminal.onInput !== undefined) {
      inputSubscription = inputTerminal.onInput((data) => session?.write(data));
    }

    const resizeTerminal = dependencies.terminal as ParentTerminal & Partial<ResizableTerminal>;
    if (resizeTerminal.onResize !== undefined) {
      resizeSubscription = resizeTerminal.onResize((nextSize) => {
        try {
          const validatedSize = validateTerminalSize(nextSize);
          const nextLayout = resolveLayout(validatedSize, dependencies);
          screen?.resize(nextLayout.terminal);
          session?.resize(nextLayout.terminal);
          layout = nextLayout;
          pendingRender = pendingRender.then(renderCurrentSnapshot);
        } catch {
          // Ignore invalid parent-terminal dimensions instead of ending the child session.
        }
      });
    }

    const exit = await waitForExit(session);
    await pendingRender;
    return exit.exitCode;
  } finally {
    resizeSubscription?.dispose();
    inputSubscription?.dispose();
    outputSubscription?.dispose();
    exitSubscription?.dispose();
    if (session !== undefined) {
      await session.close();
    }
    screen?.dispose?.();
    if (entered) {
      await dependencies.terminal.restore();
    }
  }

  function waitForExit(activeSession: CliSession): Promise<SessionExit> {
    return new Promise<SessionExit>((resolve) => {
      exitSubscription = activeSession.onExit(resolve);
    });
  }

  async function renderCurrentSnapshot(): Promise<void> {
    if (screen === undefined) {
      return;
    }

    const snapshot = screen.snapshot();
    let frame: string;
    try {
      frame = dependencies.renderSnapshot(snapshot, layout, selectedProvider);
    } catch {
      frame = dependencies.renderFallbackSnapshot?.(snapshot) ?? "";
    }
    await dependencies.terminal.render(frame);
  }
}

export function createDefaultDependencies(): CliDependencies {
  const terminal = new ProcessTerminal();
  const fallbackRenderer = new OuterRenderer();
  const sidecarRenderer = new SidecarRenderer();
  const usageAdapter = createProviderUsageAdapter();
  return {
    cwd: process.cwd(),
    env: process.env,
    size: terminal.size,
    terminal,
    createSession: (launch, size) => new PtySession(launch, size, nodePtyFactory),
    createScreenModel: (size) => new ScreenModel(size),
    createLayout: computeSingleSessionLayout,
    renderSnapshot: (snapshot, layout, provider) => {
      try {
        const dashboardLines = layout.dashboard === undefined
          ? []
          : createSidecarView(usageAdapter.getUsageState(provider), layout.dashboard.columns, layout.terminal.rows);
        return sidecarRenderer.render(snapshot, layout, dashboardLines);
      } catch {
        sidecarRenderer.reset();
        return fallbackRenderer.render(snapshot);
      }
    },
    renderFallbackSnapshot: (snapshot) => fallbackRenderer.render(snapshot)
  };
}

function resolveLayout(outerSize: TerminalSize, dependencies: CliDependencies): SingleSessionLayout {
  const layout = dependencies.createLayout?.(outerSize) ?? {
    terminal: outerSize,
    dashboard: undefined,
  };

  validateTerminalSize(layout.terminal);
  return layout;
}

export function runDefaultCli(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  return runCli(argv, createDefaultDependencies());
}

const nodePtyFactory: PtyFactory = (launch, size) =>
  spawn(resolvePtyExecutable(launch.file, launch.env), [...launch.args], {
    cwd: launch.cwd,
    env: launch.env,
    cols: size.columns,
    rows: size.rows,
    name: "xterm-256color"
  });

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runDefaultCli().then(
    (exitCode) => {
      // node-pty's Windows ConPTY worker can remain referenced after a child
      // has exited naturally. The session and terminal have already completed
      // their ordered cleanup at this point, so terminate the one-shot CLI.
      process.exit(exitCode);
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "TGX terminal could not start";
      process.stderr.write(`${message}\n`);
      process.exit(1);
    }
  );
}
