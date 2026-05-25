/**
 * Marker interface for binary-encoded values returned from the backend.
 * When a cell value has this shape, it means the original bytes were
 * base64-encoded for safe JSON transport.
 */
export interface BinaryCellValue {
  __binary__: string;
  __encoding__: "utf8" | "base64";
}

/**
 * Type guard to detect binary cell values.
 */
export function isBinaryCellValue(value: unknown): value is BinaryCellValue {
  return (
    value !== null &&
    typeof value === "object" &&
    "__binary__" in value &&
    "__encoding__" in value
  );
}

/**
 * Decode a binary cell value back to a display string.
 * For UTF-8 encoding, returns the raw string.
 * For base64 encoding, decodes the base64 to bytes, then UTF-8 decodes.
 * Falls back to Latin-1 for invalid UTF-8.
 */
export function decodeCellValue(value: unknown): string {
  if (isBinaryCellValue(value)) {
    if (value.__encoding__ === "utf8") {
      return value.__binary__;
    }
    // base64-encoded value
    try {
      const binary = atob(value.__binary__);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Fallback to Latin-1
      const binary = atob(value.__binary__);
      return Array.from(binary).map((c) => String.fromCharCode(c.charCodeAt(0) & 0xff)).join("");
    }
  }
  return String(value ?? "");
}

/**
 * Decode a binary cell value to raw bytes (Uint8Array).
 * Returns null if the value is not a binary cell value or is UTF-8.
 */
export function decodeCellValueToBytes(value: unknown): Uint8Array | null {
  if (!isBinaryCellValue(value)) return null;
  if (value.__encoding__ === "utf8") return null;

  try {
    const binary = atob(value.__binary__);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
    return bytes;
  } catch {
    return null;
  }
}
