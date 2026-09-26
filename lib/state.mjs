/**
 * Tiny JSON state files under data/ (watermarks, cooldowns, last-seen store
 * versions). Every script reads and writes through here so the location is
 * set in one place: MOMUS_DATA_DIR, or ./data next to the repo.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DATA_DIR =
  process.env.MOMUS_DATA_DIR || new URL('../data/', import.meta.url).pathname;

export async function readState(name, fallback = {}) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeState(name, value) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, name), JSON.stringify(value, null, 1));
}
