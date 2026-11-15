// Contrôle de bout en bout : node e2e/check.mjs <url> <dossier de captures>
// Nécessite puppeteer-core (hors package.json : npm i --no-save puppeteer-core) et un Chrome (CHROME=/usr/bin/google-chrome).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const pp = process.env.PUPPETEER ?? 'puppeteer-core';
const { default: puppeteer } = await import(pp);
const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
const errs = [];
const bad = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const small = (p) => p.evaluate(() => [...document.querySelectorAll('button,input,[role=tab]')].filter((x) => x.offsetParent).map((x) => { const r = x.getBoundingClientRect(); return { id: x.id || x.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), r: Math.round(innerWidth - r.right), b: Math.round(innerHeight - r.bottom), clipped: !!x.closest('#items,#gadgets,#slot-tabs') }; }));
for (const [w, h] of [[568, 320], [844, 390], [1440, 720], [390, 844]]) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, hasTouch: w < 900, isMobile: w < 900 });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${w}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`${w}: ${e.message}`));
  await p.goto(url, { waitUntil: 'load' });
  await wait(600);
  await p.screenshot({ path: join(out, `titre-${w}.png`) });
  const check = async (label) => {
    for (const x of await small(p)) {
      if (x.w < 44 || x.h < 44) if (!/^(range|o-volume)/.test(x.id) && x.id !== '') bad.push(`${w} ${label} ${x.id} ${x.w}x${x.h}`);
      if (!x.clipped && (x.l < 24 || x.t < 24 || x.r < 24 || x.b < 24)) bad.push(`${w} ${label} ${x.id} bord ${x.l}/${x.t}/${x.r}/${x.b}`);
    }
    for (const pl of await p.evaluate(() => [...document.querySelectorAll('.plaque')].filter((x) => x.offsetParent).map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(innerWidth - r.right), Math.round(innerHeight - r.bottom)]; }))) if (pl.some((v) => v < 24)) bad.push(`${w} ${label} plaque trop près du bord ${pl}`);
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight]);
    if (sw[0] > sw[2] || sw[1] > sw[3]) bad.push(`${w} ${label} défilement ${sw}`);
  };
  const portrait = h > w;
  const rot = await p.evaluate(() => !document.getElementById('s-rotate').hidden);
  if (portrait !== rot) bad.push(`${w}: écran « Tourne ton téléphone » ${rot} pour portrait=${portrait}`);
  if (portrait) { await p.close(); continue; }
  await check('titre');
  await p.click('#b-play');
  await wait(300);
  await p.screenshot({ path: join(out, `pret-${w}.png`) });
  await p.mouse.move(w * 0.5, h * 0.5);
  await p.mouse.down();
  await wait(1500);
  await p.mouse.up();
  await wait(1200);
  await p.mouse.down();
  await wait(1200);
  await p.screenshot({ path: join(out, `jeu-${w}.png`) });
  await check('jeu');
  await p.mouse.up();
  await p.keyboard.press('Escape');
  await wait(200);
  await p.screenshot({ path: join(out, `pause-${w}.png`) });
  await check('pause');
  const paused = await p.evaluate(() => !document.getElementById('s-pause').hidden);
  await p.click(paused ? '#b-quit' : '#b-over-menu');
  for (const [btn, name] of [['#b-shop', 'boutique'], ['#b-missions', 'missions'], ['#b-options', 'options'], ['#b-help', 'aide']]) {
    await p.click(btn); await wait(250);
    if (name === 'boutique') {
      await p.screenshot({ path: join(out, `boutique-gadgets-${w}.png`) });
      await check('gadgets');
      await p.click('#tab-style'); await wait(250);
      await p.click('#items li:nth-child(3) button'); await wait(250);
      await p.screenshot({ path: join(out, `boutique-style-${w}.png`) });
      await check('style');
      await p.click('#b-shop-close');
    } else {
      await p.screenshot({ path: join(out, `${name}-${w}.png`) });
      await check(name);
      await p.keyboard.press('Escape');
    }
    await wait(150);
  }
  // pause automatique à la rotation en portrait
  await p.click('#b-play'); await wait(200);
  console.log(w, 'après Jouer :', await p.evaluate(() => [...document.querySelectorAll('section')].filter((s) => !s.hidden).map((s) => s.id).join() || 'jeu'));
  await p.setViewport({ width: h, height: w, deviceScaleFactor: 2, hasTouch: w < 900, isMobile: w < 900 }); // mêmes réglages : sinon puppeteer recharge la page
  await wait(700);
  const st = await p.evaluate(() => ({ rot: !document.getElementById('s-rotate').hidden, pause: !document.getElementById('s-pause').hidden, vis: [...document.querySelectorAll('section')].filter((s) => !s.hidden).map((s) => s.id).join() }));
  if (!st.rot || !st.pause) bad.push(`${w}: rotation en portrait sans pause ${JSON.stringify(st)}`);
  if (w === 568) await p.screenshot({ path: join(out, 'portrait-568.png') });
  await p.close();
}
await b.close();
console.log('erreurs console:', errs.length ? errs : 'aucune');
console.log('écarts:', bad.length ? bad : 'aucun');
process.exit(errs.length || bad.length ? 1 : 0);
