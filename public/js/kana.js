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

function firstChar(word) {
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
