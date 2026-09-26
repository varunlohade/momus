/**
 * Read-only Zendesk API client.
 *
 * Every function here issues GET requests only. Nothing in Momus can create,
 * edit, or delete anything in your support system.
 */

export function zendeskConfig(env = process.env) {
  const { ZENDESK_SUBDOMAIN: subdomain, ZENDESK_EMAIL: email, ZENDESK_API_TOKEN: apiToken } = env;
  if (!subdomain || !email || !apiToken) {
    throw new Error('Missing ZENDESK_SUBDOMAIN / ZENDESK_EMAIL / ZENDESK_API_TOKEN');
  }
  return {
    base: `https://${subdomain}.zendesk.com/api/v2`,
    auth: 'Basic ' + Buffer.from(`${email}/token:${apiToken}`).toString('base64'),
  };
}

/** GET with retry on 429 / 5xx, honouring Retry-After. */
export async function apiGet(config, path, attempt = 0) {
  const url = path.startsWith('http') ? path : `${config.base}${path}`;
  const response = await fetch(url, {
    headers: { Authorization: config.auth, Accept: 'application/json' },
  });
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 6) throw new Error(`${response.status} after ${attempt} retries: ${url}`);
    const wait = Number(response.headers.get('retry-after')) || 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    return apiGet(config, path, attempt + 1);
  }
  if (!response.ok) throw new Error(`Zendesk ${response.status} on ${url}`);
  return response.json();
}

/** Tickets matching a search query, newest first, capped for sanity. */
export async function searchTickets(config, query, cap = 1000) {
  const tickets = [];
  let page = `/search.json?query=${encodeURIComponent(`type:ticket ${query}`)}&sort_by=created_at&sort_order=desc&per_page=100`;
  while (page && tickets.length < cap) {
    const data = await apiGet(config, page);
    tickets.push(...(data.results ?? []));
    page = data.next_page || null;
  }
  return tickets;
}

// Chat tickets often start as an empty shell. The transcript lands in ONE
// comment when the chat ends, written by an integration user (not the
// requester), in the form "(timestamp) User: ...\n(timestamp) Bot: ...".
const TRANSCRIPT_LINE = /^\(\d{4}-\d{2}-\d{2}[^)]*\)\s*(User|Visitor|Customer|Bot|Agent)\s*:/;

/** Customer lines of a chat transcript, or null if the body is not one. */
export function extractUserLines(body) {
  if (!TRANSCRIPT_LINE.test(String(body).trim())) return null;
  const out = [];
  let keep = false;
  for (const line of String(body).split('\n')) {
    const m = line.match(TRANSCRIPT_LINE);
    if (m) keep = ['User', 'Visitor', 'Customer'].includes(m[1]);
    if (keep) out.push(line.replace(TRANSCRIPT_LINE, '').trim());
  }
  return out.join(' ');
}

/**
 * What the customer actually said on a ticket: subject, description, their
 * own comments, and the customer side of any chat transcript. Canned bot
 * replies are dropped via SUPPORT_BOT_PATTERN (a regex source string).
 */
export async function customerText(config, ticket, env = process.env) {
  const botRe = env.SUPPORT_BOT_PATTERN ? new RegExp(env.SUPPORT_BOT_PATTERN, 'i') : null;
  const isBot = (s) => (botRe ? botRe.test(s) : false);
  const parts = [ticket.subject || ''];
  const desc = (ticket.description || '').trim();
  if (desc && !isBot(desc) && !/^conversation with /i.test(desc)) parts.push(desc);
  try {
    const data = await apiGet(config, `/tickets/${ticket.id}/comments.json?per_page=40`);
    for (const c of data.comments ?? []) {
      const body = (c.body || '').trim();
      if (!body) continue;
      const transcript = extractUserLines(body);
      if (transcript !== null) {
        if (transcript) parts.push(transcript);
        continue;
      }
      if (isBot(body) || c.author_id !== ticket.requester_id) continue;
      parts.push(body);
    }
  } catch {
    // Comments unavailable → subject and description are better than nothing.
  }
  return parts.join(' ').trim();
}

/** Runs fn over items with a small worker pool, to stay under rate limits. */
export async function pool(items, size, fn) {
  const queue = [...items];
  const results = [];
  await Promise.all(Array.from({ length: size }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await fn(item));
    }
  }));
  return results;
}
