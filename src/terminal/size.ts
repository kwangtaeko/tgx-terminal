import type { TerminalSize } from "../session/contracts.js";

export const MAX_TERMINAL_DIMENSION = 32_767;

export function validateTerminalSize(size: TerminalSize): TerminalSize {
  validateDimension("columns", size.columns);
  validateDimension("rows", size.rows);

  return size;
}

function validateDimension(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`Terminal ${name} must be positive safe integers`);
  }

  if (value > MAX_TERMINAL_DIMENSION) {
    throw new RangeError(`Terminal ${name} exceeds the maximum of ${MAX_TERMINAL_DIMENSION}`);
  }
}
