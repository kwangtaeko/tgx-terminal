import type { ChildLaunch } from "../launch/command.js";
import type { ScreenSnapshot } from "../terminal/screen-model.js";
import { validateTerminalSize } from "../terminal/size.js";

import type { Disposable, SessionExit, TerminalSize } from "./contracts.js";

export type ManagedSessionStatus = "running" | "closing" | "exited" | "error";

export interface ManagedSessionPort {
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (exit: SessionExit) => void): Disposable;
  write(data: string): void;
  resize(size: TerminalSize): void;
  close(): Promise<SessionExit>;
}

export interface ManagedScreen {
  write(data: string): Promise<void>;
  resize(size: TerminalSize): void;
  snapshot(): ScreenSnapshot;
  dispose?(): void;
}

export interface ManagedSession {
  readonly id: string;
  readonly status: ManagedSessionStatus;
  /** True only after non-empty child output has been applied to this VT screen. */
  readonly hasReceivedOutput: boolean;
  readonly snapshot: ScreenSnapshot;
  readonly exit?: SessionExit;
}

export interface MultiSessionDependencies {
  readonly size: TerminalSize;
  readonly maximumSessions: number;
  readonly maximumQueuedOutputBytes: number;
  createSession(launch: ChildLaunch, size: TerminalSize): ManagedSessionPort;
  createScreenModel(size: TerminalSize): ManagedScreen;
}

interface SessionRecord {
  readonly id: string;
  readonly port: ManagedSessionPort;
  readonly screen: ManagedScreen;
  dataSubscription: Disposable | undefined;
  exitSubscription: Disposable | undefined;
  status: ManagedSessionStatus;
  exit: SessionExit | undefined;
  outputChain: Promise<void>;
  pendingOutputBytes: number;
  pendingOutputChunks: number;
  hasReceivedOutput: boolean;
  acceptsOutput: boolean;
  released: boolean;
  closePromise: Promise<SessionExit | undefined> | undefined;
}

const MAX_QUEUED_OUTPUT_CHUNKS = 512;

/** Owns isolated PTY and VT-screen pairs without deciding any terminal key bindings. */
export class MultiSessionManager {
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #changeListeners = new Set<() => void>();
  readonly #maximumSessions: number;
  readonly #maximumQueuedOutputBytes: number;
  readonly #createSession: MultiSessionDependencies["createSession"];
  readonly #createScreenModel: MultiSessionDependencies["createScreenModel"];
  #size: TerminalSize;
  #nextId = 1;
  #selectedSessionId: string | undefined;

  constructor(dependencies: MultiSessionDependencies) {
    if (!Number.isInteger(dependencies.maximumSessions) || dependencies.maximumSessions < 1) {
      throw new Error("maximumSessions must be a positive integer");
    }
    if (!Number.isInteger(dependencies.maximumQueuedOutputBytes) || dependencies.maximumQueuedOutputBytes < 1) {
      throw new Error("maximumQueuedOutputBytes must be a positive integer");
    }

    this.#size = validateTerminalSize(dependencies.size);
    this.#maximumSessions = dependencies.maximumSessions;
    this.#maximumQueuedOutputBytes = dependencies.maximumQueuedOutputBytes;
    this.#createSession = dependencies.createSession;
    this.#createScreenModel = dependencies.createScreenModel;
  }

  get selectedSessionId(): string | undefined {
    return this.#selectedSessionId;
  }

