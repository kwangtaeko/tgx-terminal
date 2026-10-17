import { describe, expect, it } from "vitest";

import type { ChildLaunch } from "../../src/launch/command.js";
import {
  runCli,
  type CliDependencies,
  type CliSession,
  type ParentTerminal,
  type ScreenOutputModel
} from "../../src/cli.js";
import type { Disposable, SessionExit, TerminalSize } from "../../src/session/contracts.js";
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
});

function createDependencies(
  events: string[],
  session: FakeSession,
  createSession: (launch: ChildLaunch, size: TerminalSize) => CliSession = () => session
): CliDependencies {
  return {
    cwd: "C:/work",
    env: {},
    size: { columns: 80, rows: 24 },
    terminal: new FakeTerminal(events),
    createSession,
    createScreenModel: () => new FakeScreenModel(),
    renderSnapshot: () => "frame"
  };
}

class FakeTerminal implements ParentTerminal {
  constructor(private readonly events: string[]) {}

  async enter(): Promise<void> {
    this.events.push("terminal.enter");
  }

  async render(): Promise<void> {}

  async restore(): Promise<void> {
    this.events.push("terminal.restore");
  }
}

class FakeSession implements CliSession {
  #exitListener: ((exit: SessionExit) => void) | undefined;

  constructor(
    private readonly events: string[],
    private readonly exit: SessionExit
  ) {}

  onData(): Disposable {
    return { dispose() {} };
  }

  onExit(listener: (exit: SessionExit) => void): Disposable {
    this.#exitListener = listener;
    queueMicrotask(() => this.#exitListener?.(this.exit));
    return { dispose() {} };
  }

  write(): void {}

  async close(): Promise<SessionExit> {
    this.events.push("session.close");
    return this.exit;
  }
}

class FakeScreenModel implements ScreenOutputModel {
  async write(): Promise<void> {}

  snapshot(): ScreenSnapshot {
    return { columns: 80, rows: 24, lines: [], cursor: { x: 0, y: 0 } };
  }
}
