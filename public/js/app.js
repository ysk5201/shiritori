import { START_CHARS, FLICK_DIRECTIONS, FLICK_KEYS, checkWord, cycleVariant, flickChar, lastChar, tapCycleNext } from './kana.js?v=__VERSION__';
import { buildTopic, findEntry, pickPlayableChar, relaxChar, remainingStarting, suggestAnswers } from './topics.js?v=__VERSION__';
import { CPU_LEVELS, cpuAnswer } from './cpu.js?v=__VERSION__';

const STORAGE_KEY = 'shiritori:setup:v1';
const BEST_KEY = 'shiritori:best:v1';
const TIME_ATTACK_SECONDS = 60;
const SOLO_TOPIC = 'country'; // 1人用は答えの一覧があるお題で遊ぶ
const CPU_COLOR = '#868e96';
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
  notInTopic: (label) => `${label}にないみたい(別の呼び方も試してみて)`,
  topicUsed: (label) => `その${label}はもう出たよ`,
};

const OUT_REASONS = {
  n: (word) => `「${word}」は「ん」で終わっちゃった…`,
  time: () => '時間切れ…',
  ng: (word) => `「${word}」はみんなに認められなかった…`,
  giveup: () => 'こうさん…',
};

const $ = (id) => document.getElementById(id);

const SOLO_HELP = {
  cpu: 'CPUと交互に国名をつなぎます。',
  timeattack: '60秒で何か国つなげられるか挑戦します。「ん」で終わる国は使えません。',
};

const DEADEND_HELP = {
  relax: '続く答えがない文字になったら、濁点を外して続けます(ご→こ)。それでもなければランダムに引き直します',
  stuck: '続く答えがない文字で終わる答えを出すと、次の人が脱落します(例: 国名で「トーゴ」)',
};

// ---------- 設定 ----------

