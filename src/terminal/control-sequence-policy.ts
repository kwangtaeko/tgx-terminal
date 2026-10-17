const OSC_SEQUENCE = /\u001b\][\s\S]*?(?:\u0007|\u001b\\)|\u001b\][\s\S]*$/g;
const CSI_WINDOW_OPERATION = /\u001b\[[0-?]*[ -/]*t/g;

/**
 * Removes sequences that request effects outside the terminal screen before
 * child output reaches the VT parser or outer renderer.
 */
export function sanitizeForOuterRenderer(data: string): string {
  return data.replace(OSC_SEQUENCE, "").replace(CSI_WINDOW_OPERATION, "");
}
