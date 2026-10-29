// しりとりの文字判定まわりの純粋関数。DOM には依存しない。

const SMALL_TO_BIG = {
  'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
  'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ',
  'ゕ': 'か', 'ゖ': 'け',
};

const VOWEL_ROWS = {
  'あ': 'あかさたなはまやらわがざだばぱぁゃゎゕ',
  'い': 'いきしちにひみりゐぎじぢびぴぃ',
  'う': 'うくすつぬふむゆるぐずづぶぷぅっゅゔ',
  'え': 'えけせてねへめれゑげぜでべぺぇゖ',
  'お': 'おこそとのほもよろをごぞどぼぽぉょ',
};

const VOWEL_OF = {};
for (const [vowel, chars] of Object.entries(VOWEL_ROWS)) {
  for (const c of chars) VOWEL_OF[c] = vowel;
}

// 最初の文字としてランダムに選ぶ候補(「ん」や使いにくい文字は除く)
export const START_CHARS = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわがぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ'];

// フリック入力のキー。並びは [タップ, 左, 上, 右, 下](iPhone のかなキーボードと同じ)。空文字はその方向に文字なし。
export const FLICK_DIRECTIONS = ['center', 'left', 'up', 'right', 'down'];

export const FLICK_KEYS = {
  'あ': [...'あいうえお'],
  'か': [...'かきくけこ'],
  'さ': [...'さしすせそ'],
  'た': [...'たちつてと'],
  'な': [...'なにぬねの'],
  'は': [...'はひふへほ'],
  'ま': [...'まみむめも'],
  'や': ['や', '', 'ゆ', '', 'よ'],
  'ら': [...'らりるれろ'],
  'わ': ['わ', 'を', 'ん', 'ー', ''],
};

// 同じキーを続けてタップしたときの文字の順番(あ→い→う…)
const TAP_CYCLES = {
  'あ': [...'あいうえおぁぃぅぇぉ'],
  'た': [...'たちつてとっ'],
  'や': [...'やゆよゃゅょ'],
  'わ': [...'わをんー'],
};

export function flickChar(key, direction) {
  return FLICK_KEYS[key][FLICK_DIRECTIONS.indexOf(direction)] ?? '';
}

export function tapCycleNext(key, current) {
  const cycle = TAP_CYCLES[key] ?? FLICK_KEYS[key].filter((c) => c !== '');
  return cycle[(cycle.indexOf(current) + 1) % cycle.length];
}

// 「゛゜小」キーで切り替わる文字の組
const VARIANT_GROUPS = [
  'あぁ', 'いぃ', 'うぅゔ', 'えぇ', 'おぉ',
  'かが', 'きぎ', 'くぐ', 'けげ', 'こご',
  'さざ', 'しじ', 'すず', 'せぜ', 'そぞ',
  'ただ', 'ちぢ', 'つっづ', 'てで', 'とど',
  'はばぱ', 'ひびぴ', 'ふぶぷ', 'へべぺ', 'ほぼぽ',
  'やゃ', 'ゆゅ', 'よょ', 'わゎ',
].map((g) => [...g]);

// 濁点・半濁点・小さい文字を順に切り替える(か→が→か、は→ば→ぱ→は)
export function cycleVariant(c) {
  const group = VARIANT_GROUPS.find((g) => g.includes(c));
  if (!group) return c;
  return group[(group.indexOf(c) + 1) % group.length];
}

export const DEFAULT_RULES = {
  longVowel: 'skip', // 'skip': 「ー」の前の文字 / 'vowel': 「ー」の前の文字の母音
  ignoreDakuten: false, // true なら「か」と「が」などを同じ文字とみなす
};

export function toHiragana(str) {
  return str
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[-－‐―−~〜～]/g, 'ー');
}

export function isKanaWord(word) {
  return /^[ぁ-ゖ][ぁ-ゖー]*$/.test(word);
}

export function toBig(c) {
  return SMALL_TO_BIG[c] ?? c;
}

export function stripDakuten(c) {
  return c.normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC');
}

// 次の人が始める文字
export function lastChar(word, rules = DEFAULT_RULES) {
  let i = word.length - 1;
  while (i > 0 && word[i] === 'ー') i--;
  let c = word[i];
  if (i < word.length - 1 && rules.longVowel === 'vowel') {
    c = VOWEL_OF[c] ?? c;
  }
  c = toBig(c);
  if (c === 'を') c = 'お';
  return c;
}

export function firstChar(word) {
  const c = toBig(word[0]);
  return c === 'を' ? 'お' : c;
}

export function sameChar(a, b, rules = DEFAULT_RULES) {
  if (rules.ignoreDakuten) return stripDakuten(a) === stripDakuten(b);
  return a === b;
}

export function endsWithN(word, rules = DEFAULT_RULES) {
  return lastChar(word, rules) === 'ん';
}

// 入力を判定する。
// 戻り値: { ok: true, word, endsWithN } または { ok: false, reason }
export function checkWord(raw, { required, used, rules = DEFAULT_RULES }) {
  const word = toHiragana(raw ?? '');
  if (word.length === 0) return { ok: false, reason: 'empty' };
  if (!isKanaWord(word)) return { ok: false, reason: 'notKana' };
  if (word.length < 2) return { ok: false, reason: 'tooShort' };
  if (required && !sameChar(firstChar(word), required, rules)) {
    return { ok: false, reason: 'wrongStart' };
  }
  if (used && used.has(word)) return { ok: false, reason: 'used' };
  return { ok: true, word, endsWithN: endsWithN(word, rules) };
}
