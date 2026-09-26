#!/usr/bin/env node
/**
 * App store approval watcher. Reports TRANSITIONS since the last run:
 *
 *   - Apple: App Store Connect API. Reads the newest App Store version's
 *     state (WAITING_FOR_REVIEW, IN_REVIEW, PENDING_DEVELOPER_RELEASE,
 *     READY_FOR_SALE, REJECTED, ...). Needs an API key (.p8).
 *   - Google: scrapes the public Play listing for the live version name. It
 *     sees "approved AND rolled out", not "approved but held back".
 *
 * Either side is skipped when its env is missing. Output is JSON:
 *   { ios, android, transitions: ["ios_approved", "android_live:1.2.0->1.3.0", ...] }
 * This script never posts — the agent does.
 *
 * Env: ASC_APP_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file),
 *      PLAY_PACKAGE (e.g. com.example.app)
 * Usage: node bin/store-status.mjs [--dry]   (--dry does not save state)
 */

import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import { readState, writeState } from '../lib/state.mjs';

const { ASC_APP_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, PLAY_PACKAGE } = process.env;

// Apple states that mean "Apple approved the build".
const IOS_APPROVED = new Set(['PENDING_DEVELOPER_RELEASE', 'PROCESSING_FOR_APP_STORE', 'READY_FOR_SALE']);

async function ascJwt() {
  const key = await readFile(ASC_KEY_PATH.replace(/^~/, process.env.HOME));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' });
  const payload = b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const sign = createSign('sha256');
  sign.update(`${header}.${payload}`);
  return `${header}.${payload}.${sign.sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function checkIos() {
  const url = `https://api.appstoreconnect.apple.com/v1/apps/${ASC_APP_ID}/appStoreVersions`
    + '?limit=1&fields[appStoreVersions]=versionString,appStoreState';
  const data = await (await fetch(url, { headers: { Authorization: `Bearer ${await ascJwt()}` } })).json();
  if (data.errors) throw new Error(`App Store Connect: ${data.errors[0]?.detail || 'error'}`);
  const v = data.data?.[0]?.attributes;
  if (!v) throw new Error('App Store Connect: no versions returned');
  return { version: v.versionString, state: v.appStoreState, approved: IOS_APPROVED.has(v.appStoreState) };
}

async function checkAndroid() {
  const res = await fetch(`https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&hl=en`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (res.status === 404) return { liveVersion: null, listed: false };
  // The version name sits in the page data as [[["1.2.3"]]].
  const m = (await res.text()).match(/\[\[\["((?:\d+\.)+\d+)"\]\]/);
  return { liveVersion: m ? m[1] : null, listed: true };
}

const prev = await readState('store-status.json');
const result = { checkedAt: new Date().toISOString(), transitions: [] };

if (ASC_APP_ID && ASC_KEY_ID && ASC_ISSUER_ID && ASC_KEY_PATH) {
  try {
    result.ios = await checkIos();
    if (result.ios.approved && !prev.ios?.approved) result.transitions.push('ios_approved');
    if (prev.ios && result.ios.state !== prev.ios.state) {
      result.transitions.push(`ios_state:${prev.ios.state}->${result.ios.state}`);
    }
  } catch (err) {
    result.ios = { error: String(err.message || err) };
  }
}

if (PLAY_PACKAGE) {
  try {
    result.android = await checkAndroid();
    const before = prev.android?.liveVersion;
    if (result.android.liveVersion && before && result.android.liveVersion !== before) {
      result.transitions.push(`android_live:${before}->${result.android.liveVersion}`);
    }
  } catch (err) {
    result.android = { error: String(err.message || err) };
  }
}

if (!process.argv.includes('--dry')) {
  // Keep the last good reading when a check errors, so a blip is not a transition.
  await writeState('store-status.json', {
    ios: result.ios && !result.ios.error ? result.ios : prev.ios,
    android: result.android && !result.android.error ? result.android : prev.android,
  });
}
console.log(JSON.stringify(result, null, 1));