const defaultSetup = () => ({
  playMode: 'group', // 'group' 1台を回す / 'solo' 1人用
  soloMode: 'cpu', // 'cpu' CPU対戦 / 'timeattack' タイムアタック
  cpuLevel: 'normal',
  players: ['プレイヤー1', 'プレイヤー2'],
  topic: 'free',
  deadEnd: 'relax', // 続く答えがない文字になったとき: 'relax' 濁点を外す→引き直し / 'stuck' 次の人が脱落
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

// 遊び方(みんなで / 1人で)に合わせて、関係のある設定だけを見せる
function renderSetupVisibility() {
  const solo = setup.playMode === 'solo';
  const timeAttack = solo && setup.soloMode === 'timeattack';
  $('mode-group').setAttribute('aria-pressed', String(!solo));
  $('mode-solo').setAttribute('aria-pressed', String(solo));
  $('players-card').hidden = solo;
  $('solo-card').hidden = !solo;
  $('opt-level-field').hidden = timeAttack;
  $('solo-help').textContent = `${SOLO_HELP[setup.soloMode]}お題は「国名」で遊びます。`;
  $('opt-topic-field').hidden = solo;
  $('opt-judge-field').hidden = solo;
  $('opt-time-field').hidden = timeAttack;
  $('opt-deadend-field').hidden = timeAttack || (!solo && setup.topic === 'free');
}

function renderSetup() {
  renderPlayerList();
  $('opt-solo').value = setup.soloMode;
  $('opt-level').value = setup.cpuLevel;
  $('opt-topic').value = setup.topic;
  $('opt-deadend').value = setup.deadEnd;
  $('deadend-help').textContent = DEADEND_HELP[setup.deadEnd];
  renderSetupVisibility();
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
  for (const [id, mode] of [['mode-group', 'group'], ['mode-solo', 'solo']]) {
    $(id).addEventListener('click', () => {
      setup.playMode = mode;
      saveSetup();
      $('setup-error').textContent = '';
      renderSetupVisibility();
    });
  }
  $('opt-solo').addEventListener('change', (e) => { setup.soloMode = e.target.value; saveSetup(); renderSetupVisibility(); });
  $('opt-level').addEventListener('change', (e) => { setup.cpuLevel = e.target.value; saveSetup(); });
  $('opt-topic').addEventListener('change', (e) => {
    setup.topic = e.target.value;
    saveSetup();
    renderSetupVisibility();
  });
  $('opt-deadend').addEventListener('change', (e) => {
    setup.deadEnd = e.target.value;
    saveSetup();
    $('deadend-help').textContent = DEADEND_HELP[setup.deadEnd];
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

    // お題の答えは正式な名前も添える(あめりか → アメリカ合衆国)
    if (entry.label) {
      const label = document.createElement('span');
      label.className = 'history-label';
      label.textContent = entry.label;
      li.append(label);
    }

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

function buildPlayers() {
  if (setup.playMode === 'solo') {
    const players = [{ name: 'あなた', color: PLAYER_COLORS[1] }];
    if (setup.soloMode === 'cpu') {
      players.push({ name: `CPU(${CPU_LEVELS[setup.cpuLevel].label})`, color: CPU_COLOR, isCpu: true });
    }
    return players;
  }
  const names = setup.players.map((n) => n.trim());
  if (names.some((n) => n === '')) {
    $('setup-error').textContent = '名前が空のプレイヤーがいます';
    return null;
  }
  if (new Set(names).size !== names.length) {
    $('setup-error').textContent = '同じ名前のプレイヤーがいます';
    return null;
  }
  return names.map((name, i) => ({ name, color: PLAYER_COLORS[i] }));
}

function startGame() {
  const players = buildPlayers();
  if (!players) return;
  const solo = setup.playMode === 'solo';
  const settings = solo ? { ...setup, topic: SOLO_TOPIC, judge: false } : { ...setup };

  clearCpuTimer();
  game = {
    settings,
    // 'group' 1台を回す / 'cpu' CPU対戦 / 'timeattack' タイムアタック
    mode: solo ? setup.soloMode : 'group',
    players: players.map((p) => ({ ...p, alive: true, outReason: null })),
    history: [],
    used: new Set(),
    required: '',
    current: 0,
    pendingWord: null,
    topic: buildTopic(settings.topic),
    usedTopicIds: new Set(),
    missed: [], // 答えられずに脱落したときの「まだこんな答えがあった」(結果画面で見せる)
    notice: '',
    deadline: null, // タイムアタックの終了時刻(最初の回答画面で決める)
    cpuTimer: null,
  };

  if (setup.firstWord === 'shiritori') {
    game.history.push({ word: 'しりとり', player: null });
    game.used.add('しりとり');
    game.required = lastChar('しりとり', rules());
  } else if (game.topic) {
    game.required = pickPlayableChar(game.topic, game.usedTopicIds, rules());
  } else {
    game.required = START_CHARS[Math.floor(Math.random() * START_CHARS.length)];
  }

  nextTurn({ advance: false });
}

// 次の人の番へ。お題の答えがもう残っていない文字(行き止まり)になったときは、
// 「作戦」ルールなら次の人が脱落、それ以外は濁点を外すか、残っている文字に引き直す。
// allowStuck: 直前の答えで行き止まりになったとき true(脱落のあとの引き直しでは false)
function nextTurn({ advance = true, allowStuck = true } = {}) {
  if (advance) advanceTurn();
  game.notice = '';
  if (game.topic && remainingCount() === 0) {
    if (allowStuck && game.settings.deadEnd === 'stuck' && game.mode !== 'timeattack') {
      eliminate('stuck');
      return;
    }
    const dead = game.required;
    const relaxed = relaxChar(game.topic, game.usedTopicIds, dead, rules());
    const next = relaxed ?? pickPlayableChar(game.topic, game.usedTopicIds, rules());
    if (next === null) {
      showResult();
      return;
    }
    game.notice = relaxed
      ? `「${dead}」で始まる${game.topic.label}はもうないので、濁点を外して「${next}」から始めます`
      : `「${dead}」で始まる${game.topic.label}はもうないので、「${next}」から始めます`;
    game.required = next;
  }
  // 1人用は手渡しがないので、そのまま回答画面へ
  if (game.mode === 'group') showHandoff();
  else showTurn();
}

function remainingCount() {
  return remainingStarting(game.topic, game.usedTopicIds, game.required, rules()).length;
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
  $('handoff-topic').textContent = game.topic ? game.topic.label : '言葉';
  $('handoff-notice').textContent = game.notice;
  $('handoff-notice').hidden = game.notice === '';
  show('screen-handoff');
}

function showTurn() {
  const player = game.players[game.current];
  setChip($('turn-player'), player);
  if (game.mode === 'timeattack') $('turn-player').textContent = `${answeredCount()} ${game.topic.unit}`;
  $('turn-notice').textContent = game.notice;
  $('turn-notice').hidden = game.mode === 'group' || game.notice === '';
  $('giveup-btn').textContent = game.mode === 'timeattack' ? '終了' : 'こうさん';
  $('giveup-btn').hidden = !!player.isCpu;
  $('keyboard').classList.toggle('is-disabled', !!player.isCpu);
  $('required-char').textContent = game.required;
  $('required-label').textContent = `から始まる${game.topic ? game.topic.label : '言葉'}`;
  $('topic-hint').hidden = !game.topic;
  if (game.topic) {
    $('topic-hint').textContent = `お題「${game.topic.label}」・「${game.required}」で始まるのは残り ${remainingCount()} ${game.topic.unit}`;
  }
  $('answer-error').textContent = '';
  typed = '';
  lastTap = null;
  $('answer-display').classList.remove('is-thinking');
  renderTyped();
  renderHistory($('turn-history'), game.history, { limit: 30 });
  show('screen-turn');
  if (player.isCpu) {
    playCpuTurn();
  } else {
    startTimer();
  }
}

function answeredCount() {
  return game.history.filter((h) => h.player !== null).length;
}

// ---------- CPU ----------

function clearCpuTimer() {
  if (game?.cpuTimer) clearTimeout(game.cpuTimer);
}

// 少し考えるふりをしてから答える
function playCpuTurn() {
  stopTimer();
  $('timer-bar').hidden = true;
  $('timer-text').textContent = '';
  $('answer-display').textContent = '考え中…';
  $('answer-display').classList.replace('is-empty', 'is-thinking');
  const thinkMs = 900 + Math.random() * 900;
  game.cpuTimer = setTimeout(() => {
    const move = cpuAnswer(game.topic, game.usedTopicIds, game.required, rules(), game.settings.cpuLevel, {
      stuckWins: game.settings.deadEnd === 'stuck',
    });
    $('answer-display').classList.remove('is-thinking');
    if (!move) {
      eliminate('giveup');
      return;
    }
    typed = move.word;
    renderTyped();
    game.cpuTimer = setTimeout(() => {
      if (lastChar(move.word, rules()) === 'ん') eliminate('n', move.word);
      else acceptWord(move.word, move.entry);
    }, 800);
  }, thinkMs);
}

// ---------- タイマー ----------

// 1回ごとの制限時間。タイムアタックは全体で60秒(回答のたびにリセットしない)。
function startTimer() {
  stopTimer();
  const timeAttack = game.mode === 'timeattack';
  const limit = timeAttack ? TIME_ATTACK_SECONDS : game.settings.timeLimit;
  const bar = $('timer-bar');
  const fill = $('timer-fill');
  const text = $('timer-text');
  bar.hidden = limit === 0;
  text.textContent = '';
  if (limit === 0) return;

  if (timeAttack) game.deadline ??= performance.now() + limit * 1000;
  const deadline = timeAttack ? game.deadline : performance.now() + limit * 1000;
  let warned = deadline - performance.now() <= WARN_SECONDS * 1000;

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
      if (timeAttack) finishTimeAttack();
      else eliminate('time');
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

  // お題ありなら一覧と照らして自動で判定する(一覧にない答えは入れ直し)
  let entry = null;
  if (game.topic) {
    entry = findEntry(game.topic, result.word);
    if (!entry) {
      showAnswerError(ERROR_MESSAGES.notInTopic(game.topic.label));
      return;
    }
    if (game.usedTopicIds.has(entry.id)) {
      showAnswerError(ERROR_MESSAGES.topicUsed(game.topic.label));
      return;
    }
  }

  if (result.endsWithN && game.mode === 'timeattack') {
    showAnswerError('「ん」で終わる国は使えないよ');
    return;
  }

  stopTimer();
  if (result.endsWithN) {
    eliminate('n', result.word);
    return;
  }
  if (entry) {
    acceptWord(result.word, entry);
  } else if (game.settings.judge) {
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

function acceptWord(word, entry = null) {
  game.history.push({ word, player: game.current, label: entry?.name });
  game.used.add(word);
  if (entry) game.usedTopicIds.add(entry.id);
  game.required = lastChar(word, rules());
  nextTurn();
}

// その場で見せると次の人へのヒントになるので、記録だけして結果画面で見せる
function recordMissed() {
  if (!game.topic || game.players[game.current].isCpu) return;
  const { examples, total } = suggestAnswers(game.topic, game.usedTopicIds, game.required, rules());
  if (total > 0) game.missed.push({ player: game.current, char: game.required, examples, total });
}

function eliminate(reason, word) {
  stopTimer();
  clearCpuTimer();
  const player = game.players[game.current];
  player.alive = false;
  player.outReason = reason;
  // 詰み(stuck)はそもそも答えが残っていないので対象外
  if (reason !== 'stuck') recordMissed();

  setChip($('out-name'), player);
  $('out-reason').textContent = reason === 'stuck' ? stuckReason() : OUT_REASONS[reason](word);
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

// 「作戦」ルールで行き止まりにされたときの説明
function stuckReason() {
  const last = game.history[game.history.length - 1];
  const by = last && last.player !== null ? `(${game.players[last.player].name}さんの「${last.word}」で詰み)` : '';
  return `「${game.required}」で始まる${game.topic.label}がもう残っていない…${by}`;
}

function finishTimeAttack() {
  stopTimer();
  recordMissed();
  showResult();
}

function afterOut() {
  if (alivePlayers().length <= 1) {
    showResult();
    return;
  }
  nextTurn({ allowStuck: false });
}

// ---------- 結果 ----------

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveBest(best) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // 保存できない環境では記録を残さない
  }
}

function showTimeAttackResult() {
  const score = answeredCount();
  const best = loadBest();
  const key = `timeattack:${game.settings.topic}`;
  const prev = best[key] ?? 0;
  const isNew = score > prev;
  if (isNew) saveBest({ ...best, [key]: score });

  $('result-label').textContent = isNew && score > 0 ? 'タイムアタック 🎉 自己ベスト更新！' : 'タイムアタック(60秒)';
  $('result-winner').textContent = `${score} ${game.topic.unit}`;
  $('result-winner').style.setProperty('--player-color', 'var(--primary)');

  const played = game.history.filter((h) => h.player !== null);
  const longest = played.reduce((b, h) => (!b || h.word.length > b.word.length ? h : b), null);
  return [
    ['自己ベスト', `${Math.max(score, prev)} ${game.topic.unit}`],
    ['いちばん長い国名', longest ? longest.label : '—'],
  ];
}

function showResult() {
  stopTimer();
  clearCpuTimer();
  $('again-btn').textContent = game.mode === 'group' ? '同じメンバーでもう一度' : 'もう一度';
  if (game.mode === 'timeattack') {
    renderStats(showTimeAttackResult());
    renderMissed();
    renderHistory($('result-history'), game.history);
    show('screen-result');
    return;
  }
  const alive = alivePlayers();
  if (alive.length === 1) {
    $('result-label').textContent = '勝者';
    setChip($('result-winner'), alive[0]);
  } else {
    // お題の答えを出し尽くしたときは、残っている全員の引き分け
    $('result-label').textContent = `${game.topic.label}を出し尽くして引き分け！`;
    $('result-winner').textContent = alive.map((p) => p.name).join('・');
    $('result-winner').style.setProperty('--player-color', 'var(--primary)');
  }

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
  renderStats(stats);
  renderMissed();
  renderHistory($('result-history'), game.history);
  show('screen-result');
}

function renderStats(stats) {
  const dl = $('result-stats');
  dl.replaceChildren();
  for (const [label, value] of stats) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }
}

function renderMissed() {
  const list = $('result-missed');
  list.replaceChildren();
  $('result-missed-card').hidden = game.missed.length === 0;
  for (const m of game.missed) {
    const li = document.createElement('li');
    li.className = 'missed-item';
    li.style.setProperty('--player-color', game.players[m.player].color);

    const head = document.createElement('p');
    head.className = 'missed-head';
    head.textContent = `${game.players[m.player].name}「${m.char}」`;

    const body = document.createElement('p');
    body.className = 'missed-body';
    const rest = m.total - m.examples.length;
    body.textContent = m.examples.join('、') + (rest > 0 ? ` ほか ${rest} ${game.topic.unit}` : '');

    li.append(head, body);
    list.append(li);
  }
}

function quitGame() {
  if (!confirm('ゲームを中断して設定にもどりますか？')) return;
  stopTimer();
  clearCpuTimer();
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
    if ($('screen-turn').hidden || e.isComposing || game?.players[game.current].isCpu) return;
    if (e.key === 'Backspace') { e.preventDefault(); deleteChar(); }
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  });
  $('giveup-btn').addEventListener('click', () => {
    if (game.mode === 'timeattack') {
      if (confirm('ここで終了しますか？')) finishTimeAttack();
    } else if (confirm('こうさんしますか？')) {
      eliminate('giveup');
    }
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
