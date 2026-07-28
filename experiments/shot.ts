// 実物を測る。姿(シャープでスリム)と、下限が効いたときの寸法を見る。
import { chromium } from 'playwright-core';
const exe = process.env.PW_CHROMIUM!;
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2, locale: 'ja-JP' });
await p.goto('http://localhost:5299/');
await p.waitForSelector('.sc-barchart-bar');
await p.waitForTimeout(500);
const measured = await p.evaluate(() => {
  const out: Record<string, unknown> = {};
  const charts = [...document.querySelectorAll('.sc-barchart')];
  out.charts = charts.length;
  const first = charts[0]!;
  const bars = [...first.querySelectorAll('.sc-barchart-bar')].map((b) => b.getBoundingClientRect());
  out.firstBars = bars.map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`);
  const narrow = document.querySelector('.pg-narrow .sc-barchart')!;
  const nb = [...narrow.querySelectorAll('.sc-barchart-bar')].map((b) => b.getBoundingClientRect());
  out.narrowCount = nb.length;
  out.narrowBar = nb[0] ? `${nb[0].width.toFixed(1)}x${Math.round(nb[0].height)}` : null;
  const scroll = narrow.querySelector('.sc-barchart-scroll') as HTMLElement;
  out.narrowScrolls = scroll.scrollWidth > scroll.clientWidth;
  out.narrowTabindex = scroll.getAttribute('tabindex');
  // 極小と 0
  const tinyChart = charts[4]!;
  const tb = [...tinyChart.querySelectorAll('.sc-barchart-bar')].map((b) => b.getBoundingClientRect().height);
  out.tinyHeights = tb.map((h) => h.toFixed(1));
  // 版面が広がっていないか
  out.pageWidth = document.documentElement.scrollWidth;
  out.viewport = innerWidth;
  return out;
});
console.log(JSON.stringify(measured, null, 1));
await p.screenshot({ path: process.env.OUT + '/charts-full.png', fullPage: true });
await b.close();
