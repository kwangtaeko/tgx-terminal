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

  it("uses the statusline child size at startup and preserves full width when the parent narrows", async () => {
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

    expect(createdSessionSizes).toEqual([{ columns: 92, rows: 23 }]);
    expect(createdScreenSizes).toEqual([{ columns: 92, rows: 23 }]);
    expect(session.resizeCalls).toEqual([{ columns: 91, rows: 23 }]);
    expect(screen.resizeCalls).toEqual([{ columns: 91, rows: 23 }]);
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

    expect(terminal.frames.at(-1)).toContain("TTTTTT  GGGGG  XX   XX");
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
    expect(terminal.frames.at(-1)).toBe("child-only frame");
  });

  it("shows TGX branding until the first single-session child output renders", async () => {
    const events: string[] = [];
    const session = new FakeSession(events, { exitCode: 0 }, "child output");
    const terminal = new RecordingTerminal(events);
    const dependencies = createDependencies(events, session, undefined, terminal);
    dependencies.renderSnapshot = () => "child frame";

    await expect(runCli(["codex"], dependencies)).resolves.toBe(0);

    expect(terminal.frames).toEqual([
      expect.stringContaining("TTTTTT  GGGGG  XX   XX"),
      "child frame",
    ]);
  });

  it("keeps TGX branding through non-visual child control output", async () => {
    const events: string[] = [];
    const session = new ManualSession(events);
    const terminal = new RecordingTerminal(events);
    const screen = new VisibilityControlledScreen();
    const dependencies = createDependencies(events, session, undefined, terminal, screen);
    dependencies.renderSnapshot = () => "child frame";

    const running = runCli(["codex"], dependencies);
    await waitFor(() => terminal.frames.length === 1);
    session.emitData("\u001b[?2004h");
    await waitFor(() => screen.writes.length === 1);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(terminal.frames).toHaveLength(1);
    expect(terminal.frames.at(-1)).toContain("TTTTTT  GGGGG  XX   XX");

    session.emitData("visible");
    await waitFor(() => terminal.frames.at(-1) === "child frame");
    session.emitExit({ exitCode: 0 });
    await expect(running).resolves.toBe(0);
  });

  it("keeps a single-session startup indicator through resize before child output", async () => {
    const events: string[] = [];
    const session = new ManualSession(events);
    const terminal = new ManualResizeTerminal(events);
    const dependencies = createDependencies(events, session, undefined, terminal);
    dependencies.renderSnapshot = () => "child frame";

    const running = runCli(["codex"], dependencies);
    await waitFor(() => terminal.frames.length === 1);
    terminal.emitResize({ columns: 120, rows: 40 });
    await waitFor(() => terminal.frames.length === 2);
    expect(terminal.frames.at(-1)).toContain("TTTTTT  GGGGG  XX   XX");

    session.emitData("ready");
    await waitFor(() => terminal.frames.at(-1) === "child frame");
    session.emitExit({ exitCode: 0 });
    await expect(running).resolves.toBe(0);
  });

  it("queues child output emitted while the startup frame is still rendering", async () => {
    const events: string[] = [];
    const session = new ManualSession(events);
    const screen = new FakeScreenModel();
    const terminal = new DeferredStartupTerminal(events);
    const dependencies = createDependencies(events, session, undefined, terminal, screen);
    dependencies.renderSnapshot = () => "child frame";

    const running = runCli(["codex"], dependencies);
    await waitFor(() => terminal.frames.length === 1);
    session.emitData("early output");
    terminal.releaseStartupFrame();
    await waitFor(() => screen.writes.includes("early output"));
    session.emitExit({ exitCode: 0 });

    await expect(running).resolves.toBe(0);
  });

  it("creates and closes opt-in tabs without changing the default provider arguments", async () => {
    const events: string[] = [];
    const sessions = [new ControlledSession(events), new ControlledSession(events)];
    const terminal = new ScriptedInputTerminal(events, "\u0014n\u0014x\u0014x");
    const firstSession = sessions[0];
    if (firstSession === undefined) throw new Error("Missing first session");
    const dependencies = createDependencies(events, firstSession, undefined, terminal);
    dependencies.size = { columns: 92, rows: 24 };
    dependencies.createLayout = computeSingleSessionLayout;
    const renderSnapshot = vi.fn(() => "tab frame");
    dependencies.renderSnapshot = renderSnapshot;
    const createdSizes: TerminalSize[] = [];
    dependencies.createSession = (_launch, size) => {
      const session = sessions.shift();
      if (session === undefined) throw new Error("Unexpected session");
      createdSizes.push(size);
      return session;
    };

    await expect(runCli(["codex", "--tgx-tabs", "--model", "gpt test"], dependencies)).resolves.toBe(0);

    expect(events.filter((event) => event === "session.close")).toHaveLength(2);
    expect(createdSizes).toEqual([{ columns: 92, rows: 22 }, { columns: 92, rows: 22 }]);
    expect(renderSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ terminal: { columns: 92, rows: 22 }, statusLine: { columns: 92 }, tabBar: { columns: 92 } }),
      "codex",
      expect.objectContaining({ selectedSessionId: "session-1" })
    );
  });

  it("renders the retained final tab after its natural exit", async () => {
    const events: string[] = [];
    const session = new NaturallyExitingSession(events, { exitCode: 3 });
    const dependencies = createDependencies(events, session);
    const renderSnapshot = vi.fn(() => "final tab frame");
    dependencies.renderSnapshot = renderSnapshot;

    await expect(runCli(["claude", "--tgx-tabs"], dependencies)).resolves.toBe(3);

    expect(renderSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "claude",
      expect.objectContaining({
        selectedSessionId: undefined,
        showStartupBranding: false,
        sessions: [expect.objectContaining({ status: "exited", exit: { exitCode: 3 } })],
      })
    );
  });

  it("switches a tabbed startup indicator to normal tab state after first output", async () => {
    const events: string[] = [];
    const session = new ManualSession(events);
    const dependencies = createDependencies(events, session);
    const renderSnapshot = vi.fn(() => "tab frame");
    dependencies.renderSnapshot = renderSnapshot;

    const running = runCli(["codex", "--tgx-tabs"], dependencies);
    await waitFor(() => renderSnapshot.mock.calls.length > 0);
    expect(renderSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "codex",
      expect.objectContaining({ showStartupBranding: true })
    );

    session.emitData("ready");
    await waitFor(() => renderSnapshot.mock.calls.some((call) => {
      const state = (call as unknown as readonly unknown[])[3] as { showStartupBranding?: boolean } | undefined;
      return state?.showStartupBranding === false;
    }));
    session.emitExit({ exitCode: 0 });

    await expect(running).resolves.toBe(0);
  });
});

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (condition()) return;
    await Promise.resolve();
  }
  throw new Error("Condition was not met");
}

