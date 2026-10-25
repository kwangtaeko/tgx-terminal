import { StringDecoder } from "node:string_decoder";

import type { Disposable, TerminalSize } from "../session/contracts.js";

export interface InputCapableTerminal {
  onInput(listener: (data: string) => void): Disposable;
}

export interface ResizableTerminal {
  onResize(listener: (size: TerminalSize) => void): Disposable;
}

interface InputStream {
  readonly isTTY?: boolean;
  readonly isRaw?: boolean;
  isPaused?(): boolean;
  setRawMode?(mode: boolean): void;
  pause?(): void;
  resume(): void;
  on(event: "data", listener: (data: Buffer | string) => void): void;
  off(event: "data", listener: (data: Buffer | string) => void): void;
}

interface OutputStream {
  readonly columns?: number;
  readonly rows?: number;
  write(data: string): boolean;
  once?(event: "drain", listener: () => void): void;
  on?(event: "resize", listener: () => void): void;
  off?(event: "resize", listener: () => void): void;
}

/** Owns only the parent terminal state; child VT bytes are never written here. */
export class ProcessTerminal implements InputCapableTerminal, ResizableTerminal {
  #entered = false;
  #rawModeBeforeEnter: boolean | undefined;
  #wasPausedBeforeEnter = false;

  constructor(
    private readonly input: InputStream = process.stdin,
    private readonly output: OutputStream = process.stdout
  ) {}

  get size(): { columns: number; rows: number } {
    return {
      columns: this.output.columns ?? 80,
      rows: this.output.rows ?? 24
    };
  }

  async enter(): Promise<void> {
    if (this.#entered) {
      return;
    }

    this.#rawModeBeforeEnter = this.input.isRaw;
    this.#wasPausedBeforeEnter = this.input.isPaused?.() ?? false;
    if (this.input.isTTY && this.input.setRawMode !== undefined) {
      this.input.setRawMode(true);
    }
    this.input.resume();
    this.output.write("\u001b[?1049h\u001b[?25l");
    this.#entered = true;
  }

  async render(frame: string): Promise<void> {
    if (frame === "" || this.output.write(frame) || this.output.once === undefined) {
      return;
    }
    await new Promise<void>((resolve) => this.output.once?.("drain", resolve));
  }

  async restore(): Promise<void> {
    if (!this.#entered) {
      return;
    }

    this.output.write("\u001b[0m\u001b[?25h\u001b[?1049l");
    if (this.input.isTTY && this.input.setRawMode !== undefined && this.#rawModeBeforeEnter !== undefined) {
      this.input.setRawMode(this.#rawModeBeforeEnter);
    }
    if (this.#wasPausedBeforeEnter) {
      this.input.pause?.();
    }
    this.#entered = false;
  }

  onInput(listener: (data: string) => void): Disposable {
    const decoder = new StringDecoder("utf8");
    const onData = (data: Buffer | string): void => {
      const decoded = decoder.write(typeof data === "string" ? Buffer.from(data, "utf8") : data);
      if (decoded !== "") listener(compensateWindowsPtyInput(decoded));
    };

    this.input.on("data", onData);
    return { dispose: () => this.input.off("data", onData) };
  }

  onResize(listener: (size: TerminalSize) => void): Disposable {
    if (this.output.on === undefined || this.output.off === undefined) {
      return { dispose() {} };
    }

    const onResize = (): void => listener(this.size);
    this.output.on("resize", onResize);
    return { dispose: () => this.output.off?.("resize", onResize) };
  }
}

/**
 * ConPTY swaps BS (0x08) and DEL (0x7f) while converting its input stream
 * into Windows key events. Swap them before the PTY boundary to preserve the
 * byte the parent terminal received for the child CLI.
 */
function compensateWindowsPtyInput(data: string): string {
  if (process.platform !== "win32") return data;
  return data.replace(/[\b\x7f]/g, (character) => (character === "\b" ? "\x7f" : "\b"));
}
