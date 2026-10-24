import { describe, expect, it } from "vitest";

import type { ChildLaunch } from "../../src/launch/command.js";
import {
  MultiSessionManager,
  type ManagedScreen,
  type ManagedSessionPort
} from "../../src/session/multi-session-manager.js";
import type { Disposable, SessionExit, TerminalSize } from "../../src/session/contracts.js";
import type { ScreenSnapshot } from "../../src/terminal/screen-model.js";

describe("MultiSessionManager", () => {
  it("routes unchanged Korean multiline input only to the selected session", async () => {
    const first = new FakeSession();
    const second = new FakeSession();
    const manager = createManager([first, second]);

    const firstId = await manager.create(launch("first"));
    const secondId = await manager.create(launch("second"));

    expect(manager.selectedSessionId).toBe(firstId);
    manager.writeSelected("한글 입력\nsecond line");
    manager.select(secondId);
    manager.writeSelected("다른 세션");

    expect(first.writes).toEqual(["한글 입력\nsecond line"]);
    expect(second.writes).toEqual(["다른 세션"]);
  });

  it("keeps concurrent output in the producing session screen", async () => {
    const first = new FakeSession();
    const second = new FakeSession();
    const manager = createManager([first, second]);

    const firstId = await manager.create(launch("first"));
    const secondId = await manager.create(launch("second"));
    first.emitData("FIRST");
    second.emitData("SECOND");
    await manager.flush();

    expect(manager.get(firstId)?.snapshot.lines).toEqual(["FIRST"]);
    expect(manager.get(secondId)?.snapshot.lines).toEqual(["SECOND"]);
  });

  it("rejects selection of an unknown session and input without a selected session", () => {
    const manager = createManager([]);

    expect(() => manager.select("session-404")).toThrow("Unknown session: session-404");
    expect(() => manager.writeSelected("input")).toThrow("No session is selected");
  });

  it("bounds retained tabs and resizes only running sessions", async () => {
    const first = new FakeSession();
    const second = new FakeSession();
    const screens: FakeScreen[] = [];
    const manager = createManager([first, second], screens);

    await manager.create(launch("first"));
    await manager.create(launch("second"));
    await expect(manager.create(launch("third"))).rejects.toThrow("Maximum session count reached: 2");

    first.emitExit({ exitCode: 0 });
    manager.resize({ columns: 120, rows: 40 });

    expect(first.resizes).toEqual([]);
    expect(second.resizes).toEqual([{ columns: 120, rows: 40 }]);
    expect(screens[0]?.resizes).toEqual([]);
    expect(screens[1]?.resizes).toEqual([{ columns: 120, rows: 40 }]);
  });

  it("keeps a selected running session selected when another session exits", async () => {
    const first = new FakeSession();
    const second = new FakeSession();
    const manager = createManager([first, second]);

    const firstId = await manager.create(launch("first"));
    const secondId = await manager.create(launch("second"));
    manager.select(secondId);
    first.emitExit({ exitCode: 7 });

    expect(manager.selectedSessionId).toBe(secondId);
    expect(manager.get(firstId)?.status).toBe("exited");
    expect(manager.get(firstId)?.exit).toEqual({ exitCode: 7 });
  });

  it("isolates a screen write failure without stopping another session", async () => {
    const first = new FakeSession();
    const second = new FakeSession();
    const failedScreen = new FakeScreen(new Error("screen unavailable"));
    const healthyScreen = new FakeScreen();
    const manager = createManager([first, second], [failedScreen, healthyScreen]);

    const firstId = await manager.create(launch("first"));
    const secondId = await manager.create(launch("second"));
    first.emitData("lost");
    second.emitData("visible");
    await manager.flush();

    expect(manager.get(firstId)?.status).toBe("error");
    expect(manager.get(secondId)?.status).toBe("running");
    expect(manager.get(secondId)?.snapshot.lines).toEqual(["visible"]);
  });

  it("closes every session and screen even when one close rejects", async () => {
    const first = new FakeSession(new Error("close failed"));
    const second = new FakeSession();
    const screens: FakeScreen[] = [];
    const manager = createManager([first, second], screens);

    await manager.create(launch("first"));
    await manager.create(launch("second"));

    await expect(manager.closeAll()).rejects.toThrow("close failed");

    expect(first.closeCalls).toBe(1);
    expect(second.closeCalls).toBe(1);
    expect(screens.map((screen) => screen.disposeCalls)).toEqual([1, 1]);
    expect(manager.sessions()).toEqual([]);
  });

  it("retains output received before a natural exit", async () => {
    const session = new FakeSession();
    const manager = createManager([session]);
    const id = await manager.create(launch("first"));

    session.emitData("final output");
    session.emitExit({ exitCode: 0 });
    await manager.flush();

    expect(manager.get(id)).toMatchObject({ status: "exited", exit: { exitCode: 0 } });
    expect(manager.get(id)?.snapshot.lines).toEqual(["final output"]);
  });

  it("closes an allocated PTY when screen creation fails", async () => {
    const session = new FakeSession();
    const manager = new MultiSessionManager({
      size: { columns: 80, rows: 24 },
      maximumSessions: 1,
      maximumQueuedOutputBytes: 1_024,
      createSession: () => session,
      createScreenModel: () => {
        throw new Error("screen unavailable");
      }
    });

    await expect(manager.create(launch("first"))).rejects.toThrow("screen unavailable");
    expect(session.closeCalls).toBe(1);
  });

  it("drains queued output before disposing a closed screen", async () => {
    const session = new FakeSession();
    const screen = new ControlledScreen();
    const manager = createManager([session], [screen]);
    const id = await manager.create(launch("first"));

    session.emitData("first");
    session.emitData("second");
    const close = manager.close(id);
    await waitFor(() => screen.pendingWrites === 1);
    expect(screen.disposeCalls).toBe(0);

    screen.releaseNext();
    await waitFor(() => screen.pendingWrites === 1);
    screen.releaseNext();
    await close;

    expect(screen.writesAfterDispose).toBe(false);
    expect(screen.disposeCalls).toBe(1);
  });

  it("bounds queued output for a slow screen without affecting another session", async () => {
    const first = new FakeSession();
    const second = new FakeSession();
    const manager = createManager([first, second], [], 4);
    const firstId = await manager.create(launch("first"));
    const secondId = await manager.create(launch("second"));

    first.emitData("four");
    first.emitData("overflow");
    second.emitData("safe");
    await manager.flush();

    expect(manager.get(firstId)?.status).toBe("error");
    expect(manager.get(secondId)?.snapshot.lines).toEqual(["safe"]);
  });

  it("continues resizing a later session when an earlier session resize fails", async () => {
    const failing = new FakeSession(undefined, new Error("resize failed"));
    const healthy = new FakeSession();
    const manager = createManager([failing, healthy]);

    const failingId = await manager.create(launch("failing"));
    await manager.create(launch("healthy"));
    manager.resize({ columns: 120, rows: 40 });

    expect(manager.get(failingId)?.status).toBe("error");
    expect(healthy.resizes).toEqual([{ columns: 120, rows: 40 }]);
  });

  it("notifies changes without letting a listener interrupt session work", async () => {
    const session = new FakeSession();
    const manager = createManager([session]);
    const changes: number[] = [];
    manager.onChange(() => changes.push(changes.length));
    manager.onChange(() => { throw new Error("render unavailable"); });

    const id = await manager.create(launch("first"));
    session.emitData("output");
    await manager.flush();
    manager.select(id);

    expect(changes.length).toBeGreaterThanOrEqual(3);
  });
});

