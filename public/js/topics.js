// お題(縛り)の定義と判定。答えの一覧を持つお題は、アプリが自動で判定する。
import { START_CHARS, endsWithN, firstChar, lastChar, sameChar, stripDakuten, toHiragana } from './kana.js?v=__VERSION__';

// 国名: 国連加盟国193か国 + 日本が承認している4か国(バチカン・コソボ・クック諸島・ニウエ)。
// 書式は「表示名|読み|別の読み…」。読みを省くと表示名(カタカナ)から作る。
const COUNTRIES = `
アイスランド
アイルランド
アゼルバイジャン
アフガニスタン
アメリカ合衆国|あめりかがっしゅうこく|あめりか|べいこく
アラブ首長国連邦|あらぶしゅちょうこくれんぽう
アルジェリア
アルゼンチン
アルバニア
アルメニア
アンゴラ
アンティグア・バーブーダ
アンドラ
イエメン
イギリス|いぎりす|えいこく
イスラエル
イタリア
イラク
イラン
インド
インドネシア
ウガンダ
ウクライナ
ウズベキスタン
ウルグアイ
エクアドル
エジプト
エストニア
エスワティニ|えすわてぃに|すわじらんど
エチオピア
エリトリア
エルサルバドル
オーストラリア
オーストリア
オマーン
オランダ
ガーナ
カーボベルデ
ガイアナ
カザフスタン
カタール
カナダ
ガボン
カメルーン
ガンビア
カンボジア
ギニア
ギニアビサウ
キプロス
キューバ
ギリシャ|ぎりしゃ|ぎりしあ
キリバス
キルギス
グアテマラ
クウェート
クック諸島|くっくしょとう
グレナダ
クロアチア
ケニア
コートジボワール
コスタリカ
コソボ
コモロ
コロンビア
コンゴ共和国|こんごきょうわこく|こんご
コンゴ民主共和国|こんごみんしゅきょうわこく
サウジアラビア
サモア
サントメ・プリンシペ
ザンビア
サンマリノ
シエラレオネ
ジブチ
ジャマイカ
ジョージア|じょーじあ|ぐるじあ
シリア
シンガポール
ジンバブエ
スイス
スウェーデン
スーダン
スペイン
スリナム
スリランカ
スロバキア
スロベニア
セーシェル
赤道ギニア|せきどうぎにあ
セネガル
セルビア
セントクリストファー・ネービス
セントビンセント及びグレナディーン諸島|せんとびんせんとおよびぐれなでぃーんしょとう|せんとびんせんと
セントルシア
ソマリア
ソロモン諸島|そろもんしょとう
タイ
大韓民国|だいかんみんこく|かんこく
タジキスタン
タンザニア
チェコ
チャド
中央アフリカ|ちゅうおうあふりか
中国|ちゅうごく|ちゅうかじんみんきょうわこく
チュニジア
チリ
ツバル
デンマーク
ドイツ
トーゴ
ドミニカ共和国|どみにかきょうわこく
ドミニカ国|どみにかこく|どみにか
トリニダード・トバゴ
トルクメニスタン
トルコ
トンガ
ナイジェリア
ナウル
ナミビア
ニウエ
ニカラグア
ニジェール
日本|にほん|にっぽん
ニュージーランド
ネパール
ノルウェー
ハイチ
バーレーン
バチカン
パキスタン
パナマ
バヌアツ
バハマ
パプアニューギニア
パラオ
パラグアイ
バルバドス
ハンガリー
バングラデシュ
東ティモール|ひがしてぃもーる
フィジー
フィリピン
フィンランド
ブータン
ブラジル
フランス
ブルガリア
ブルキナファソ
ブルネイ
ブルンジ
ベトナム
ベナン
ベネズエラ
ベラルーシ
ベリーズ
ペルー
ベルギー
ポーランド
ボスニア・ヘルツェゴビナ|ぼすにあへるつぇごびな|ぼすにあ
ボツワナ
ボリビア
ポルトガル
ホンジュラス
マーシャル諸島|まーしゃるしょとう
マダガスカル
マラウイ
マリ
マルタ
マレーシア
ミクロネシア
南アフリカ|みなみあふりか
南スーダン|みなみすーだん
ミャンマー|みゃんまー|びるま
メキシコ
モーリシャス
モーリタニア
モザンビーク
モナコ
モルディブ
モルドバ
モロッコ
モンゴル
モンテネグロ
ヨルダン
ラオス
ラトビア
リトアニア
リビア
リヒテンシュタイン
リベリア
ルーマニア
ルクセンブルク
ルワンダ
レソト
レバノン
ロシア
北朝鮮|きたちょうせん|ちょうせんみんしゅしゅぎじんみんきょうわこく
北マケドニア|きたまけどにあ|まけどにあ
`;

