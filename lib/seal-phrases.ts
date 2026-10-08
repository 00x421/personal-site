/**
 * 闲章池与选取规则：篆刻闲章「图像内的声音」传统——一句自我的心声。
 * 文章页（文末落款）与印谱页（/album）共用同一套池子和映射：
 * 按 slug 短哈希确定性选取，同一篇永远同一句，无 SSR 水合不一致。
 */
export const SEAL_PHRASES = [
  '信我所行',
  '知行合一',
  '日拱一卒',
  '事上磨炼',
  '温故知新',
  '格物致知',
  '宁静致远',
  '澄怀观道',
  '慢即是快',
  '把事做透',
] as const;

/** slug 短哈希 → 池内索引。 */
export function pickPhrase(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return SEAL_PHRASES[hash % SEAL_PHRASES.length];
}
