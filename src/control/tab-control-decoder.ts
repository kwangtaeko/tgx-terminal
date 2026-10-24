export type TabCommand = "new-session" | "next-session" | "previous-session" | "close-session";

export type TabControlAction =
  | { readonly kind: "forward"; readonly data: string }
  | { readonly kind: "command"; readonly command: TabCommand };

export interface TabControlDecoder {
  push(data: string): readonly TabControlAction[];
  flush(): readonly TabControlAction[];
}

export interface TabControlDecoderOptions {
  readonly enabled: boolean;
  readonly prefix?: string;
}

const DEFAULT_PREFIX = "\u0014";

/** Decodes only an explicitly enabled wrapper prefix; it never writes to a PTY. */
export function createTabControlDecoder(options: TabControlDecoderOptions): TabControlDecoder {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  if ([...prefix].length !== 1) {
    throw new Error("prefix must contain exactly one Unicode code point");
  }

  let awaitingCommand = false;

  return {
    push(data) {
      if (!options.enabled || data === "") return data === "" ? [] : [{ kind: "forward", data }];

      const actions: TabControlAction[] = [];
      let forwarded = "";
      const forward = (text: string): void => {
        forwarded += text;
      };
      const flushForward = (): void => {
        if (forwarded !== "") actions.push({ kind: "forward", data: forwarded });
        forwarded = "";
      };

      for (const codePoint of data) {
        if (awaitingCommand) {
          awaitingCommand = false;
          const command = commands[codePoint];
          if (command === undefined) {
            forward(`${prefix}${codePoint}`);
          } else {
            flushForward();
            actions.push({ kind: "command", command });
          }
          continue;
        }

        if (codePoint === prefix) {
          awaitingCommand = true;
        } else {
          forward(codePoint);
        }
      }
      flushForward();
      return actions;
    },
    flush() {
      if (!options.enabled || !awaitingCommand) return [];
      awaitingCommand = false;
      return [{ kind: "forward", data: prefix }];
    }
  };
}

const commands: Readonly<Record<string, TabCommand>> = {
  n: "new-session",
  "]": "next-session",
  "[": "previous-session",
  x: "close-session"
};
