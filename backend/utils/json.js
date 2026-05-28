export function safeParseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
