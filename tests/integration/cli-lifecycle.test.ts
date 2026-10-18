import { describe, expect, it, vi } from "vitest";

import type { ChildLaunch } from "../../src/launch/command.js";
import {
  runCli,
  type CliDependencies,
  type CliSession,
  type ParentTerminal,
  type ScreenOutputModel
} from "../../src/cli.js";
import type { Disposable, SessionExit, TerminalSize } from "../../src/session/contracts.js";
import { computeSingleSessionLayout } from "../../src/layout/single-session-layout.js";
import type { ScreenSnapshot } from "../../src/terminal/screen-model.js";

describe("runCli", () => {
  it("closes the child before restoring the parent terminal", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 });

    await expect(runCli(["codex"], createDependencies(events, session))).resolves.toBe(0);

    expect(events).toEqual(["terminal.enter", "session.close", "terminal.restore"]);
  });

  it("forwards the child's natural exit code", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 17 });

    await expect(runCli(["claude", "--verbose"], createDependencies(events, session))).resolves.toBe(17);
  });

  it("restores only an entered terminal when session creation fails", async () => {
    const events: string[] = [];
    const dependencies = createDependencies(events, new FakeSession(events, { exitCode: 0 }), () => {
      throw new Error("pty unavailable");
    });

    await expect(runCli(["codex"], dependencies)).rejects.toThrow("pty unavailable");
    expect(events).toEqual(["terminal.enter", "terminal.restore"]);
  });

  it("restores the terminal only once during natural-exit cleanup", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 });

    await runCli(["codex"], createDependencies(events, session));

    expect(events.filter((event) => event === "terminal.restore")).toHaveLength(1);
    expect(events.filter((event) => event === "session.close")).toHaveLength(1);
  });

  it("forwards a parent-terminal resize to the child and screen model", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 });
    const screen = new FakeScreenModel();
    const terminal = new ResizeOnSubscribeTerminal(events, { columns: 120, rows: 40 });
    const dependencies = createDependencies(events, session, undefined, terminal, screen);

    await runCli(["codex"], dependencies);

    expect(session.resizeCalls).toEqual([{ columns: 120, rows: 40 }]);
    expect(screen.resizeCalls).toEqual([{ columns: 120, rows: 40 }]);
  });

  it("uses the sidecar child size at startup and restores the full width when the parent narrows", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 }, "child output");
    const screen = new FakeScreenModel();
    const terminal = new ResizeOnSubscribeTerminal(events, { columns: 91, rows: 24 });
    const createdSessionSizes: TerminalSize[] = [];
    const createdScreenSizes: TerminalSize[] = [];
    const renderSnapshot = vi.fn(() => "frame");
    const dependencies = createDependencies(events, session, undefined, terminal, screen);
    dependencies.size = { columns: 92, rows: 24 };
    dependencies.createLayout = computeSingleSessionLayout;
    dependencies.createSession = (_launch, size) => {
      createdSessionSizes.push(size);
      return session;
    };
    dependencies.createScreenModel = (size) => {
      createdScreenSizes.push(size);
      return screen;
    };
    dependencies.renderSnapshot = renderSnapshot;

    await runCli(["codex"], dependencies);

    expect(createdSessionSizes).toEqual([{ columns: 60, rows: 24 }]);
    expect(createdScreenSizes).toEqual([{ columns: 60, rows: 24 }]);
    expect(session.resizeCalls).toEqual([{ columns: 91, rows: 24 }]);
    expect(screen.resizeCalls).toEqual([{ columns: 91, rows: 24 }]);
    expect(renderSnapshot).toHaveBeenCalledWith(expect.anything(), computeSingleSessionLayout({ columns: 91, rows: 24 }), "codex");
  });

  it("re-renders after resize even when the child produces no further output", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 });
    const terminal = new ResizeOnSubscribeTerminal(events, { columns: 91, rows: 24 });
    const dependencies = createDependencies(events, session, undefined, terminal);
    dependencies.size = { columns: 92, rows: 24 };
    dependencies.createLayout = computeSingleSessionLayout;
    dependencies.renderSnapshot = () => "resized frame";

    await runCli(["codex"], dependencies);

    expect(terminal.frames).toEqual(["resized frame"]);
  });

  it("keeps processing child output when the optional dashboard render fails", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 }, "child output");
    const terminal = new RecordingTerminal(events);
    const screen = new FakeScreenModel();
    const dependencies = createDependencies(events, session, undefined, terminal, screen);
    dependencies.renderSnapshot = () => {
      throw new Error("dashboard unavailable");
    };
    dependencies.renderFallbackSnapshot = () => "child-only frame";

    await expect(runCli(["codex"], dependencies)).resolves.toBe(0);

    expect(screen.writes).toEqual(["child output"]);
    expect(terminal.frames).toEqual(["child-only frame"]);
  });
});

function createDependencies(
  events: string[],
  session: FakeSession,
  createSession: ((launch: ChildLaunch, size: TerminalSize) => CliSession) | undefined = () => session,
  terminal: ParentTerminal = new FakeTerminal(events),
  screen: FakeScreenModel = new FakeScreenModel()
): CliDependencies {
  return {
    cwd: "C:/work",
    env: {},
    size: { columns: 80, rows: 24 },
    terminal,
    createSession: createSession ?? (() => session),
    createScreenModel: () => screen,
    renderSnapshot: () => "frame"
  };
}

class FakeTerminal implements ParentTerminal {
  constructor(private readonly events: string[]) {}

  async enter(): Promise<void> {
    this.events.push("terminal.enter");
  }

  async render(_frame: string): Promise<void> {}

  async restore(): Promise<void> {
    this.events.push("terminal.restore");
  }
}

class FakeSession implements CliSession {
  #exitListener: ((exit: SessionExit) => void) | undefined;
  readonly resizeCalls: TerminalSize[] = [];

  constructor(
    private readonly events: string[],
    private readonly exit: SessionExit,
    private readonly data: string | undefined = undefined
  ) {}

  onData(listener: (data: string) => void): Disposable {
    const data = this.data;
    if (data !== undefined) {
      queueMicrotask(() => listener(data));
    }
    return { dispose() {} };
  }

  onExit(listener: (exit: SessionExit) => void): Disposable {
    this.#exitListener = listener;
    queueMicrotask(() => this.#exitListener?.(this.exit));
    return { dispose() {} };
  }

  write(): void {}

  resize(size: TerminalSize): void {
    this.resizeCalls.push(size);
  }

  async close(): Promise<SessionExit> {
    this.events.push("session.close");
    return this.exit;
  }
}

class FakeScreenModel implements ScreenOutputModel {
  readonly resizeCalls: TerminalSize[] = [];
  readonly writes: string[] = [];

  async write(data: string): Promise<void> {
    this.writes.push(data);
  }

  resize(size: TerminalSize): void {
    this.resizeCalls.push(size);
  }

  snapshot(): ScreenSnapshot {
    return { columns: 80, rows: 24, lines: [], styledLines: [], cursor: { x: 0, y: 0 } };
  }
}

class ResizeOnSubscribeTerminal extends FakeTerminal {
  readonly frames: string[] = [];

  constructor(
    events: string[],
    private readonly resize: TerminalSize
  ) {
    super(events);
  }

  onResize(listener: (size: TerminalSize) => void): Disposable {
    listener(this.resize);
    return { dispose() {} };
  }

  override async render(frame: string): Promise<void> {
    this.frames.push(frame);
  }
}

class RecordingTerminal extends FakeTerminal {
  readonly frames: string[] = [];

  override async render(frame: string): Promise<void> {
    this.frames.push(frame);
  }
}
