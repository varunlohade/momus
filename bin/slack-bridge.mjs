#!/usr/bin/env node
/**
 * Slack bridge for the Momus loop. Run from the polling session — never a
 * server. The agent reads JSON from stdout and decides what to do.
 *
 *   node bin/slack-bridge.mjs fetch [--advance]
 *     New messages in the home channel (SLACK_CHANNEL) since the watermark,
 *     plus new replies in threads Momus has seen. The bot's own messages are
 *     excluded. The watermark moves only with --advance, so a crashed poll
 *     turn re-reads the same batch.
 *
 *   node bin/slack-bridge.mjs mentions [--advance]
 *     Every @mention of the bot across EVERY channel it is a member of,
 *     top-level and thread replies. Invite the bot to a channel and it is
 *     watched — no per-channel config.
 *
 *   node bin/slack-bridge.mjs thread --ts <ts> [--channel <name>]
 *     All replies of one thread, live. Run this right before replying: a
 *     fetch snapshot can be minutes stale, and replying into a thread a
 *     teammate has since taken over reads as noise.
 *
 *   node bin/slack-bridge.mjs post --text "..." [--thread <ts>] [--channel <name>]
 *   node bin/slack-bridge.mjs react --ts <ts> [--emoji eyes] [--channel <name>]
 *   node bin/slack-bridge.mjs search --query "withdraw limit" [--asker <userId>] [--days 90] [--exclude leadership]
 *     Messages matching every word, from channels the asker can read.
 *
 *   node bin/slack-bridge.mjs groups
 *     Lists user groups, to find the id for a <!subteam^ID> mention.
 *
 * Env: SLACK_BOT_TOKEN (xoxb-…), SLACK_CHANNEL (home channel, default momus).
 */

import { createSlack } from '../lib/slack.mjs';
import { readState, writeState } from '../lib/state.mjs';

const slack = createSlack();
const HOME = process.env.SLACK_CHANNEL || 'momus';

