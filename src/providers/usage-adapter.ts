import {
  createUnsupportedStateValue,
  type DataSource,
  type ProviderId,
  type ProviderUsageState
} from "./contracts.js";

export interface ProviderUsageAdapter {
  getUsageState(provider: ProviderId): ProviderUsageState;
}

export function createProviderUsageAdapter(clock: () => Date = () => new Date()): ProviderUsageAdapter {
  return {
    getUsageState(provider) {
      const source = usageSources[provider];
      return {
        provider,
        usage: createUnsupportedStateValue(unsupportedReasons[provider], source, clock())
      };
    }
  };
}

const usageSources: Record<ProviderId, DataSource> = {
  codex: {
    provider: "codex",
    documentationUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
    providerVersion: "0.164.0",
    refreshMethod: "not-collected"
  },
  claude: {
    provider: "claude",
    documentationUrl: "https://docs.anthropic.com/en/docs/claude-code/cli-usage",
    providerVersion: "2.1.302",
    refreshMethod: "not-collected"
  }
};

const unsupportedReasons: Record<ProviderId, string> = {
  codex: "Codex usage is available through an active session command that TGX does not automate.",
  claude: "Claude Code does not document an external usage or limit query for an active interactive session."
};