function createDependencies(
  events: string[],
  session: CliSession,
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
    const latest = this.writes.at(-1);
    return latest === undefined
      ? { columns: 80, rows: 24, lines: [], styledLines: [], cursor: { x: 0, y: 0 } }
      : {
          columns: 80,
          rows: 24,
          lines: [latest],
          styledLines: [{ segments: [{ text: latest, style: {} }] }],
          cursor: { x: latest.length, y: 0 },
        };
  }
}

class VisibilityControlledScreen extends FakeScreenModel {
  override snapshot(): ScreenSnapshot {
    const visible = this.writes.includes("visible");
    return visible
      ? {
          columns: 80,
          rows: 24,
          lines: ["visible"],
          styledLines: [{ segments: [{ text: "visible", style: {} }] }],
          cursor: { x: 7, y: 0 },
        }
      : { columns: 80, rows: 24, lines: [], styledLines: [], cursor: { x: 0, y: 0 } };
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

class ManualResizeTerminal extends RecordingTerminal {
  #resizeListener: ((size: TerminalSize) => void) | undefined;

  onResize(listener: (size: TerminalSize) => void): Disposable {
    this.#resizeListener = listener;
    return { dispose: () => { this.#resizeListener = undefined; } };
  }

  emitResize(size: TerminalSize): void {
    this.#resizeListener?.(size);
  }
}

class DeferredStartupTerminal extends RecordingTerminal {
  #release: (() => void) | undefined;

  override render(frame: string): Promise<void> {
    this.frames.push(frame);
    if (this.frames.length !== 1) return Promise.resolve();
    return new Promise((resolve) => { this.#release = resolve; });
  }

  releaseStartupFrame(): void {
    this.#release?.();
    this.#release = undefined;
  }
}

class ScriptedInputTerminal extends FakeTerminal {
  constructor(events: string[], private readonly script: string) {
    super(events);
  }

  onInput(listener: (data: string) => void): Disposable {
    queueMicrotask(() => listener(this.script));
    return { dispose() {} };
  }
}

class ControlledSession implements CliSession {
  constructor(private readonly events: string[]) {}

  onData(_listener: (data: string) => void): Disposable { return { dispose() {} }; }
  onExit(_listener: (exit: SessionExit) => void): Disposable { return { dispose() {} }; }
  write(_data: string): void {}
  resize(_size: TerminalSize): void {}
  async close(): Promise<SessionExit> {
    this.events.push("session.close");
    return { exitCode: 0 };
  }
}

class NaturallyExitingSession extends ControlledSession {
  constructor(events: string[], private readonly naturalExit: SessionExit) {
    super(events);
  }

  override onExit(listener: (exit: SessionExit) => void): Disposable {
    queueMicrotask(() => listener(this.naturalExit));
    return { dispose() {} };
  }
}

class ManualSession implements CliSession {
  #dataListener: ((data: string) => void) | undefined;
  #exitListener: ((exit: SessionExit) => void) | undefined;

  constructor(private readonly events: string[]) {}

  onData(listener: (data: string) => void): Disposable {
    this.#dataListener = listener;
    return { dispose: () => { this.#dataListener = undefined; } };
  }

  onExit(listener: (exit: SessionExit) => void): Disposable {
    this.#exitListener = listener;
    return { dispose: () => { this.#exitListener = undefined; } };
  }

  write(_data: string): void {}
  resize(_size: TerminalSize): void {}

  async close(): Promise<SessionExit> {
    this.events.push("session.close");
    return { exitCode: 0 };
  }

  emitData(data: string): void { this.#dataListener?.(data); }
  emitExit(exit: SessionExit): void { this.#exitListener?.(exit); }
}