function createManager(
  sessions: FakeSession[],
  suppliedScreens: FakeScreen[] = [],
  maximumQueuedOutputBytes = 1_024
): MultiSessionManager {
  let sessionIndex = 0;
  let screenIndex = 0;
  return new MultiSessionManager({
    size: { columns: 80, rows: 24 },
    maximumSessions: 2,
    maximumQueuedOutputBytes,
    createSession: () => {
      const session = sessions[sessionIndex];
      sessionIndex += 1;
      if (session === undefined) throw new Error("Unexpected session creation");
      return session;
    },
    createScreenModel: () => {
      const screen = suppliedScreens[screenIndex] ?? new FakeScreen();
      if (suppliedScreens[screenIndex] === undefined) suppliedScreens.push(screen);
      screenIndex += 1;
      return screen;
    }
  });
}

function launch(name: string): ChildLaunch {
  return { file: "fixture", args: [name], cwd: "C:/work", env: {} };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) return;
    await Promise.resolve();
  }
  throw new Error("Condition did not become true");
}

class FakeSession implements ManagedSessionPort {
  readonly writes: string[] = [];
  readonly resizes: TerminalSize[] = [];
  closeCalls = 0;
  #dataListeners = new Set<(data: string) => void>();
  #exitListeners = new Set<(exit: SessionExit) => void>();

  onData(listener: (data: string) => void): Disposable {
    this.#dataListeners.add(listener);
    return { dispose: () => this.#dataListeners.delete(listener) };
  }

  onExit(listener: (exit: SessionExit) => void): Disposable {
    this.#exitListeners.add(listener);
    return { dispose: () => this.#exitListeners.delete(listener) };
  }

  write(data: string): void {
    this.writes.push(data);
  }

  constructor(
    private readonly closeError: Error | undefined = undefined,
    private readonly resizeError: Error | undefined = undefined
  ) {}

  resize(size: TerminalSize): void {
    if (this.resizeError !== undefined) throw this.resizeError;
    this.resizes.push(size);
  }

  close(): Promise<SessionExit> {
    this.closeCalls += 1;
    return this.closeError === undefined ? Promise.resolve({ exitCode: 0 }) : Promise.reject(this.closeError);
  }

  emitData(data: string): void {
    for (const listener of this.#dataListeners) listener(data);
  }

  emitExit(exit: SessionExit): void {
    for (const listener of this.#exitListeners) listener(exit);
  }
}

class FakeScreen implements ManagedScreen {
  #lines: string[] = [];
  readonly resizes: TerminalSize[] = [];
  disposeCalls = 0;

  constructor(private readonly writeError: Error | undefined = undefined) {}

  write(data: string): Promise<void> {
    if (this.writeError !== undefined) return Promise.reject(this.writeError);
    this.#lines.push(data);
    return Promise.resolve();
  }

  resize(size: TerminalSize): void {
    this.resizes.push(size);
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  snapshot(): ScreenSnapshot {
    return {
      columns: 80,
      rows: 24,
      lines: [...this.#lines],
      styledLines: [],
      cursor: { x: 0, y: 0 }
    };
  }
}

class ControlledScreen extends FakeScreen {
  readonly writes: string[] = [];
  writesAfterDispose = false;
  #pending: Array<() => void> = [];
  #disposed = false;

  override write(data: string): Promise<void> {
    this.writes.push(data);
    if (this.#disposed) this.writesAfterDispose = true;
    return new Promise((resolve) => this.#pending.push(resolve));
  }

  get pendingWrites(): number {
    return this.#pending.length;
  }

  releaseNext(): void {
    this.#pending.shift()?.();
  }

  override dispose(): void {
    super.dispose();
    this.#disposed = true;
  }
}
