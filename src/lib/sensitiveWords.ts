// 简易敏感词过滤（MVP）。线上建议用 edge function + 词库 API。
const WORDS = ["微信号", "加微信", "支付宝转", "私下交易", "线下付款", "诈骗", "色情", "赌博"];

export function filterSensitive(text: string): { clean: string; hit: boolean; words: string[] } {
  let clean = text;
  const hits: string[] = [];
  for (const w of WORDS) {
    if (clean.includes(w)) {
      hits.push(w);
      clean = clean.split(w).join("*".repeat(w.length));
    }
  }
  return { clean, hit: hits.length > 0, words: hits };
}
