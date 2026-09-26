/**
 * Minimal Slack Web API client shared by every Momus script.
 *
 * Form-encoded on purpose: Slack accepts JSON bodies only on a subset of
 * methods and silently IGNORES them elsewhere (users.conversations drops the
 * `types` param and hides private channels). Form-encoding works for every
 * method, chat.postMessage included.
 */

export function slackToken(env = process.env) {
  const token = env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error('momus: SLACK_BOT_TOKEN missing (copy .env.example to .env)');
    process.exit(1);
  }
  return token;
}

export function createSlack(token = slackToken()) {
  async function api(method, params = {}) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) body.set(key, String(value));
    }
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await response.json();
    if (!data.ok) throw new Error(`${method}: ${data.error}`);
    return data;
  }

  // users.conversations lists exactly the channels the bot is a member of.
  // That is both the right scope (membership IS the permission) and the
  // reliable lookup (conversations.list can miss private channels).
  async function memberChannels() {
    const channels = [];
    let cursor;
    do {
      const page = await api('users.conversations', {
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
      });
      channels.push(...page.channels);
      cursor = page.response_metadata?.next_cursor || undefined;
    } while (cursor);
    return channels;
  }

  async function channelId(nameOrId) {
    if (/^[CG][A-Z0-9]{6,}$/.test(nameOrId)) return nameOrId;
    const name = nameOrId.replace(/^#/, '');
    const hit = (await memberChannels()).find((c) => c.name === name);
    if (!hit) throw new Error(`channel #${name} not found — is the bot invited? (/invite @Momus)`);
    return hit.id;
  }

  const names = new Map();
  async function userName(id) {
    if (!id) return 'unknown';
    if (names.has(id)) return names.get(id);
    try {
      const data = await api('users.info', { user: id });
      const name = data.user?.profile?.display_name || data.user?.real_name || id;
      names.set(id, name);
      return name;
    } catch {
      return id;
    }
  }

  return { api, memberChannels, channelId, userName };
}
