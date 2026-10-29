export const K_MIN = 10;

export interface Group { key: string; count: number }
export interface SuppressedGroup { key: string; count: number | null; suppressed: boolean }

/**
 * k-anonymity for aggregate output. Rules:
 *  1. any group with count < k is hidden (count -> null).
 *  2. complementary suppression: if exactly one group in a partition is hidden and the total is published,
 *     the total minus the visible groups would reveal it, so the next-smallest visible group is hidden too.
 *     (A hidden group of size 1..k-1 plus a second hidden group means the pair is only known in sum.)
 *  3. the whole result is hidden if fewer than k people exist in total.
 * `total` is the number of people in the partition (e.g. all opted-in employees).
 */
export function suppress(groups: Group[], total: number, k = K_MIN): { total: number | null; groups: SuppressedGroup[] } {
  if (total < k) return { total: null, groups: groups.map((g) => ({ key: g.key, count: null, suppressed: true })) };

  const out: SuppressedGroup[] = groups.map((g) => ({ key: g.key, count: g.count < k ? null : g.count, suppressed: g.count < k }));
  const hidden = out.filter((g) => g.suppressed).length;
  if (hidden === 1) {
    let idx = -1;
    out.forEach((g, i) => { if (!g.suppressed && (idx === -1 || (g.count as number) < (out[idx].count as number))) idx = i; });
    if (idx >= 0) out[idx] = { ...out[idx], count: null, suppressed: true };
  }
  return { total, groups: out };
}

/** A rate (0..1) over a group is only published when the group passes k. */
export function suppressRate(numerator: number, denominator: number, k = K_MIN): number | null {
  if (denominator < k) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

/** Enforce at the query layer: drop any row whose cohort size is below k, regardless of what the caller asked for. */
export function filterCohorts<T extends { n: number }>(rows: T[], k = K_MIN): T[] {
  return rows.filter((r) => r.n >= k);
}
