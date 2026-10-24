export interface TabModeArguments {
  readonly tabsEnabled: boolean;
  readonly passthrough: readonly string[];
}

/** Separates TGX's explicit tab opt-in from provider-owned arguments. */
export function parseTabModeArguments(args: readonly string[]): TabModeArguments {
  let tabsEnabled = false;
  let providerArgumentsBegin = false;
  const passthrough: string[] = [];

  for (const arg of args) {
    if (!providerArgumentsBegin && arg === "--") providerArgumentsBegin = true;

    if (!providerArgumentsBegin && arg === "--tgx-tabs") {
      tabsEnabled = true;
    } else {
      passthrough.push(arg);
    }
  }

  return { tabsEnabled, passthrough };
}
