import { START_CHARS, FLICK_DIRECTIONS, FLICK_KEYS, checkWord, cycleVariant, flickChar, lastChar, tapCycleNext } from './kana.js?v=__VERSION__';

const STORAGE_KEY = 'shiritori:setup:v1';
const PLAYER_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#e64980', '#5c7cfa'];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const WARN_SECONDS = 5;
const MAX_WORD_LENGTH = 20;

const ERROR_MESSAGES = {
  empty: '言葉を入力してね',
  notKana: 'ひらがな・カタカナで入力してね(漢字は読みで)',
  tooShort: '2文字以上の言葉にしてね',
  wrongStart: (c) => `「${c}」から始まる言葉にしてね`,
  used: 'その言葉はもう出たよ',
};

const OUT_REASONS = {
  n: (word) => `「${word}」は「ん」で終わっちゃった…`,
  time: () => '時間切れ…',
  ng: (word) => `「${word}」はみんなに認められなかった…`,
  giveup: () => 'こうさん…',
};

const $ = (id) => document.getElementById(id);

// ---------- 設定 ----------

const defaultSetup = () => ({
  players: ['プレイヤー1', 'プレイヤー2'],
  timeLimit: 30,
  firstWord: 'shiritori',
  longVowel: 'skip',
  ignoreDakuten: false,
  judge: true,
  vibrate: true,
});

function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.players)) return { ...defaultSetup(), ...saved };
  } catch {
    // 保存できない環境では毎回初期値で始める
  }
  return defaultSetup();
}

function saveSetup() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // 同上
  }
}

let setup = loadSetup();

function renderPlayerList() {
  const list = $('player-list');
  list.replaceChildren();
  setup.players.forEach((name, i) => {
    const li = document.createElement('li');
    li.className = 'player-row';

    const dot = document.createElement('span');
    dot.className = 'player-dot';
    dot.style.background = PLAYER_COLORS[i];

    const input = document.createElement('input');
    input.type = 'text';
    input.value = name;
    input.maxLength = 12;
    input.setAttribute('aria-label', `プレイヤー${i + 1}の名前`);
    input.addEventListener('input', () => {
      setup.players[i] = input.value;
      saveSetup();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-icon';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `${name || `プレイヤー${i + 1}`}を削除`);
    remove.disabled = setup.players.length <= MIN_PLAYERS;
    remove.addEventListener('click', () => {
      setup.players.splice(i, 1);
      saveSetup();
      renderPlayerList();
    });

    li.append(dot, input, remove);
    list.append(li);
  });
  $('add-player-btn').disabled = setup.players.length >= MAX_PLAYERS;
}

function renderSetup() {
  renderPlayerList();
  $('opt-time').value = String(setup.timeLimit);
  $('opt-first').value = setup.firstWord;
  $('opt-long').value = setup.longVowel;
  $('opt-dakuten').checked = setup.ignoreDakuten;
  $('opt-judge').checked = setup.judge;
  $('opt-vibrate').checked = setup.vibrate;
  $('setup-error').textContent = '';
}

function bindSetup() {
  $('add-player-btn').addEventListener('click', () => {
    if (setup.players.length >= MAX_PLAYERS) return;
    setup.players.push(`プレイヤー${setup.players.length + 1}`);
    saveSetup();
    renderPlayerList();
    const inputs = $('player-list').querySelectorAll('input');
    inputs[inputs.length - 1].select();
  });
  $('opt-time').addEventListener('change', (e) => { setup.timeLimit = Number(e.target.value); saveSetup(); });
  $('opt-first').addEventListener('change', (e) => { setup.firstWord = e.target.value; saveSetup(); });
  $('opt-long').addEventListener('change', (e) => { setup.longVowel = e.target.value; saveSetup(); });
  $('opt-dakuten').addEventListener('change', (e) => { setup.ignoreDakuten = e.target.checked; saveSetup(); });
  $('opt-judge').addEventListener('change', (e) => { setup.judge = e.target.checked; saveSetup(); });
  $('opt-vibrate').addEventListener('change', (e) => { setup.vibrate = e.target.checked; saveSetup(); });
  $('start-btn').addEventListener('click', startGame);
}

// ---------- 画面切り替え・共通 ----------

function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== screenId; });
  $('quit-btn').hidden = screenId === 'screen-setup' || screenId === 'screen-result';
  window.scrollTo(0, 0);
}

