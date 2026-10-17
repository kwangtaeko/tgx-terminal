export type Provider = "codex" | "claude";

export interface ChildLaunch {
  file: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

const executableByProvider: Readonly<Record<Provider, string>> = {
  claude: "claude",
  codex: "codex"
};

export function buildChildLaunch(
  provider: Provider,
  passthrough: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): ChildLaunch {
  const file = executableByProvider[provider];

  if (file === undefined) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return {
    file,
    args: Object.freeze([...passthrough]),
    cwd,
    env
  };
}