function flag(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function toMessage(message, threadTs, name) {
  return {
    ts: message.ts,
    thread_ts: threadTs,
    user: message.user,
    userName: name,
    text: message.text ?? '',
    files: (message.files ?? []).map((f) => ({
      name: f.name,
      url: f.url_private,
      mimetype: f.mimetype,
    })),
  };
}

async function fetchNew(advance) {
  const state = await readState('slack-state.json');
  const channel = state.channelId || (await slack.channelId(HOME));
  const oldest = state.lastTs || String(Date.now() / 1000 - 6 * 3600); // first run: last 6h
  const { user_id: botId } = await slack.api('auth.test');

  const history = await slack.api('conversations.history', {
    channel,
    oldest,
    inclusive: false,
    limit: 50,
  });

  const messages = [];
  for (const message of history.messages.reverse()) {
    if (message.user === botId) continue;
    if (message.subtype === 'channel_join') continue;
    messages.push(toMessage(message, message.thread_ts ?? message.ts, await slack.userName(message.user)));
  }

  // Thread replies do not show up in history unless also sent to the
  // channel. People reply in-thread, so poll the threads we already know.
  for (const threadTs of (state.watchThreads ?? []).slice(-20)) {
    try {
      const replies = await slack.api('conversations.replies', {
        channel,
        ts: threadTs,
        oldest,
        limit: 20,
      });
      for (const message of replies.messages) {
        if (message.ts === threadTs) continue;
        if (message.user === botId) continue;
        if (Number(message.ts) <= Number(oldest)) continue;
        if (messages.some((m) => m.ts === message.ts)) continue;
        messages.push(toMessage(message, threadTs, await slack.userName(message.user)));
      }
    } catch {
      // Deleted thread or a permissions blip — never sink the poll.
    }
  }

  if (advance && (history.messages.length > 0 || messages.length > 0)) {
    const newest = Math.max(
      Number(state.lastTs || 0),
      ...messages.map((m) => Number(m.ts)),
      ...history.messages.map((m) => Number(m.ts)),
    );
    const seen = new Set(state.watchThreads ?? []);
    for (const m of messages) seen.add(m.thread_ts);
    await writeState('slack-state.json', {
      ...state,
      channelId: channel,
      lastTs: String(newest),
      watchThreads: [...seen].slice(-50),
    });
  }

  console.log(JSON.stringify({ channel, messages }, null, 1));
}

async function mentions(advance) {
  const { user_id: botId } = await slack.api('auth.test');
  const state = await readState('mention-state.json', { channels: {} });
  state.channels ??= {};

  const token = `<@${botId}>`;
  const hits = [];
  const watermarks = {};
  for (const ch of await slack.memberChannels()) {
    const oldest = state.channels[ch.id] || String(Date.now() / 1000 - 24 * 3600); // first sight: last 24h
    let newest = Number(oldest);
    let history;
    try {
      history = await slack.api('conversations.history', { channel: ch.id, limit: 100 });
    } catch {
      continue; // not readable → skip, never sink the tick
    }
    for (const m of history.messages ?? []) {
      newest = Math.max(newest, Number(m.ts));
      if (m.user !== botId && Number(m.ts) > Number(oldest) && (m.text || '').includes(token)) {
        hits.push({ channel: ch.name, cid: ch.id, ts: m.ts, thread_ts: m.ts,
          user: m.user, userName: await slack.userName(m.user), text: m.text || '' });
      }
      // Active thread → scan replies too (catches a tag under an old parent).
      if (m.reply_count > 0 && Number(m.latest_reply || m.ts) > Number(oldest)) {
        try {
          const replies = await slack.api('conversations.replies', { channel: ch.id, ts: m.ts, oldest, limit: 50 });
          for (const r of replies.messages ?? []) {
            if (r.ts === m.ts) continue;
            newest = Math.max(newest, Number(r.ts));
            if (r.user !== botId && Number(r.ts) > Number(oldest) && (r.text || '').includes(token)) {
              hits.push({ channel: ch.name, cid: ch.id, ts: r.ts, thread_ts: m.ts,
                user: r.user, userName: await slack.userName(r.user), text: r.text || '' });
            }
          }
        } catch { /* thread gone — skip */ }
      }
    }
    watermarks[ch.id] = String(newest);
  }

  if (advance) {
    await writeState('mention-state.json', { channels: { ...state.channels, ...watermarks } });
  }
  hits.sort((a, b) => Number(a.ts) - Number(b.ts));
  console.log(JSON.stringify({ botId, mentions: hits }, null, 1));
}

async function thread(args) {
  const ts = flag(args, '--ts');
  if (!ts) throw new Error('thread: --ts required');
  const channel = await slack.channelId(flag(args, '--channel') || HOME);
  const replies = await slack.api('conversations.replies', { channel, ts, limit: 50 });
  const messages = [];
  for (const m of replies.messages ?? []) {
    messages.push({ ts: m.ts, user: m.user, userName: await slack.userName(m.user), text: m.text ?? '' });
  }
  console.log(JSON.stringify({ messages }, null, 1));
}

async function post(args) {
  const text = flag(args, '--text');
  if (!text) throw new Error('post: --text required');
  const channel = await slack.channelId(flag(args, '--channel') || HOME);
  const params = { channel, text, unfurl_links: false };
  const threadTs = flag(args, '--thread');
  if (threadTs) params.thread_ts = threadTs;
  const result = await slack.api('chat.postMessage', params);
  console.log(JSON.stringify({ ok: true, ts: result.ts }));
}

async function react(args) {
  const ts = flag(args, '--ts');
  if (!ts) throw new Error('react: --ts required');
  const channel = await slack.channelId(flag(args, '--channel') || HOME);
  await slack.api('reactions.add', { channel, timestamp: ts, name: flag(args, '--emoji') || 'eyes' });
  console.log(JSON.stringify({ ok: true }));
}

// Keyword search for "why was this decided" questions. Bot tokens cannot
// call search.messages, so this scans recent history of member channels.
// With --asker, only channels THAT PERSON is a member of are searched: an
// answer must never quote a channel the asker cannot read themselves.
// --exclude drops channels by name (e.g. read-only leadership channels).
async function search(args) {
  const query = flag(args, '--query');
  if (!query) throw new Error('search: --query required');
  const asker = flag(args, '--asker');
  const days = Number(flag(args, '--days') || 90);
  const exclude = new Set((flag(args, '--exclude') || '').split(',').filter(Boolean));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const oldest = String(Date.now() / 1000 - days * 86400);

  const hits = [];
  for (const ch of await slack.memberChannels()) {
    if (exclude.has(ch.name)) continue;
    if (asker) {
      try {
        const members = await slack.api('conversations.members', { channel: ch.id, limit: 1000 });
        if (!members.members.includes(asker)) continue;
      } catch { continue; } // cannot prove access → do not search it
    }
    let cursor;
    for (let page = 0; page < 10; page++) {
      let history;
      try {
        history = await slack.api('conversations.history', { channel: ch.id, oldest, limit: 200, cursor });
      } catch { break; }
      for (const m of history.messages ?? []) {
        const text = (m.text || '').toLowerCase();
        if (!terms.every((t) => text.includes(t))) continue;
        let permalink = '';
        try {
          permalink = (await slack.api('chat.getPermalink', { channel: ch.id, message_ts: m.ts })).permalink;
        } catch { /* leave blank */ }
        hits.push({ channel: ch.name, ts: m.ts, userName: await slack.userName(m.user),
          text: m.text, replyCount: m.reply_count || 0, permalink });
      }
      cursor = history.response_metadata?.next_cursor;
      if (!cursor) break;
    }
  }
  hits.sort((a, b) => Number(a.ts) - Number(b.ts));
  console.log(JSON.stringify({ query, asker: asker || null, hits: hits.slice(-30) }, null, 1));
}

async function groups() {
  const data = await slack.api('usergroups.list');
  for (const group of data.usergroups ?? []) {
    console.log(`${group.handle}: ${group.id}  (mention with <!subteam^${group.id}>)`);
  }
}

const [, , command, ...rest] = process.argv;
const run = {
  fetch: () => fetchNew(rest.includes('--advance')),
  mentions: () => mentions(rest.includes('--advance')),
  thread: () => thread(rest),
  post: () => post(rest),
  react: () => react(rest),
  search: () => search(rest),
  groups,
}[command];
if (!run) {
  console.error('usage: slack-bridge.mjs fetch|mentions [--advance] | thread --ts <ts> | post --text "..." [--thread <ts>] [--channel <name>] | react --ts <ts> | search --query "..." [--asker <id>] | groups');
  process.exit(1);
}
run().catch((error) => {
  console.error(`slack-bridge: ${error.message}`);
  process.exit(1);
});
