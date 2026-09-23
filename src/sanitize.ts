// Token name and symbol are attacker-controlled strings on a chain minting thousands of
// pools an hour. They flow straight into an agent's context. Strip control characters and
// zero-width/bidi tricks, collapse whitespace, truncate hard, and surface them under
// names that mark them as untrusted data (untrusted_symbol / untrusted_name), because
// models skip a note in the tool description but read the field name.
const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]', 'g')

export function sanitize(value: string, max: number): string {
  return value.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export const untrustedSymbol = (s: string) => sanitize(s, 16)
export const untrustedName = (s: string) => sanitize(s, 48)
