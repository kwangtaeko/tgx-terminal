import { spawn } from "node-pty";
import { pathToFileURL } from "node:url";

import { buildChildLaunch } from "./launch/command.js";
import type { ChildLaunch, Provider } from "./launch/command.js";
import { parseTabModeArguments } from "./launch/tab-mode-arguments.js";
import { createTabControlDecoder, type TabCommand } from "./control/tab-control-decoder.js";
import { createSidecarView } from "./dashboard/sidecar-view.js";
import { createStatusLine } from "./dashboard/status-line-view.js";
import { createStartupBrandLine, renderStartupBrandFrame } from "./dashboard/startup-brand-view.js";
import { createTabStripView } from "./dashboard/tab-strip-view.js";
import { addTabBar, computeSingleSessionLayout, type SingleSessionLayout } from "./layout/single-session-layout.js";
import { createProviderUsageAdapter } from "./providers/usage-adapter.js";
import type { Disposable, PtyFactory, SessionExit, TerminalSize } from "./session/contracts.js";
import { PtySession } from "./session/pty-session.js";
import { MultiSessionManager, type ManagedSession } from "./session/multi-session-manager.js";
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

export interface TabRenderState {
  readonly sessions: readonly ManagedSession[];
  readonly selectedSessionId: string | undefined;
  readonly showStartupBranding: boolean;
}

export interface CliDependencies {
  cwd: string;
  env: NodeJS.ProcessEnv;
  size: TerminalSize;
  terminal: ParentTerminal;
  createSession(launch: ChildLaunch, size: TerminalSize): CliSession;
  createScreenModel(size: TerminalSize): ScreenOutputModel;
  createLayout?(outerSize: TerminalSize): SingleSessionLayout;
  renderSnapshot(snapshot: ScreenSnapshot, layout: SingleSessionLayout, provider: Provider, tabs?: TabRenderState): string;
  renderFallbackSnapshot?(snapshot: ScreenSnapshot): string;
}

export async function runCli(argv: readonly string[], dependencies: CliDependencies): Promise<number> {
  const [provider, ...rawArguments] = argv;
  if (provider !== "codex" && provider !== "claude") {
    throw new Error("Usage: tgx <codex|claude> [provider arguments]");
  }
  const { tabsEnabled, passthrough } = parseTabModeArguments(rawArguments);
  return tabsEnabled
    ? runTabbedCli(provider, passthrough, dependencies)
    : runSingleSessionCli(provider, passthrough, dependencies);
}

