/**
 * Groups a day's support tickets by similarity — mapping only, no diagnosis.
 *
 * Two layers:
 *   1. The fixed THEMES from themes.mjs (patterns derived from the real
 *      corpus) — cheap, predictable buckets.
 *   2. For tickets that fall into 'other', greedy keyword-overlap clustering
 *      so a NEW kind of complaint still groups when several people report it
 *      the same day, without anyone having written a pattern for it yet.
 *
 * Everything here is plain text statistics — no model calls, safe in cron.
 */

// Words too common in support text to indicate similarity.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'this', 'that', 'with', 'have', 'from', 'not', 'but',
  'you', 'your', 'can', 'cant', "can't", 'was', 'are', 'its', "it's", 'has',
  'had', 'why', 'how', 'what', 'when', 'all', 'any', 'get', 'got', 'now',
  'still', 'just', 'also', 'been', 'they', 'them', 'there', 'here', 'out',
  'about', 'after', 'before', 'again', 'then', 'than', 'will', 'would',
  'should', 'could', 'please', 'help', 'hello', 'thanks', 'thank', 'hey',
  'app', 'account', 'issue', 'problem', 'support', 'team', 'need',
  'want', 'trying', 'tried', 'does', 'doesnt', "doesn't", 'did', 'didnt',
  "didn't", 'even', 'only', 'very', 'much', 'more', 'some', 'one', 'two',
]);

/** Salient keyword set for one ticket's text. */
export function keywords(text) {
  const tokens = String(text ?? '')
    .toLowerCase()
    .match(/[a-z][a-z'-]{2,}/g) ?? [];
  const set = new Set();
  for (const token of tokens) {
    if (!STOPWORDS.has(token)) set.add(token);
  }
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Greedy clustering of unthemed tickets by keyword overlap.
 *
 * @param {Array<{ticket_id:number, text:string}>} tickets
 * @param {number} threshold  Jaccard similarity to join a cluster
 * @returns {Array<{tickets:Array, sharedTerms:string[]}>}
 */
export function clusterBySimilarity(tickets, threshold = 0.18) {
  const items = tickets.map((ticket) => ({
    ...ticket,
    kw: keywords(ticket.text),
  }));

  const clusters = [];
  for (const item of items) {
    let best = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      // Compare against the cluster's accumulated keyword profile.
      const score = jaccard(item.kw, cluster.profile);
      if (score > bestScore) {
        best = cluster;
        bestScore = score;
      }
    }
    if (best && bestScore >= threshold) {
      best.tickets.push(item);
      for (const keyword of item.kw) {
        best.counts.set(keyword, (best.counts.get(keyword) ?? 0) + 1);
        best.profile.add(keyword);
      }
    } else {
      const counts = new Map();
      for (const keyword of item.kw) counts.set(keyword, 1);
      clusters.push({ tickets: [item], profile: new Set(item.kw), counts });
    }
  }

  return clusters.map((cluster) => ({
    tickets: cluster.tickets.map(({ kw, ...rest }) => rest),
    // Terms shared by the majority of the cluster — the "what they all said".
    sharedTerms: [...cluster.counts.entries()]
      .filter(([, count]) => count >= Math.ceil(cluster.tickets.length / 2))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term]) => term),
  }));
}

