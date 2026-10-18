import type { ScreenColor, ScreenSnapshot, ScreenStyle } from "./screen-model.js";

/**
 * Produces a small, fixed outer frame from parsed screen text only. It never
 * relays child-originated control bytes into the parent terminal.
 */
export function renderSnapshot(snapshot: ScreenSnapshot): string {
  return `\u001b[2J\u001b[H${snapshot.styledLines.map(renderStyledLine).join("\r\n")}\u001b[0m`;
}

/** Repaints the first frame fully, then limits later writes to changed rows. */
export class OuterRenderer {
  #previousLines: readonly string[] | undefined;

  render(snapshot: ScreenSnapshot): string {
    const currentLines = snapshot.styledLines.map(renderStyledLine);
    if (this.#previousLines === undefined || this.#previousLines.length !== currentLines.length) {
      this.#previousLines = currentLines;
      return `\u001b[2J\u001b[H${currentLines.join("\r\n")}\u001b[0m`;
    }

    const changedRows: string[] = [];
    for (let index = 0; index < currentLines.length; index += 1) {
      if (currentLines[index] !== this.#previousLines[index]) {
        changedRows.push(`\u001b[${index + 1};1H\u001b[2K${currentLines[index]}`);
      }
    }
    this.#previousLines = currentLines;

    return changedRows.length === 0 ? "" : `${changedRows.join("")}\u001b[0m`;
  }
}

/** Renders only parsed VT screen segments; it does not accept raw PTY bytes. */
export function renderStyledLine(line: ScreenSnapshot["styledLines"][number]): string {
  return line.segments.map(renderSegment).join("");
}

function renderSegment(segment: { text: string; style: ScreenStyle }): string {
  const sequence = styleSequence(segment.style);
  return sequence === "" ? segment.text : `${sequence}${segment.text}\u001b[0m`;
}

function styleSequence(style: ScreenStyle): string {
  const parameters: number[] = [];
  if (style.bold === true) parameters.push(1);
  if (style.dim === true) parameters.push(2);
  if (style.italic === true) parameters.push(3);
  if (style.underline === true) parameters.push(4);
  appendColor(parameters, 38, style.foreground);
  appendColor(parameters, 48, style.background);

  return parameters.length === 0 ? "" : `\u001b[${parameters.join(";")}m`;
}

function appendColor(parameters: number[], prefix: 38 | 48, color: ScreenColor | undefined): void {
  if (color === undefined) return;

  if (color.kind === "palette" && Number.isInteger(color.value) && color.value >= 0 && color.value <= 255) {
    parameters.push(prefix, 5, color.value);
    return;
  }

  if (color.kind === "rgb" && Number.isInteger(color.value) && color.value >= 0 && color.value <= 0xff_ffff) {
    parameters.push(prefix, 2, color.value >> 16, (color.value >> 8) & 0xff, color.value & 0xff);
  }
}
