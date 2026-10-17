import type { ChildLaunch } from "../launch/command.js";
import { validateTerminalSize } from "../terminal/size.js";

import type { Disposable, PtyFactory, PtyProcess, SessionExit, TerminalSize } from "./contracts.js";

type SessionState = "active" | "closing" | "closed";

export class PtySession {
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<(exit: SessionExit) => void>();
  private readonly process: PtyProcess;
  private readonly dataSubscription: Disposable;
  private readonly exitSubscription: Disposable;
  private state: SessionState = "active";
  private exit: SessionExit | undefined;
  private closePromise: Promise<SessionExit> | undefined;
  private resolveClose: ((exit: SessionExit) => void) | undefined;

  constructor(launch: ChildLaunch, size: TerminalSize, factory: PtyFactory) {
    this.process = factory(launch, size);
    this.dataSubscription = this.process.onData((data) => this.handleData(data));
    this.exitSubscription = this.process.onExit((event) => this.handleExit(event));
  }

  onData(listener: (data: string) => void): Disposable {
    this.dataListeners.add(listener);

    return {
      dispose: () => this.dataListeners.delete(listener)
    };
  }

  onExit(listener: (exit: SessionExit) => void): Disposable {
    if (this.exit !== undefined) {
      listener(this.exit);
      return { dispose: () => undefined };
    }

    this.exitListeners.add(listener);

    return {
      dispose: () => this.exitListeners.delete(listener)
    };
  }

  write(data: string): void {
    this.assertActive();
    this.process.write(data);
  }

  resize(size: TerminalSize): void {
    this.assertActive();
    const validatedSize = validateTerminalSize(size);
    this.process.resize(validatedSize.columns, validatedSize.rows);
  }

  close(): Promise<SessionExit> {
    if (this.closePromise !== undefined) {
      return this.closePromise;
    }

    if (this.exit !== undefined) {
      this.closePromise = Promise.resolve(this.exit);
      return this.closePromise;
    }

    this.state = "closing";
    this.closePromise = new Promise<SessionExit>((resolve) => {
      this.resolveClose = resolve;
    });
    this.process.kill();
    return this.closePromise;
  }

  private assertActive(): void {
    if (this.state !== "active") {
      throw new Error(`PTY session is not active: ${this.state}`);
    }
  }

  private handleData(data: string): void {
    if (this.state === "closed") {
      return;
    }

    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  private handleExit(event: SessionExit): void {
    if (this.state === "closed") {
      return;
    }

    this.exit = event.signal === undefined ? { exitCode: event.exitCode } : event;
    this.state = "closed";
    this.dataSubscription.dispose();
    this.exitSubscription.dispose();
    this.dataListeners.clear();

    for (const listener of this.exitListeners) {
      listener(this.exit);
    }
    this.exitListeners.clear();

    if (this.resolveClose !== undefined) {
      this.resolveClose(this.exit);
      this.resolveClose = undefined;
      return;
    }

    this.closePromise = Promise.resolve(this.exit);
  }
}