function vibrate(pattern) {
  if (!setup.vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // 非対応端末では何もしない
  }
}

function setChip(el, player) {
  el.textContent = player.name;
  el.style.setProperty('--player-color', player.color);
}

function renderHistory(list, history, { limit } = {}) {
  list.replaceChildren();
  const items = limit ? history.slice(-limit) : history;
  for (const entry of items) {
    const li = document.createElement('li');
    li.className = 'history-item';
    const player = entry.player === null ? null : game.players[entry.player];
    li.style.setProperty('--player-color', player ? player.color : 'var(--muted)');

    const who = document.createElement('span');
    who.className = 'history-who';
    who.textContent = player ? player.name : 'スタート';

    const word = document.createElement('span');
    word.className = 'history-word';
    word.textContent = entry.word;

    li.append(who, word);
    list.append(li);
  }
  list.scrollTop = list.scrollHeight;
}

// ---------- ゲーム ----------

let game = null;
let timer = null;

function rules() {
  return { longVowel: game.settings.longVowel, ignoreDakuten: game.settings.ignoreDakuten };
}

function startGame() {
  const names = setup.players.map((n) => n.trim());
  if (names.some((n) => n === '')) {
    $('setup-error').textContent = '名前が空のプレイヤーがいます';
    return;
  }
  if (new Set(names).size !== names.length) {
    $('setup-error').textContent = '同じ名前のプレイヤーがいます';
    return;
  }

  game = {
    settings: { ...setup },
    players: names.map((name, i) => ({ name, color: PLAYER_COLORS[i], alive: true, outReason: null })),
    history: [],
    used: new Set(),
    required: '',
    current: 0,
    pendingWord: null,
  };

  if (setup.firstWord === 'shiritori') {
    game.history.push({ word: 'しりとり', player: null });
    game.used.add('しりとり');
    game.required = lastChar('しりとり', rules());
  } else {
    game.required = START_CHARS[Math.floor(Math.random() * START_CHARS.length)];
  }

  showHandoff();
}

function alivePlayers() {
  return game.players.filter((p) => p.alive);
}

function advanceTurn() {
  const n = game.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (game.current + step) % n;
    if (game.players[idx].alive) {
      game.current = idx;
      return;
    }
  }
}

function showHandoff() {
  const player = game.players[game.current];
  setChip($('handoff-name'), player);
  $('handoff-char').textContent = game.required;
  show('screen-handoff');
}

function showTurn() {
  const player = game.players[game.current];
  setChip($('turn-player'), player);
  $('required-char').textContent = game.required;
  $('answer-error').textContent = '';
  typed = '';
  lastTap = null;
  renderTyped();
  renderHistory($('turn-history'), game.history, { limit: 30 });
  show('screen-turn');
  startTimer();
}

// ---------- タイマー ----------

