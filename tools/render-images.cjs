// アイコンと OGP 画像(シェア用)を public/icons/icon.svg から PNG に書き出す。
// 使い方: node tools/render-images.cjs (Playwright と日本語フォントが必要)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(root, 'icons', 'icon.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const icon = (size, { maskable = false } = {}) => `
  <body style="margin:0;background:${maskable ? '#3b5bdb' : 'transparent'}">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
      <img src="${dataUrl}" style="width:${maskable ? size * 0.8 : size}px">
    </div>
  </body>`;

const ogp = `
  <body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box;
               background:#f6f5f2;font-family:'Hiragino Sans','Noto Sans JP','Noto Sans CJK JP',sans-serif;color:#1f2128">
    <img src="${dataUrl}" style="width:300px;flex:none">
    <div>
      <div style="font-size:104px;font-weight:800;letter-spacing:4px">まわしりとり</div>
      <div style="font-size:40px;margin-top:20px;line-height:1.5">声を出さずに、スマホ1台を<br>回して遊ぶしりとり</div>
      <div style="font-size:30px;margin-top:24px;color:#3b5bdb;font-weight:700">国名しりとり・CPU対戦・タイムアタック</div>
    </div>
  </body>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shots = [
    ['icons/icon-192.png', icon(192), 192, 192, true],
    ['icons/icon-512.png', icon(512), 512, 512, true],
    ['icons/maskable-512.png', icon(512, { maskable: true }), 512, 512, false],
    ['icons/apple-touch-icon.png', icon(180, { maskable: true }), 180, 180, false],
    ['ogp.png', ogp, 1200, 630, false],
  ];
  for (const [file, html, width, height, transparent] of shots) {
    await page.setViewportSize({ width, height });
    await page.setContent(html);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(root, file), omitBackground: transparent });
    console.log('wrote', file);
  }
  await browser.close();
})();
