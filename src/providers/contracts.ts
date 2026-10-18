export type ProviderId = "codex" | "claude";

export type DataStatus = "available" | "unsupported" | "stale" | "error";

export interface DataSource {
  provider: ProviderId;
  documentationUrl: string;
  providerVersion: string;
  refreshMethod: "not-collected" | "read-only-query";
}

interface StateValueBase {
  readonly source: Readonly<DataSource>;
  readonly observedAt: Date;
}

export interface AvailableStateValue<T> extends StateValueBase {
  readonly status: "available";
  readonly value: T;
  readonly resetAt?: Date;
  readonly window?: string;
  readonly unit?: string;
}

export interface StaleStateValue<T> extends StateValueBase {
  readonly status: "stale";
  readonly value: T;
  readonly resetAt?: Date;
  readonly reason: string;
  readonly window?: string;
  readonly unit?: string;
}

export interface UnsupportedStateValue extends StateValueBase {
  readonly status: "unsupported";
  readonly reason: string;
  readonly value?: never;
  readonly resetAt?: never;
  readonly window?: never;
  readonly unit?: never;
}

export interface ErrorStateValue extends StateValueBase {
  readonly status: "error";
  readonly reason: string;
  readonly value?: never;
  readonly resetAt?: never;
  readonly window?: never;
  readonly unit?: never;
}

export type StateValue<T> =
  | AvailableStateValue<T>
  | StaleStateValue<T>
  | UnsupportedStateValue
  | ErrorStateValue;

export interface ProviderUsageState {
  provider: ProviderId;
  usage: StateValue<number>;
}

export function createUnsupportedStateValue(
  reason: string,
  source: DataSource,
  observedAt: Date
): UnsupportedStateValue {
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error("observedAt must be a valid Date");
  }

  return {
    status: "unsupported",
    source: { ...source },
    observedAt: new Date(observedAt),
    reason
  };
}