function startTimer() {
  stopTimer();
  const limit = game.settings.timeLimit;
  const bar = $('timer-bar');
  const fill = $('timer-fill');
  const text = $('timer-text');
  bar.hidden = limit === 0;
  text.textContent = '';
  if (limit === 0) return;

  const deadline = performance.now() + limit * 1000;
  let warned = false;

  const tick = () => {
    const remainingMs = Math.max(0, deadline - performance.now());
    const ratio = remainingMs / (limit * 1000);
    const seconds = Math.ceil(remainingMs / 1000);
    fill.style.transform = `scaleX(${ratio})`;
    bar.dataset.level = ratio > 0.5 ? 'ok' : seconds > WARN_SECONDS ? 'warn' : 'danger';
    text.textContent = `残り ${seconds} 秒`;

    if (!warned && seconds <= WARN_SECONDS) {
      warned = true;
      vibrate(80);
    }
    if (remainingMs <= 0) {
      stopTimer();
      vibrate([200, 100, 200]);
      eliminate('time');
    }
  };
  tick();
  timer = setInterval(tick, 100);
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

// ---------- アプリ内キーボード ----------
// 端末のキーボードだと予測変換がヒントになってしまうため、自前のフリックキーボードで入力する

const FLICK_THRESHOLD = 18; // これ以上指が動いたらフリックとみなす(px)
const MULTI_TAP_MS = 1000; // 同じキーの連続タップとみなす間隔

let typed = '';
let lastTap = null; // { key, char, time } 連続タップで文字を進めるための記録
let flick = null; // 押している最中のキーの状態

function renderTyped() {
  const display = $('answer-display');
  display.textContent = typed;
  display.classList.toggle('is-empty', typed === '');
}

function typeChar(c) {
  if (typed.length >= MAX_WORD_LENGTH) return;
  typed += c;
  $('answer-error').textContent = '';
  renderTyped();
}

function tapKey(key) {
  const now = performance.now();
  const center = flickChar(key, 'center');
  if (lastTap && lastTap.key === key && now - lastTap.time < MULTI_TAP_MS && typed.endsWith(lastTap.char)) {
    const next = tapCycleNext(key, lastTap.char);
    typed = typed.slice(0, -1) + next;
    renderTyped();
    lastTap = { key, char: next, time: now };
    return;
  }
  typeChar(center);
  lastTap = { key, char: center, time: now };
}

function cycleLastChar() {
  lastTap = null;
  if (typed === '') return;
  typed = typed.slice(0, -1) + cycleVariant(typed.slice(-1));
  renderTyped();
}

function deleteChar() {
  lastTap = null;
  typed = typed.slice(0, -1);
  $('answer-error').textContent = '';
  renderTyped();
}

function flickDirection(dx, dy) {
  if (Math.hypot(dx, dy) < FLICK_THRESHOLD) return 'center';
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

// 押している間、キーの上下左右に入力候補を十字に表示する
function showFlickGuide(keyEl, key) {
  const guide = $('flick-guide');
  guide.replaceChildren();
  for (const dir of FLICK_DIRECTIONS) {
    const c = flickChar(key, dir);
    const cell = document.createElement('span');
    cell.className = `flick-cell flick-${dir}`;
    cell.dataset.dir = dir;
    cell.textContent = c;
    cell.hidden = c === '';
    guide.append(cell);
  }
  const kb = $('keyboard').getBoundingClientRect();
  const r = keyEl.getBoundingClientRect();
  guide.style.setProperty('--cell-w', `${r.width}px`);
  guide.style.setProperty('--cell-h', `${r.height}px`);
  guide.style.left = `${r.left - kb.left - r.width}px`;
  guide.style.top = `${r.top - kb.top - r.height}px`;
  guide.hidden = false;
  updateFlickGuide('center');
}

function updateFlickGuide(dir) {
  for (const cell of $('flick-guide').children) {
    cell.classList.toggle('is-active', cell.dataset.dir === dir);
  }
}

function hideFlickGuide() {
  $('flick-guide').hidden = true;
}

function bindFlickKey(keyEl, key) {
  keyEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keyEl.setPointerCapture(e.pointerId);
    flick = { keyEl, key, x: e.clientX, y: e.clientY, dir: 'center', pointerId: e.pointerId };
    keyEl.classList.add('is-pressed');
    showFlickGuide(keyEl, key);
  });
  keyEl.addEventListener('pointermove', (e) => {
    if (!flick || flick.pointerId !== e.pointerId) return;
    const dir = flickDirection(e.clientX - flick.x, e.clientY - flick.y);
    // 文字のない方向は無効(タップ扱いにしない)
    flick.dir = dir === 'center' || flickChar(key, dir) !== '' ? dir : null;
    updateFlickGuide(flick.dir);
  });
  const end = (commit) => (e) => {
    if (!flick || flick.pointerId !== e.pointerId) return;
    const { dir } = flick;
    flick = null;
    keyEl.classList.remove('is-pressed');
    hideFlickGuide();
    if (!commit || dir === null) return;
    if (dir === 'center') {
      tapKey(key);
    } else {
      lastTap = null;
      typeChar(flickChar(key, dir));
    }
  };
  keyEl.addEventListener('pointerup', end(true));
  keyEl.addEventListener('pointercancel', end(false));
}

