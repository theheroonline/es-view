import { useState, useMemo, useCallback, useEffect } from "react";
import { CopyOutlined } from "@ant-design/icons";
import type { RedisKeyDetail, RedisSortedSetMember } from "../types";
import { decodeCellValue, decodeCellValueToBytes, isBinaryCellValue } from "../../../lib/binaryValue";

export type EncodingFormat = "text" | "hex" | "base64" | "binary" | "json";

function rawBytesToText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  }
}

function rawBytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function rawBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function rawBytesToBinaryStr(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(2).padStart(8, "0")).join(" ");
}

/**
 * Extract the raw bytes from a Redis key detail value.
 * The backend sends values wrapped in shared.BinaryValue:
 * - UTF-8 values: plain string (the BinaryValue MarshalJSON outputs the raw string)
 * - Base64 values: object with __binary__ and __encoding__ fields
 *
 * This function returns { text: string, bytes: Uint8Array | null }.
 */
function extractValueData(
  value: string | string[] | Record<string, string> | RedisSortedSetMember[] | null,
): { text: string; bytes: Uint8Array | null } {
  // Check if it's a BinaryValue wrapper (base64-encoded) first
  // This handles the case where the top-level value is a BinaryValue object
  if (isBinaryCellValue(value)) {
    if (value.__encoding__ === "base64") {
      const bytes = decodeCellValueToBytes(value);
      if (bytes) {
        return { text: rawBytesToText(bytes), bytes };
      }
    }
    // UTF-8 value wrapped in BinaryValue (outputs as plain string via MarshalJSON)
    return { text: value.__binary__, bytes: null };
  }

  if (typeof value === "string") {
    // Plain UTF-8 string
    return { text: value, bytes: null };
  }

  if (Array.isArray(value)) {
    // Check if it's a zset (array of objects with member/score)
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null && "member" in value[0]) {
      const zsetEntries = value as RedisSortedSetMember[];
      const lines = zsetEntries.map((entry) => {
        const member = decodeCellValue(entry.member);
        return `${member} (score: ${entry.score})`;
      });
      return { text: lines.join("\n"), bytes: null };
    }

    // List/Set: array of values, each may be a BinaryValue
    const strValues = value as (string | unknown)[];
    const decoded = strValues.map((item) => decodeCellValue(item));
    return { text: decoded.join("\n"), bytes: null };
  }

  if (value && typeof value === "object") {
    // Hash: object with field->value pairs, values may be BinaryValue
    const entries = Object.entries(value as Record<string, unknown>);
    const decoded = entries.map(([field, val]) => `${field}: ${decodeCellValue(val)}`);
    return { text: decoded.join("\n"), bytes: null };
  }

  return { text: "", bytes: null };
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

function tryJsonFormat(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

const FORMATS: { value: EncodingFormat; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "hex", label: "Hex" },
  { value: "base64", label: "Base64" },
  { value: "binary", label: "Binary" },
  { value: "json", label: "JSON" },
];

export function RedisKeyDetailValue({
  detail,
}: {
  detail: RedisKeyDetail;
}) {
  const decoded = useMemo(() => {
    return extractValueData(detail.value);
  }, [detail.value]);

  // Auto-detect initial format: hex for binary, json if it looks like JSON, otherwise text
  const defaultFormat: EncodingFormat = useMemo(() => {
    if (detail.valueEncoding === "base64" || detail.isBinary) return "hex";
    if (decoded.text && looksLikeJson(decoded.text)) return "json";
    return "text";
  }, [detail.valueEncoding, detail.isBinary, decoded.text]);

  const [encoding, setEncoding] = useState<EncodingFormat>(defaultFormat);
  const [selectOpen, setSelectOpen] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    if (!selectOpen) return;
    const handler = () => setSelectOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectOpen]);

  // Reset to default format when detail changes
  useEffect(() => {
    setEncoding(defaultFormat);
  }, [defaultFormat, detail.name]);

  const displayText = useMemo(() => {
    const bytes = decoded.bytes ?? (decoded.text ? new TextEncoder().encode(decoded.text) : null);
    switch (encoding) {
      case "hex":
        return bytes ? rawBytesToHex(bytes) : decoded.text;
      case "base64":
        return bytes ? rawBytesToBase64(bytes) : decoded.text;
      case "binary":
        return bytes ? rawBytesToBinaryStr(bytes) : decoded.text;
      case "json":
        return tryJsonFormat(decoded.text) ?? decoded.text;
      default:
        return decoded.text;
    }
  }, [decoded.bytes, decoded.text, encoding]);

  const handleCopy = useCallback(() => {
    if (displayText) {
      navigator.clipboard.writeText(displayText);
    }
  }, [displayText]);

  if (detail.unsupported) {
    return <pre className="redis-detail-pre">Unsupported key type. Use Redis Console for raw commands.</pre>;
  }

  return (
    <>
      <div className="redis-encoding-switch">
        <div className="redis-encoding-select">
          <button
            className="redis-encoding-select-trigger"
            onClick={() => setSelectOpen(!selectOpen)}
          >
            {FORMATS.find((f) => f.value === encoding)?.label ?? "Text"}
            <span className={`redis-encoding-select-arrow ${selectOpen ? "is-open" : ""}`} />
          </button>
          {selectOpen && (
            <div
              className="redis-encoding-dropdown"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {FORMATS.map((fmt) => (
                <div
                  key={fmt.value}
                  className={`redis-encoding-option ${encoding === fmt.value ? "is-active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEncoding(fmt.value);
                    setSelectOpen(false);
                  }}
                >
                  {fmt.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="redis-encoding-copy-btn"
          onClick={handleCopy}
          title="Copy"
        >
          <CopyOutlined />
        </button>
      </div>

      <pre className="redis-detail-pre">{displayText}</pre>
    </>
  );
}
