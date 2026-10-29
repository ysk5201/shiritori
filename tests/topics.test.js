import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKanaWord } from '../public/js/kana.js';
import { buildTopic, findEntry, remainingStarting, pickPlayableChar } from '../public/js/topics.js';

const rules = { longVowel: 'skip', ignoreDakuten: false };
const countries = buildTopic('country');

test('自由お題は一覧を持たない', () => {
  assert.equal(buildTopic('free'), null);
});

test('国名は197か国', () => {
  assert.equal(countries.entries.length, 197);
  assert.equal(new Set(countries.entries.map((e) => e.name)).size, 197);
});

test('国名の読みはすべてひらがなで、重複しない', () => {
  const all = countries.entries.flatMap((e) => e.readings);
  for (const r of all) assert.ok(isKanaWord(r), `読みが不正: ${r}`);
  assert.equal(new Set(all).size, all.length);
});

test('表示名と別の呼び方のどちらでも見つかる', () => {
  assert.equal(findEntry(countries, 'あめりか').name, 'アメリカ合衆国');
  assert.equal(findEntry(countries, 'べいこく').name, 'アメリカ合衆国');
  assert.equal(findEntry(countries, 'ぼすにあへるつぇごびな').name, 'ボスニア・ヘルツェゴビナ');
  assert.equal(findEntry(countries, 'にっぽん').name, '日本');
  assert.equal(findEntry(countries, 'とうきょう'), null);
});

test('まだ出ていない国だけ数える', () => {
  const ri = remainingStarting(countries, new Set(), 'り', rules).map((e) => e.name);
  assert.deepEqual(ri.sort(), ['リトアニア', 'リビア', 'リヒテンシュタイン', 'リベリア'].sort());
  const used = new Set([findEntry(countries, 'りびあ').id]);
  assert.equal(remainingStarting(countries, used, 'り', rules).length, 3);
});

test('「ぬ」で始まる国はない', () => {
  assert.equal(remainingStarting(countries, new Set(), 'ぬ', rules).length, 0);
});

test('答えが残っている文字だけを選ぶ', () => {
  for (let i = 0; i < 50; i++) {
    const c = pickPlayableChar(countries, new Set(), rules);
    assert.ok(remainingStarting(countries, new Set(), c, rules).length > 0);
  }
  const allUsed = new Set(countries.entries.map((e) => e.id));
  assert.equal(pickPlayableChar(countries, allUsed, rules), null);
});