  onChange(listener: () => void): Disposable {
    this.#changeListeners.add(listener);
    return { dispose: () => this.#changeListeners.delete(listener) };
  }

  async create(launch: ChildLaunch): Promise<string> {
    if (this.#sessions.size >= this.#maximumSessions) {
      throw new Error(`Maximum session count reached: ${this.#maximumSessions}`);
    }

    const id = `session-${this.#nextId}`;
    const port = this.#createSession(launch, this.#size);
    let screen: ManagedScreen | undefined;
    let record: SessionRecord | undefined;
    try {
      screen = this.#createScreenModel(this.#size);
      record = {
        id,
        port,
        screen,
        dataSubscription: undefined,
        exitSubscription: undefined,
        status: "running",
        exit: undefined,
        outputChain: Promise.resolve(),
        pendingOutputBytes: 0,
        pendingOutputChunks: 0,
        hasReceivedOutput: false,
        acceptsOutput: true,
        released: false,
        closePromise: undefined
      };
      this.#sessions.set(id, record);
      const initializedRecord = record;
      record.dataSubscription = port.onData((data) => this.#handleData(initializedRecord, data));
      if (record.released) record.dataSubscription.dispose();
      record.exitSubscription = port.onExit((exit) => this.#handleExit(initializedRecord, exit));
      if (record.released) record.exitSubscription.dispose();
      this.#nextId += 1;
      if (this.#selectedSessionId === undefined && record.status === "running") this.#selectedSessionId = id;
      this.#notifyChange();
      return id;
    } catch (error) {
      if (record !== undefined) this.#releaseSubscriptions(record);
      this.#sessions.delete(id);
      screen?.dispose?.();
      await port.close().catch(() => undefined);
      throw error;
    }
  }

  get(id: string): ManagedSession | undefined {
    const record = this.#sessions.get(id);
    return record === undefined ? undefined : this.#snapshot(record);
  }

  sessions(): readonly ManagedSession[] {
    return [...this.#sessions.values()].map((record) => this.#snapshot(record));
  }

  select(id: string): void {
    if (!this.#sessions.has(id)) throw new Error(`Unknown session: ${id}`);
    this.#selectedSessionId = id;
    this.#notifyChange();
  }

  writeSelected(data: string): void {
    if (this.#selectedSessionId === undefined) throw new Error("No session is selected");
    const record = this.#sessions.get(this.#selectedSessionId);
    if (record === undefined) throw new Error(`Unknown session: ${this.#selectedSessionId}`);
    if (record.status !== "running") throw new Error(`Selected session is not running: ${record.status}`);
    record.port.write(data);
  }

  resize(size: TerminalSize): void {
    const validatedSize = validateTerminalSize(size);
    this.#size = validatedSize;
    for (const record of this.#sessions.values()) {
      if (record.status !== "running") continue;
      try {
        record.port.resize(validatedSize);
        record.screen.resize(validatedSize);
      } catch {
        this.#markError(record);
      }
    }
    this.#notifyChange();
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#sessions.values()].map((record) => record.outputChain));
  }

  async close(id: string): Promise<SessionExit | undefined> {
    const record = this.#sessions.get(id);
    if (record === undefined) throw new Error(`Unknown session: ${id}`);
    if (record.closePromise !== undefined) return record.closePromise;

    this.#stopAcceptingOutput(record);
    if (record.status !== "exited") record.status = "closing";
    record.closePromise = this.#closeRecord(record);
    return record.closePromise;
  }

  async closeAll(): Promise<void> {
    const results = await Promise.allSettled([...this.#sessions.keys()].map((id) => this.close(id)));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }

  #handleData(record: SessionRecord, data: string): void {
    if (!record.acceptsOutput) return;
    const bytes = Buffer.byteLength(data, "utf8");
    if (
      record.pendingOutputBytes + bytes > this.#maximumQueuedOutputBytes ||
      record.pendingOutputChunks >= MAX_QUEUED_OUTPUT_CHUNKS
    ) {
      this.#markError(record);
      return;
    }

    record.pendingOutputBytes += bytes;
    record.pendingOutputChunks += 1;
    record.outputChain = record.outputChain.then(
      () => record.screen.write(data),
      () => record.screen.write(data)
    ).then(
      () => this.#settleOutput(record, bytes, bytes > 0),
      () => {
        this.#settleOutput(record, bytes, false);
        this.#markError(record);
      }
    );
  }

  #handleExit(record: SessionRecord, exit: SessionExit): void {
    if (record.exit !== undefined) return;
    record.exit = exit.signal === undefined ? { exitCode: exit.exitCode } : exit;
    this.#stopAcceptingOutput(record);
    if (record.status !== "error") record.status = "exited";
    this.#releaseSubscriptions(record);
    if (this.#selectedSessionId === record.id) this.#selectedSessionId = this.#firstRunningId();
    this.#notifyChange();
  }

  async #closeRecord(record: SessionRecord): Promise<SessionExit | undefined> {
    let exit = record.exit;
    try {
      if (exit === undefined) {
        exit = await record.port.close();
        record.exit = exit.signal === undefined ? { exitCode: exit.exitCode } : exit;
      }
      return exit;
    } finally {
      await record.outputChain;
      this.#releaseSubscriptions(record);
      record.screen.dispose?.();
      this.#sessions.delete(record.id);
      if (this.#selectedSessionId === record.id) this.#selectedSessionId = this.#firstRunningId();
      this.#notifyChange();
    }
  }

  #settleOutput(record: SessionRecord, bytes: number, receivedOutput: boolean): void {
    record.pendingOutputBytes -= bytes;
    record.pendingOutputChunks -= 1;
    if (receivedOutput) record.hasReceivedOutput = true;
    this.#notifyChange();
  }

  #stopAcceptingOutput(record: SessionRecord): void {
    record.acceptsOutput = false;
    record.dataSubscription?.dispose();
  }

  #markError(record: SessionRecord): void {
    if (record.status !== "exited") record.status = "error";
    this.#stopAcceptingOutput(record);
    this.#notifyChange();
  }

  #notifyChange(): void {
    for (const listener of this.#changeListeners) {
      try { listener(); } catch { /* Rendering observers must never affect session ownership. */ }
    }
  }

  #releaseSubscriptions(record: SessionRecord): void {
    if (record.released) return;
    record.released = true;
    record.dataSubscription?.dispose();
    record.exitSubscription?.dispose();
  }

  #firstRunningId(): string | undefined {
    return [...this.#sessions.values()].find((record) => record.status === "running")?.id;
  }

  #snapshot(record: SessionRecord): ManagedSession {
    const base = {
      id: record.id,
      status: record.status,
      hasReceivedOutput: record.hasReceivedOutput,
      snapshot: record.screen.snapshot()
    };
    return record.exit === undefined ? base : { ...base, exit: record.exit };
  }
}