function parseEntries(text) {
  return text.trim().split('\n').map((line, id) => {
    const [name, ...readings] = line.split('|');
    return {
      id,
      name,
      readings: readings.length ? readings : [toHiragana(name.replace(/・/g, ''))],
    };
  });
}

export const TOPICS = {
  free: { label: 'なし(自由)' },
  country: { label: '国名', noun: '国', unit: 'か国', source: COUNTRIES },
};

// お題を使える形にする。自由(一覧なし)なら null。
export function buildTopic(topicId) {
  const def = TOPICS[topicId];
  if (!def || !def.source) return null;
  const entries = parseEntries(def.source);
  const byReading = new Map();
  for (const entry of entries) {
    for (const reading of entry.readings) byReading.set(reading, entry);
  }
  return { id: topicId, label: def.label, noun: def.noun, unit: def.unit, entries, byReading };
}

export function findEntry(topic, word) {
  return topic.byReading.get(word) ?? null;
}

// まだ出ていない答えのうち、その文字から始まる読みを持つもの
export function remainingStarting(topic, usedIds, char, rules) {
  return topic.entries.filter((e) => !usedIds.has(e.id)
    && e.readings.some((r) => sameChar(firstChar(r), char, rules)));
}

// 濁点・半濁点を外せば続けられるなら、その文字を返す(ご → こ)。続けられなければ null。
export function relaxChar(topic, usedIds, char, rules) {
  const plain = stripDakuten(char);
  if (plain === char) return null;
  return remainingStarting(topic, usedIds, plain, rules).length > 0 ? plain : null;
}

// 答えられなかった人に「まだこんな答えがあった」と見せる例。
// 「ん」で終わらない(=答えれば続けられた)ものから最大 count 件をランダムに選ぶ。
// 戻り値: { examples: ['リトアニア', '日本(にっぽん)', …], total: 候補の総数 }
export function suggestAnswers(topic, usedIds, char, rules, count = 3, random = Math.random) {
  const candidates = [];
  for (const entry of topic.entries) {
    if (usedIds.has(entry.id)) continue;
    const reading = entry.readings.find((r) => sameChar(firstChar(r), char, rules) && !endsWithN(r, rules));
    if (!reading) continue;
    // 表示名から読みがわからないとき(漢字や別の呼び方)は読みを添える
    const plain = toHiragana(entry.name.replace(/・/g, '')) === reading;
    candidates.push(plain ? entry.name : `${entry.name}(${reading})`);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return { examples: candidates.slice(0, count), total: candidates.length };
}

// 「詰みの答え」: 答えた時点で、その終わりの文字から始まる答えが1つもないもの(国名ならトーゴ・スリナムなど)。
// 戻り値: [{ char: 'ご', names: ['コンゴ共和国', 'トーゴ', …] }, …](一覧の順)
export function deadEndAnswers(topic, rules) {
  const byChar = new Map();
  for (const entry of topic.entries) {
    for (const reading of entry.readings) {
      if (endsWithN(reading, rules)) continue;
      const c = lastChar(reading, rules);
      if (remainingStarting(topic, new Set(), c, rules).length > 0) continue;
      if (!byChar.has(c)) byChar.set(c, []);
      if (!byChar.get(c).includes(entry.name)) byChar.get(c).push(entry.name);
    }
  }
  return [...byChar].map(([char, names]) => ({ char, names }));
}

// まだ答えが残っている文字からランダムに1つ選ぶ。残っていなければ null。
export function pickPlayableChar(topic, usedIds, rules, random = Math.random) {
  const chars = START_CHARS.filter((c) => remainingStarting(topic, usedIds, c, rules).length > 0);
  return chars.length ? chars[Math.floor(random() * chars.length)] : null;
}
