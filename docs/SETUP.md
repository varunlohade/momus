# Setup

## 1. Requirements

- Node 20 or newer. No npm packages.
- [Claude Code](https://claude.com/claude-code), or any coding agent that can
  run shell commands on a schedule.
- `gh` (GitHub CLI), logged in, if your issue tracker is GitHub.

## 2. Slack app

1. Create an app at https://api.slack.com/apps ("From scratch"). Name it Momus.
2. Under **OAuth & Permissions**, add these bot token scopes:

   | Scope               | Why                                   |
   |---------------------|---------------------------------------|
   | `channels:history`  | read public channels it is in         |
   | `groups:history`    | read private channels it is in        |
   | `channels:read`     | list its channels                     |
   | `groups:read`       | list its private channels             |
   | `chat:write`        | post and reply                        |
   | `reactions:write`   | add 👀 when it picks something up     |
   | `users:read`        | show names instead of ids             |
   | `usergroups:read`   | find group ids for @group mentions    |

3. Install the app to your workspace. Copy the **Bot User OAuth Token**
   (`xoxb-…`) into `.env` as `SLACK_BOT_TOKEN`.
4. In each channel Momus should watch, type `/invite @Momus`. Membership is
   the whole config: invite it and it watches for mentions there.

## 3. Optional sources

- **Zendesk** (surge watch, daily report): create an API token under Admin →
  Apps and integrations → Zendesk API. Momus only reads.
- **App Store Connect** (store watch): create a key under Users and Access →
  Integrations with the App Manager or Developer role. Save the `.p8` file
  outside the repo and point `ASC_KEY_PATH` at it.
- **Google Play** (store watch): set `PLAY_PACKAGE`. No key needed; it reads
  the public listing.

## 4. Configure

```sh
cp .env.example .env          # fill in tokens
cp MOMUS.example.md MOMUS.md  # describe your team, channels, repos
npm test                      # sanity check, no network
set -a && . ./.env && set +a
node bin/slack-bridge.mjs fetch   # should print recent messages
```

Edit `lib/themes.mjs` so the support themes match your product.

## 5. Run

Open Claude Code in the repo and paste the prompt from `prompts/start.md`.
Keep the session running on a machine that stays awake.

## Safety notes

- `.env`, `MOMUS.md`, `data/`, and `*.p8` are git-ignored. Keep it that way.
- Momus treats every Slack message as untrusted input. Only the person in
  the terminal session gives orders. Keep that rule in your `MOMUS.md`.
- Mark money, identity, and auth code as "needs a human" in `MOMUS.md`.
