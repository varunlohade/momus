/**
 * PII scrubbing for anything that leaves the machine (Slack posts, GitHub
 * comments, Notion pages). Cheap and conservative: emails, phone numbers,
 * and Slack markup. Names need a user directory to redact safely, so the
 * prompts tell the agent to never quote names at all.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;

/** "jane.doe@example.com" → "ja***@example.com": recognisable, not a dump. */
export function maskEmail(text) {
  return String(text ?? '').replace(
    /([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+)/g,
    '$1***$2',
  );
}

/** Strips emails and phone numbers entirely, collapses whitespace, trims. */
export function sanitizeQuote(text, maxLength = 180) {
  return String(text ?? '')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Turns Slack markup into a short plain summary with emails masked. */
export function summariseSlack(text, maxLength = 160) {
  let t = String(text ?? '');
  t = t.replace(/<mailto:[^|>]+\|([^>]+)>/g, '$1');
  t = t.replace(/<(https?:[^|>]+)\|[^>]*>/g, '$1');
  t = t.replace(/<(https?:[^>]+)>/g, '$1');
  t = t.replace(/<!subteam\^[^>]+>/g, '@group');
  t = t.replace(/<!(here|channel)>/g, '@$1');
  t = t.replace(/<@[A-Z0-9]+>/g, '');
  t = maskEmail(t.replace(/\s+/g, ' ').trim());
  return t.length > maxLength ? `${t.slice(0, maxLength - 1)}…` : t;
}
