import type { Disposable } from "../session/contracts.js";

export interface InputCapableTerminal {
  onInput(listener: (data: string) => void): Disposable;
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
}

/** Owns only the parent terminal state; child VT bytes are never written here. */
export class ProcessTerminal implements InputCapableTerminal {
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
    this.output.write(frame);
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
    const onData = (data: Buffer | string): void => {
      listener(typeof data === "string" ? data : data.toString("utf8"));
    };

    this.input.on("data", onData);
    return { dispose: () => this.input.off("data", onData) };
  }
}