async function runSingleSessionCli(
  selectedProvider: Provider,
  passthrough: readonly string[],
  dependencies: CliDependencies
): Promise<number> {
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
  let showStartupBranding = true;

  try {
    await dependencies.terminal.enter();
    entered = true;
    screen = dependencies.createScreenModel(layout.terminal);
    session = dependencies.createSession(launch, layout.terminal);
    pendingRender = dependencies.terminal.render(
      renderStartupBrandFrame(selectedProvider, layoutWidth(layout), layout.terminal.rows)
    ).catch(() => undefined);

    outputSubscription = session.onData((data) => {
      pendingRender = pendingRender.then(async () => {
        if (screen === undefined) return;
        await screen.write(data);
        if (showStartupBranding && !hasVisibleScreenContent(screen.snapshot())) return;
        showStartupBranding = false;
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

    if (showStartupBranding) {
      await dependencies.terminal.render(
        renderStartupBrandFrame(selectedProvider, layoutWidth(layout), layout.terminal.rows)
      ).catch(() => undefined);
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

async function runTabbedCli(
  provider: Provider,
  passthrough: readonly string[],
  dependencies: CliDependencies
): Promise<number> {
  const outerSize = validateTerminalSize(dependencies.size);
  let layout = resolveTabbedLayout(outerSize, dependencies);
  const launch = buildChildLaunch(provider, passthrough, dependencies.cwd, dependencies.env);
  const manager = new MultiSessionManager({
    size: layout.terminal,
    maximumSessions: 8,
    maximumQueuedOutputBytes: 1_048_576,
    createSession: dependencies.createSession,
    createScreenModel: dependencies.createScreenModel
  });
  const decoder = createTabControlDecoder({ enabled: true });
  let entered = false;
  let inputSubscription: Disposable | undefined;
  let resizeSubscription: Disposable | undefined;
  let changeSubscription: Disposable | undefined;
  let pendingRender = Promise.resolve();
  let inputQueue = Promise.resolve();
  let lastExitCode = 0;
  let showStartupBranding = true;
  let resolveComplete: (() => void) | undefined;
  const complete = new Promise<void>((resolve) => { resolveComplete = resolve; });

  const renderCurrent = async (): Promise<void> => {
    const selectedId = manager.selectedSessionId;
    const sessions = manager.sessions();
    const firstSession = sessions[0];
    if (showStartupBranding && (firstSession?.hasReceivedOutput === true || firstSession?.status !== "running")) {
      showStartupBranding = false;
    }
    const selected = selectedId === undefined
      ? sessions.at(-1)
      : sessions.find((session) => session.id === selectedId);
    if (selected === undefined) return;
    try {
      await dependencies.terminal.render(dependencies.renderSnapshot(selected.snapshot, layout, provider, {
        sessions,
        selectedSessionId: selectedId,
        showStartupBranding,
      }));
    } catch {
      await dependencies.terminal.render(dependencies.renderFallbackSnapshot?.(selected.snapshot) ?? "");
    }
  };
  const queueRender = (): void => {
    pendingRender = pendingRender.then(renderCurrent).catch(() => undefined);
  };
  const observeCompletion = (): void => {
    const sessions = manager.sessions();
    const exited = sessions.filter((session) => session.exit !== undefined).at(-1);
    if (exited?.exit !== undefined) lastExitCode = exited.exit.exitCode;
    if (sessions.every((session) => session.status !== "running")) resolveComplete?.();
  };

  try {
    await dependencies.terminal.enter();
    entered = true;
    changeSubscription = manager.onChange(() => {
      queueRender();
      observeCompletion();
    });
    await manager.create(launch);
    queueRender();

    const inputTerminal = dependencies.terminal as ParentTerminal & Partial<InputCapableTerminal>;
    if (inputTerminal.onInput !== undefined) {
      inputSubscription = inputTerminal.onInput((data) => {
        inputQueue = inputQueue.then(async () => {
          for (const action of decoder.push(data)) {
            if (action.kind === "forward") {
              manager.writeSelected(action.data);
            } else {
              await runTabCommand(action.command);
            }
          }
        }).catch(() => undefined);
      });
    }
    const resizeTerminal = dependencies.terminal as ParentTerminal & Partial<ResizableTerminal>;
    if (resizeTerminal.onResize !== undefined) {
      resizeSubscription = resizeTerminal.onResize((nextSize) => {
        try {
          layout = resolveTabbedLayout(validateTerminalSize(nextSize), dependencies);
          manager.resize(layout.terminal);
          queueRender();
        } catch { /* Invalid dimensions do not end active tabs. */ }
      });
    }
    await complete;
    await inputQueue;
    await manager.flush();
    await pendingRender;
    return lastExitCode;
  } finally {
    resizeSubscription?.dispose();
    inputSubscription?.dispose();
    changeSubscription?.dispose();
    await manager.closeAll().catch(() => undefined);
    if (entered) await dependencies.terminal.restore();
  }

  async function runTabCommand(command: TabCommand): Promise<void> {
    const running = manager.sessions().filter((session) => session.status === "running");
    if (command === "new-session") {
      const id = await manager.create(launch);
      manager.select(id);
      return;
    }
    const selectedIndex = running.findIndex((session) => session.id === manager.selectedSessionId);
    if (command === "next-session" || command === "previous-session") {
      if (running.length === 0) return;
      const offset = command === "next-session" ? 1 : -1;
      const next = running[(selectedIndex + offset + running.length) % running.length];
      if (next !== undefined) manager.select(next.id);
      return;
    }
    const selected = manager.selectedSessionId;
    if (selected !== undefined) {
      const exit = await manager.close(selected);
      if (exit !== undefined) lastExitCode = exit.exitCode;
      if (manager.sessions().every((session) => session.status !== "running")) resolveComplete?.();
    }
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
    renderSnapshot: (snapshot, layout, provider, tabs) => {
      try {
        const dashboardLines = layout.dashboard === undefined
          ? []
          : createSidecarView(usageAdapter.getUsageState(provider), layout.dashboard.columns, layout.terminal.rows);
        const tabBarLine = layout.tabBar === undefined || tabs === undefined
          ? undefined
          : tabs.showStartupBranding
            ? createStartupBrandLine(provider, layout.tabBar.columns)
            : createTabStripView(tabs.sessions, tabs.selectedSessionId, provider, layout.tabBar.columns);
        const selectedSession = tabs?.selectedSessionId === undefined
          ? undefined
          : tabs.sessions.find((session) => session.id === tabs.selectedSessionId);
        const statusLine = layout.statusLine === undefined
          ? undefined
          : createStatusLine(
              usageAdapter.getUsageState(provider),
              selectedSession?.status === "exited" ? "exited" : "running",
              layout.statusLine.columns
            );
        return sidecarRenderer.render(snapshot, layout, dashboardLines, tabBarLine, statusLine);
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

function resolveTabbedLayout(outerSize: TerminalSize, dependencies: CliDependencies): SingleSessionLayout {
  return addTabBar(resolveLayout(outerSize, dependencies), outerSize);
}

function layoutWidth(layout: SingleSessionLayout): number {
  return layout.dashboard === undefined
    ? layout.terminal.columns
    : layout.dashboard.startColumn + layout.dashboard.columns - 1;
}

function hasVisibleScreenContent(snapshot: ScreenSnapshot): boolean {
  return snapshot.lines.some((line) => line.trim() !== "");
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