function makeKey(label, className, area) {
  const key = document.createElement('button');
  key.type = 'button';
  key.className = `key ${className}`.trim();
  key.style.gridArea = area;
  key.textContent = label;
  return key;
}

function buildKeyboard() {
  const keyboard = $('keyboard');
  const areas = ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa'];
  Object.keys(FLICK_KEYS).forEach((key, i) => {
    const el = makeKey(key, 'key-char', areas[i]);
    bindFlickKey(el, key);
    keyboard.append(el);
  });

  const del = makeKey('⌫', 'key-func', 'del');
  del.setAttribute('aria-label', '1文字削除');
  del.addEventListener('click', deleteChar);

  const clear = makeKey('全消去', 'key-func key-small', 'clr');
  clear.addEventListener('click', () => {
    lastTap = null;
    typed = '';
    renderTyped();
  });

  const variant = makeKey('゛゜小', 'key-func key-small', 'var');
  variant.setAttribute('aria-label', '濁点・半濁点・小さい文字に切り替え');
  variant.addEventListener('click', cycleLastChar);

  const bar = makeKey('ー', 'key-func', 'bar');
  bar.addEventListener('click', () => { lastTap = null; typeChar('ー'); });

  const enter = makeKey('決定', 'key-enter', 'ent');
  enter.addEventListener('click', submitAnswer);

  const guide = document.createElement('div');
  guide.className = 'flick-guide';
  guide.id = 'flick-guide';
  guide.hidden = true;
  guide.setAttribute('aria-hidden', 'true');

  keyboard.append(del, clear, variant, bar, enter, guide);
}

// ---------- 回答・判定 ----------

function submitAnswer() {
  const result = checkWord(typed, {
    required: game.required,
    used: game.used,
    rules: rules(),
  });

  if (!result.ok) {
    const msg = ERROR_MESSAGES[result.reason];
    showAnswerError(typeof msg === 'function' ? msg(game.required) : msg);
    return;
  }

  stopTimer();
  if (result.endsWithN) {
    eliminate('n', result.word);
    return;
  }
  if (game.settings.judge) {
    showJudge(result.word);
  } else {
    acceptWord(result.word);
  }
}

function showAnswerError(message) {
  const el = $('answer-error');
  el.textContent = message;
  const box = $('answer-box');
  box.classList.remove('shake');
  void box.offsetWidth; // アニメーションを再生し直す
  box.classList.add('shake');
  vibrate(40);
}

function showJudge(word) {
  game.pendingWord = word;
  setChip($('judge-player'), game.players[game.current]);
  $('judge-word').textContent = word;

  const list = $('judge-list');
  list.replaceChildren();
  game.players.forEach((p, i) => {
    if (!p.alive || i === game.current) return;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'judge-toggle';
    btn.style.setProperty('--player-color', p.color);
    btn.dataset.vote = 'ok';
    btn.setAttribute('aria-pressed', 'false');

    const name = document.createElement('span');
    name.textContent = p.name;
    const mark = document.createElement('span');
    mark.className = 'judge-mark';
    mark.textContent = '⭕';

    btn.append(name, mark);
    btn.addEventListener('click', () => {
      const ng = btn.dataset.vote === 'ok';
      btn.dataset.vote = ng ? 'ng' : 'ok';
      btn.setAttribute('aria-pressed', String(ng));
      mark.textContent = ng ? '❌' : '⭕';
    });
    li.append(btn);
    list.append(li);
  });
  show('screen-judge');
}

