import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, findUrgent } from '../lib/themes.mjs';
import { maskEmail, sanitizeQuote, summariseSlack } from '../lib/sanitize.mjs';
import { extractUserLines } from '../lib/zendesk.mjs';
import { clusterBySimilarity } from '../lib/cluster.mjs';

test('classify puts specific money themes first', () => {
  assert.equal(classify('My deposit is still pending after 2 days'), 'funds-stuck');
  assert.equal(classify('balance shows zero after the update'), 'missing-funds');
  assert.equal(classify('I cannot log in, OTP never comes'), 'login');
  assert.equal(classify('love the new colours'), 'other');
});

test('findUrgent escalates money themes at a lower count', () => {
  const out = findUrgent([
    { key: 'funds-stuck', count: 3, baselineAvg: 3 },
    { key: 'promo', count: 3, baselineAvg: 3 },
    { key: 'app-broken', count: 9, baselineAvg: 2 },
  ]);
  assert.deepEqual(out.map((u) => u.key), ['funds-stuck', 'app-broken']);
});

test('sanitize strips contact details', () => {
  assert.equal(maskEmail('mail jane.doe@example.com'), 'mail ja***@example.com');
  assert.equal(sanitizeQuote('call +1 415 555 0100 or a@b.co'), 'call [phone] or [email]');
  assert.equal(summariseSlack('<@U123> see <https://x.test|link> <!here>'), 'see https://x.test @here');
});

test('extractUserLines keeps only the customer side of a transcript', () => {
  const body = '(2026-01-01 10:00) User: card declined\n(2026-01-01 10:01) Bot: sorry!\n(2026-01-01 10:02) User: again';
  assert.equal(extractUserLines(body), 'card declined again');
  assert.equal(extractUserLines('plain email body'), null);
});

test('clusterBySimilarity groups the same new complaint', () => {
  const clusters = clusterBySimilarity([
    { ticket_id: 1, text: 'dark mode toggle missing from settings' },
    { ticket_id: 2, text: 'where is dark mode toggle in settings' },
    { ticket_id: 3, text: 'refund for my coffee order' },
  ]);
  assert.equal(clusters.length, 2);
  assert.ok(clusters[0].sharedTerms.includes('dark'));
});
