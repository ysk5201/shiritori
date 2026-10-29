import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKanaWord } from '../public/js/kana.js';
import { buildTopic, findEntry, remainingStarting, pickPlayableChar, relaxChar, suggestAnswers, deadEndAnswers } from '../public/js/topics.js';

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

test('濁点を外せば続けられる文字', () => {
  assert.equal(relaxChar(countries, new Set(), 'ご', rules), 'こ');
  assert.equal(relaxChar(countries, new Set(), 'ず', rules), 'す');
  assert.equal(relaxChar(countries, new Set(), 'む', rules), null);
  const koUsed = new Set(countries.entries.filter((e) => e.readings.some((r) => r[0] === 'こ')).map((e) => e.id));
  assert.equal(relaxChar(countries, koUsed, 'ご', rules), null);
});

test('答えの例は最大3件、残りの総数も返す', () => {
  const ka = suggestAnswers(countries, new Set(), 'か', rules);
  assert.equal(ka.examples.length, 3);
  assert.ok(ka.total > 3);
  // 「り」: リトアニア・リビア・リベリア(リヒテンシュタインは「ん」で終わるので数えない)
  assert.equal(suggestAnswers(countries, new Set(), 'り', rules).total, 3);
  const used = new Set([findEntry(countries, 'りびあ').id, findEntry(countries, 'りべりあ').id]);
  assert.deepEqual(suggestAnswers(countries, used, 'り', rules), { examples: ['リトアニア'], total: 1 });
  assert.equal(suggestAnswers(countries, new Set(), 'ご', rules).total, 0);
});

test('答えの例に「ん」で終わる答えは入れない', () => {
  // 「に」で始まる国: 日本(にほん/にっぽん)は「ん」で終わるので出さない
  const r = suggestAnswers(countries, new Set(), 'に', rules, 99);
  assert.ok(r.examples.every((e) => !e.startsWith('日本')));
  assert.ok(r.examples.includes('ニカラグア'));
});

test('漢字や別の呼び方の答えには読みを添える', () => {
  const r = suggestAnswers(countries, new Set(), 'べ', rules, 99);
  assert.ok(r.examples.includes('アメリカ合衆国(べいこく)'));
  assert.ok(r.examples.includes('ベトナム'));
});

test('詰みの国の一覧', () => {
  const list = deadEndAnswers(countries, rules);
  const byChar = Object.fromEntries(list.map((d) => [d.char, d.names]));
  assert.deepEqual(byChar['む'].sort(), ['スリナム', 'ベトナム'].sort());
  assert.deepEqual(byChar['ご'].sort(), ['コンゴ共和国', 'トーゴ', 'トリニダード・トバゴ'].sort());
  assert.deepEqual(Object.keys(byChar).sort(), ['ご', 'ず', 'む', 'や', 'ゆ'].sort());
});
