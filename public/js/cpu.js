// 1人用モードの CPU の答え方。お題の一覧から選ぶ。
import { endsWithN, firstChar, lastChar, sameChar } from './kana.js?v=__VERSION__';
import { remainingStarting } from './topics.js?v=__VERSION__';

export const CPU_LEVELS = {
  easy: { label: 'よわい', giveUpRate: 0.15 },
  normal: { label: 'ふつう' },
  hard: { label: 'つよい' },
};

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

// CPU の答えを選ぶ。思いつかない(こうさん)なら null。
// stuckWins: 行き止まりにすると相手が脱落するルールなら true
export function cpuAnswer(topic, usedIds, char, rules, level, { stuckWins = false, random = Math.random } = {}) {
  const options = [];
  for (const entry of remainingStarting(topic, usedIds, char, rules)) {
    for (const word of entry.readings) {
      if (sameChar(firstChar(word), char, rules)) options.push({ word, entry });
    }
  }
  if (options.length === 0) return null;

  if (level === 'easy') {
    // ときどき思いつかず、「ん」で終わる答えもうっかり出してしまう
    if (random() < CPU_LEVELS.easy.giveUpRate) return null;
    return pick(options, random);
  }

  const safe = options.filter((o) => !endsWithN(o.word, rules));
  if (safe.length === 0) return pick(options, random); // 「ん」で終わる答えしか残っていない
  if (level === 'normal') return pick(safe, random);

  // つよい: 相手が続けにくい(続く答えが少ない)文字で終わる答えを選ぶ。
  // 行き止まりで相手が脱落するルールなら、行き止まりを最優先で狙う。
  const scored = safe.map((o) => {
    const used = new Set(usedIds).add(o.entry.id);
    const next = remainingStarting(topic, used, lastChar(o.word, rules), rules).length;
    return { ...o, next };
  });
  const playable = stuckWins ? scored : scored.filter((o) => o.next > 0);
  const pool = playable.length ? playable : scored;
  const fewest = Math.min(...pool.map((o) => o.next));
  return pick(pool.filter((o) => o.next === fewest), random);
}
