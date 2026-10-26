import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHiragana, lastChar, checkWord, sameChar } from '../public/js/kana.js';

const vowelRules = { longVowel: 'vowel', ignoreDakuten: false };
const looseRules = { longVowel: 'skip', ignoreDakuten: true };

test('カタカナや全角・空白をひらがなにそろえる', () => {
  assert.equal(toHiragana('リンゴ'), 'りんご');
  assert.equal(toHiragana(' コーヒー '), 'こーひー');
  assert.equal(toHiragana('ｺｰﾋｰ'), 'こーひー');
  assert.equal(toHiragana('ラーメン'), 'らーめん');
});

test('最後の文字: 小さい文字は大きくする', () => {
  assert.equal(lastChar('きしゃ'), 'や');
  assert.equal(lastChar('ちょっ'), 'つ');
});

test('最後の文字: 長音は前の文字か母音を使う', () => {
  assert.equal(lastChar('こーひー'), 'ひ');
  assert.equal(lastChar('こーひー', vowelRules), 'い');
  assert.equal(lastChar('すきー', vowelRules), 'い');
  assert.equal(lastChar('めにゅー', vowelRules), 'う');
  assert.equal(lastChar('めにゅー'), 'ゆ');
});

test('「を」は「お」として扱う', () => {
  assert.equal(lastChar('てを'), 'お');
});

test('濁点を区別しない設定', () => {
  assert.equal(sameChar('か', 'が'), false);
  assert.equal(sameChar('か', 'が', looseRules), true);
  assert.equal(sameChar('は', 'ぱ', looseRules), true);
});

test('checkWord: 正しい単語', () => {
  const r = checkWord('ゴリラ', { required: 'ご', used: new Set() });
  assert.deepEqual(r, { ok: true, word: 'ごりら', endsWithN: false });
});

test('checkWord: 「ん」で終わる', () => {
  const r = checkWord('みかん', { required: 'み', used: new Set() });
  assert.equal(r.ok, true);
  assert.equal(r.endsWithN, true);
});

test('checkWord: エラー理由', () => {
  const ctx = { required: 'り', used: new Set(['りんご']) };
  assert.equal(checkWord('', ctx).reason, 'empty');
  assert.equal(checkWord('林檎', ctx).reason, 'notKana');
  assert.equal(checkWord('り', ctx).reason, 'tooShort');
  assert.equal(checkWord('ごりら', ctx).reason, 'wrongStart');
  assert.equal(checkWord('リンゴ', ctx).reason, 'used');
  assert.equal(checkWord('ーりす', ctx).reason, 'notKana');
});

test('checkWord: 小さい文字で始まる要求に大きい文字で答えられる', () => {
  const required = lastChar('きしゃ');
  assert.equal(checkWord('やま', { required, used: new Set() }).ok, true);
});

test('checkWord: 濁点を区別しない設定なら「か」に「が」で答えられる', () => {
  assert.equal(checkWord('がっこう', { required: 'か', used: new Set() }).ok, false);
  assert.equal(checkWord('がっこう', { required: 'か', used: new Set(), rules: looseRules }).ok, true);
});
