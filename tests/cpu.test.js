import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsWithN, lastChar } from '../public/js/kana.js';
import { buildTopic, findEntry, remainingStarting } from '../public/js/topics.js';
import { cpuAnswer } from '../public/js/cpu.js';

const rules = { longVowel: 'skip', ignoreDakuten: false };
const countries = buildTopic('country');
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('CPU は指定の文字から始まる、まだ出ていない国を答える', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let i = 0; i < 20; i++) {
      const move = cpuAnswer(countries, new Set(), 'か', rules, level, { random: seq(0.9, Math.random()) });
      assert.ok(move.word.startsWith('か'), `${level}: ${move.word}`);
      assert.equal(findEntry(countries, move.word), move.entry);
    }
  }
  const used = new Set(remainingStarting(countries, new Set(), 'り', rules).map((e) => e.id));
  assert.equal(cpuAnswer(countries, used, 'り', rules, 'normal'), null);
});

test('よわい CPU はときどきこうさんする', () => {
  assert.equal(cpuAnswer(countries, new Set(), 'か', rules, 'easy', { random: () => 0.01 }), null);
});

test('ふつう以上は「ん」で終わる国を避ける', () => {
  for (const level of ['normal', 'hard']) {
    for (let i = 0; i < 30; i++) {
      const move = cpuAnswer(countries, new Set(), 'に', rules, level);
      assert.ok(!endsWithN(move.word, rules), `${level}: ${move.word}`);
    }
  }
});

test('つよい CPU は相手が続けにくい答えを選ぶ', () => {
  const remainAfter = (move) => remainingStarting(countries, new Set([move.entry.id]), lastChar(move.word, rules), rules).length;
  // 普通のルール: 行き止まりは避けつつ、続く答えがいちばん少ないもの
  const move = cpuAnswer(countries, new Set(), 'と', rules, 'hard');
  assert.ok(remainAfter(move) > 0);
  // 行き止まりで勝てるルール: 行き止まり(トーゴ・トリニダード・トバゴ)を狙う
  const stuck = cpuAnswer(countries, new Set(), 'と', rules, 'hard', { stuckWins: true });
  assert.equal(remainAfter(stuck), 0);
});
