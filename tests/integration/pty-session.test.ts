import { fileURLToPath } from "node:url";

import * as pty from "node-pty";
import { describe, expect, it } from "vitest";

import { buildChildLaunch } from "../../src/launch/command.js";
import type { Disposable, PtyFactory, PtyProcess, SessionExit } from "../../src/session/contracts.js";
import { PtySession } from "../../src/session/pty-session.js";
import { validateTerminalSize } from "../../src/terminal/size.js";

const fixturePath = fileURLToPath(new URL("../fixtures/pty-child.mjs", import.meta.url));
const rawKeyFixturePath = fileURLToPath(new URL("../fixtures/raw-key-child.mjs", import.meta.url));

class ControlledPty implements PtyProcess {
  readonly writes: string[] = [];
  readonly kills: Array<string | undefined> = [];
  readonly resizeCalls: Array<{ columns: number; rows: number }> = [];
  dataSubscriptionDisposed = false;
  exitSubscriptionDisposed = false;
  private dataListener: ((data: string) => void) | undefined;
  private exitListener: ((event: { exitCode: number; signal?: number }) => void) | undefined;

  write(data: string): void {
    this.writes.push(data);
  }

  resize(columns: number, rows: number): void {
    this.resizeCalls.push({ columns, rows });
  }

  kill(signal?: string): void {
    this.kills.push(signal);
  }

  onData(listener: (data: string) => void): Disposable {
    this.dataListener = listener;
    return {
      dispose: () => {
        this.dataSubscriptionDisposed = true;
        this.dataListener = undefined;
      }
    };
  }

  onExit(listener: (event: { exitCode: number; signal?: number }) => void): Disposable {
    this.exitListener = listener;
    return {
      dispose: () => {
        this.exitSubscriptionDisposed = true;
        this.exitListener = undefined;
      }
    };
  }

  emitData(data: string): void {
    this.dataListener?.(data);
  }

  emitExit(event: { exitCode: number; signal?: number }): void {
    this.exitListener?.(event);
  }
}

function createFixtureFactory(childPath = fixturePath): PtyFactory {
  return (launch, size) => {
    const child = pty.spawn(process.execPath, [childPath], {
      cols: size.columns,
      cwd: launch.cwd,
      env: launch.env,
      name: "xterm-256color",
      rows: size.rows
    });

    return {
      kill: (signal) => child.kill(signal),
      onData: (listener) => child.onData(listener),
      onExit: (listener) => child.onExit(listener),
      resize: (columns, rows) => child.resize(columns, rows),
      write: (data) => child.write(data)
    };
  };
}

describe("PtySession", () => {
  it("forwards fixture child input, output, and exit", async () => {
    const session = new PtySession(
      buildChildLaunch("codex", [], process.cwd(), process.env),
      { columns: 80, rows: 24 },
      createFixtureFactory()
    );
    const output: string[] = [];
    const childExit = new Promise<{ exitCode: number }>((resolve) => {
      session.onExit(resolve);
    });
    const exited = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("fixture child did not exit")), 5_000);
      session.onData((data) => {
        output.push(data);
        if (output.join("").includes("INPUT:hello\r\n")) {
          session.write("EXIT\r");
        }
        if (output.join("").includes("EXITING")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    session.write("hello\r");
    await exited;

    await expect(childExit).resolves.toEqual({ exitCode: 0 });
    await expect(session.close()).resolves.toMatchObject({ exitCode: 0 });
    expect(output.join("")).toContain("INPUT:hello");
    expect(output.join("")).toContain("EXITING");
  });

  it("observes the Windows ConPTY backspace byte received by a raw child", async () => {
    const session = new PtySession(
      buildChildLaunch("codex", [], process.cwd(), process.env),
      { columns: 80, rows: 24 },
      createFixtureFactory(rawKeyFixturePath)
    );
    const childExit = new Promise<SessionExit>((resolve) => session.onExit(resolve));
    let output = "";
    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`raw key fixture did not return a byte: ${JSON.stringify(output)}`)), 1_000);
      session.onData((data) => {
        output += data;
        if (output.includes("READY")) session.write("\b");
        if (output.includes("RX:7f")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    await received;
    await expect(childExit).resolves.toMatchObject({ exitCode: 0 });
    await expect(session.close()).resolves.toMatchObject({ exitCode: 0 });
    expect(output).toContain("RX:7f");
  });

  it("observes the Windows ConPTY DEL-to-backspace mapping in a raw child", async () => {
    const session = new PtySession(
      buildChildLaunch("codex", [], process.cwd(), process.env),
      { columns: 80, rows: 24 },
      createFixtureFactory(rawKeyFixturePath)
    );
    const childExit = new Promise<SessionExit>((resolve) => session.onExit(resolve));
    let output = "";
    const received = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`DEL fixture did not return a byte: ${JSON.stringify(output)}`)), 1_000);
      session.onData((data) => {
        output += data;
        if (output.includes("READY")) session.write("\x7f");
        if (output.includes("RX:08")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    await received;
    await expect(childExit).resolves.toMatchObject({ exitCode: 0 });
    await expect(session.close()).resolves.toMatchObject({ exitCode: 0 });
    expect(output).toContain("RX:08");
  });

  it("shares close work, removes PTY listeners, and rejects writes after exit", async () => {
    const process = new ControlledPty();
    const session = new PtySession(
      buildChildLaunch("claude", [], "C:/workspace", {}),
      { columns: 80, rows: 24 },
      () => process
    );
    const output: string[] = [];
    session.onData((data) => output.push(data));

    process.emitData("READY");
    const firstClose = session.close();
    const secondClose = session.close();
    process.emitExit({ exitCode: 0 });

    expect(secondClose).toBe(firstClose);
    await expect(firstClose).resolves.toEqual({ exitCode: 0 });
    expect(output).toEqual(["READY"]);
    expect(process.kills).toEqual([undefined]);
    expect(process.dataSubscriptionDisposed).toBe(true);
    expect(process.exitSubscriptionDisposed).toBe(true);
    expect(() => session.write("after-exit")).toThrow("not active");
  });

  it("forwards Korean multiline input and only validated resize dimensions", () => {
    const process = new ControlledPty();
    const session = new PtySession(
      buildChildLaunch("codex", [], "C:/workspace", {}),
      { columns: 80, rows: 24 },
      () => process
    );

    session.write("한글\nsecond line");
    session.resize(validateTerminalSize({ columns: 120, rows: 40 }));

    expect(process.writes).toEqual(["한글\nsecond line"]);
    expect(process.resizeCalls).toEqual([{ columns: 120, rows: 40 }]);
    expect(() => validateTerminalSize({ columns: 0, rows: 40 })).toThrow("positive safe integers");
    expect(() => validateTerminalSize({ columns: 120, rows: -1 })).toThrow("positive safe integers");
    expect(() => validateTerminalSize({ columns: 80.5, rows: 24 })).toThrow("positive safe integers");
    expect(() => validateTerminalSize({ columns: Number.POSITIVE_INFINITY, rows: 24 })).toThrow(
      "positive safe integers"
    );
    expect(() => validateTerminalSize({ columns: 32_768, rows: 24 })).toThrow("maximum");
    expect(() => session.resize({ columns: 0, rows: 24 })).toThrow("positive safe integers");
    expect(process.resizeCalls).toEqual([{ columns: 120, rows: 40 }]);
  });
});