function decideJudge() {
  const votes = [...$('judge-list').querySelectorAll('.judge-toggle')];
  const ng = votes.filter((b) => b.dataset.vote === 'ng').length;
  const word = game.pendingWord;
  game.pendingWord = null;
  // 反対が過半数のときだけ却下(同数ならセーフ)
  if (ng * 2 > votes.length) {
    eliminate('ng', word);
  } else {
    acceptWord(word);
  }
}

function acceptWord(word) {
  game.history.push({ word, player: game.current });
  game.used.add(word);
  game.required = lastChar(word, rules());
  advanceTurn();
  showHandoff();
}

function eliminate(reason, word) {
  stopTimer();
  const player = game.players[game.current];
  player.alive = false;
  player.outReason = reason;

  setChip($('out-name'), player);
  $('out-reason').textContent = OUT_REASONS[reason](word);
  const remaining = alivePlayers().length;
  if (remaining <= 1) {
    $('out-remaining').textContent = '';
    $('out-btn').textContent = '結果を見る';
  } else {
    $('out-remaining').textContent = `のこり ${remaining} 人`;
    $('out-btn').textContent = '次の人へ';
  }
  show('screen-out');
}

function afterOut() {
  if (alivePlayers().length <= 1) {
    showResult();
    return;
  }
  advanceTurn();
  showHandoff();
}

// ---------- 結果 ----------

function showResult() {
  const winner = alivePlayers()[0];
  setChip($('result-winner'), winner);

  const played = game.history.filter((h) => h.player !== null);
  const longest = played.reduce((best, h) => (!best || h.word.length > best.word.length ? h : best), null);
  const counts = game.players.map((_, i) => played.filter((h) => h.player === i).length);
  const topCount = Math.max(...counts);

  const stats = [
    ['つながった数', `${played.length} 語`],
    ['いちばん長い言葉', longest ? `${longest.word}(${game.players[longest.player].name})` : '—'],
    ['いちばん答えた人', topCount > 0
      ? `${game.players.filter((_, i) => counts[i] === topCount).map((p) => p.name).join('、')}(${topCount} 語)`
      : '—'],
  ];
  const dl = $('result-stats');
  dl.replaceChildren();
  for (const [label, value] of stats) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }

  renderHistory($('result-history'), game.history);
  show('screen-result');
}

function quitGame() {
  if (!confirm('ゲームを中断して設定にもどりますか？')) return;
  stopTimer();
  game = null;
  renderSetup();
  show('screen-setup');
}

// ---------- 起動 ----------

function init() {
  bindSetup();
  renderSetup();
  buildKeyboard();

  $('handoff-btn').addEventListener('click', showTurn);
  // PC で遊ぶとき用に、Backspace と Enter だけ物理キーボードでも受け付ける
  document.addEventListener('keydown', (e) => {
    if ($('screen-turn').hidden || e.isComposing) return;
    if (e.key === 'Backspace') { e.preventDefault(); deleteChar(); }
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  });
  $('giveup-btn').addEventListener('click', () => {
    if (confirm('こうさんしますか？')) eliminate('giveup');
  });
  $('judge-btn').addEventListener('click', decideJudge);
  $('out-btn').addEventListener('click', afterOut);
  $('again-btn').addEventListener('click', startGame);
  $('back-btn').addEventListener('click', () => { game = null; renderSetup(); show('screen-setup'); });
  $('quit-btn').addEventListener('click', quitGame);

  // ゲーム中に誤ってページを閉じないように
  window.addEventListener('beforeunload', (e) => {
    if (game && $('screen-result').hidden) e.preventDefault();
  });

  show('screen-setup');
}

init();
