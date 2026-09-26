/**
 * Issue themes used to bucket support tickets, and the rules that decide
 * what gets escalated.
 *
 * EDIT THIS FILE FOR YOUR PRODUCT. The defaults below fit a generic consumer
 * payments app. The best patterns come from reading your own tickets and
 * copying the phrases customers actually use — not from guessing.
 *
 * Order matters: a ticket lands in the FIRST theme it matches, so specific
 * patterns sit above generic ones. `money: true` marks themes where users
 * may be losing money; those escalate at a lower count.
 */

export const THEMES = [
  {
    key: 'missing-funds',
    title: 'Balance missing or wrong',
    pattern:
      /balance.{0,40}(gone|missing|zero|wrong|disappear)|money.{0,30}(gone|missing|lost)|account is empty|can.?t see my (balance|money|funds)/i,
    money: true,
  },
  {
    key: 'funds-stuck',
    title: 'Deposit or withdrawal stuck',
    pattern:
      /deposit.{0,40}(not|stuck|pending|missing)|not credited|hasn.?t arrived|withdraw.{0,40}(stuck|pending|fail|not)|transfer.{0,30}(stuck|pending|failed)/i,
    money: true,
  },
  {
    key: 'payment-declined',
    title: 'Payment declined',
    pattern: /declin|payment.{0,20}fail|card.{0,40}(not work|doesn.?t work|failed)/i,
    money: true,
  },
  {
    key: 'login',
    title: 'Login or account access',
    pattern: /can.?t log ?in|cannot log ?in|log ?in problem|logged out|locked out|2fa|otp|verification code|can.?t access my account/i,
    money: false,
  },
  {
    key: 'identity-check',
    title: 'Identity check (KYC)',
    pattern: /kyc|verif(y|ication)|selfie|passport|document.{0,30}(reject|fail|review)/i,
    money: false,
  },
  {
    key: 'app-broken',
    title: 'App stuck, blank, or crashing',
    pattern: /crash|freez|stuck|blank screen|loading forever|won.?t open/i,
    money: false,
  },
  {
    key: 'promo',
    title: 'Promo or reward not received',
    pattern: /bonus|reward|promo|referral|cashback/i,
    money: false,
  },
];

/** Assigns a ticket's text to the first matching theme, or 'other'. */
export function classify(text) {
  const value = String(text ?? '');
  for (const theme of THEMES) {
    if (theme.pattern.test(value)) return theme.key;
  }
  return 'other';
}

export function themeTitle(key) {
  if (key === 'other') return 'Other / uncategorised';
  if (key === 'silent') return 'Opened a chat but never described a problem';
  return THEMES.find((theme) => theme.key === key)?.title ?? key;
}

export function isMoneyTheme(key) {
  return THEMES.find((theme) => theme.key === key)?.money ?? false;
}

/**
 * Phrases that make a single ticket worth waking someone for, however many
 * others look like it. These are claims of loss or compromise.
 */
export const CRITICAL_PATTERN =
  /hacked|stolen|fraud|scam|unauthori[sz]ed|someone else.{0,20}(access|logged)|drained|chargeback|lawyer|police/i;

/**
 * Decides which themes to escalate for a period.
 *
 * Two independent triggers, because they catch different failures:
 *   - a spike (count well above the recent baseline) catches regressions
 *   - a floor on money themes catches a steady bleed that never spikes
 *
 * @param {Array<{key:string,count:number,baselineAvg:number}>} stats
 */
export function findUrgent(stats, { spikeFactor = 2, spikeMin = 4, moneyFloor = 3 } = {}) {
  const urgent = [];
  for (const stat of stats) {
    const { key, count, baselineAvg } = stat;
    const reasons = [];
    if (count >= spikeMin && count >= baselineAvg * spikeFactor) {
      const ratio = count / Math.max(baselineAvg, 0.1);
      reasons.push(`${count} vs ${baselineAvg.toFixed(1)} baseline (${ratio.toFixed(1)}x)`);
    }
    if (isMoneyTheme(key) && count >= moneyFloor) {
      reasons.push(`${count} money-affecting reports`);
    }
    if (reasons.length > 0) urgent.push({ ...stat, reasons, money: isMoneyTheme(key) });
  }
  // Money themes first, then by volume.
  return urgent.sort((a, b) => Number(b.money) - Number(a.money) || b.count - a.count);
}
