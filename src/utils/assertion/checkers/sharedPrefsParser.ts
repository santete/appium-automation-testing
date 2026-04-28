/**
 * Shared Android shared_prefs XML parser — used bởi cả `adb` adapter và
 * `mobile:executeScript` adapter. Parsing logic identical (Android default
 * format không phụ thuộc cách lấy XML).
 *
 * Plan ref: M3 Task 18, D4 repay.
 */

/**
 * Parse Android shared_prefs XML cho key. Hỗ trợ `<string>`, `<boolean>`, `<int>`,
 * `<long>`, `<float>` — đủ cho Sauce Demo + smoke test use case.
 *
 * Trả raw string (caller compare). `<string>` lấy text content (decode XML
 * entities); primitive lấy attribute `value`.
 */
export function extractPrefValue(xml: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const stringRe = new RegExp(`<string\\s+name="${escapedKey}"\\s*>([\\s\\S]*?)<\\/string>`);
  const stringMatch = stringRe.exec(xml);
  if (stringMatch) return decodeXmlEntities(stringMatch[1]);

  const primitiveRe = new RegExp(
    `<(boolean|int|long|float)\\s+name="${escapedKey}"\\s+value="([^"]*)"\\s*\\/>`,
  );
  const primMatch = primitiveRe.exec(xml);
  if (primMatch) return primMatch[2];

  return null;
}

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Validate Android package name shape — used pre-shell injection guard. */
export const ANDROID_PKG_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
