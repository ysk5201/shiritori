// 1人用モードの CPU の答え方。お題の一覧から選ぶ。
import { endsWithN, firstChar, lastChar, sameChar } from './kana.js?v=__VERSION__';
import { remainingStarting } from './topics.js?v=__VERSION__';

// 序盤はどの強さでも詰み(行き止まり)を狙わない。中盤以降も「つよい」がときどき狙うだけ。
export const TRAP_FROM_TURN = 10; // つながった数がこれ以上になったら詰みを狙い始める(5往復)
export const TRAP_RATE = 0.5; // 「つよい」が詰みを狙う確率

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
// turn: これまでにつながった数(序盤は詰みを狙わないために使う)
export function cpuAnswer(topic, usedIds, char, rules, level, { stuckWins = false, turn = 0, random = Math.random } = {}) {
  let options = [];
  for (const entry of remainingStarting(topic, usedIds, char, rules)) {
    for (const word of entry.readings) {
      if (sameChar(firstChar(word), char, rules)) {
        const used = new Set(usedIds).add(entry.id);
        const next = remainingStarting(topic, used, lastChar(word, rules), rules).length;
        options.push({ word, entry, next });
      }
    }
  }
  if (options.length === 0) return null;

  // 相手を詰ませる答えは、狙ってよいときだけ候補に残す(序盤にいきなり詰まされると理不尽なので)
  const trapAllowed = stuckWins && turn >= TRAP_FROM_TURN && (level !== 'hard' || random() < TRAP_RATE);
  if (stuckWins && !trapAllowed) {
    const noTrap = options.filter((o) => o.next > 0 || endsWithN(o.word, rules));
    if (noTrap.length) options = noTrap;
  }

  if (level === 'easy') {
    // ときどき思いつかず、「ん」で終わる答えもうっかり出してしまう
    if (random() < CPU_LEVELS.easy.giveUpRate) return null;
    return pick(options, random);
  }

  const safe = options.filter((o) => !endsWithN(o.word, rules));
  if (safe.length === 0) return pick(options, random); // 「ん」で終わる答えしか残っていない
  if (level === 'normal') return pick(safe, random);

  // つよい: 相手が続けにくい(続く答えが少ない)文字で終わる答えを選ぶ。
  // 詰みを狙ってよいときは、行き止まりを最優先で狙う。
  const playable = trapAllowed ? safe : safe.filter((o) => o.next > 0);
  const pool = playable.length ? playable : safe;
  const fewest = Math.min(...pool.map((o) => o.next));
  return pick(pool.filter((o) => o.next === fewest), random);
}
