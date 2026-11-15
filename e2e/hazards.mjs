// Contrôle visuel des dangers V2 : node e2e/hazards.mjs <url du build e2e> <dossier>
// Build : npm run build:e2e, servir dist-e2e. Le crochet window.__gf n'existe que dans ce build.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const pp = process.env.PUPPETEER ?? 'puppeteer-core';
const { default: puppeteer } = await import(pp);
const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = process.env.BROWSER_URL ? await puppeteer.connect({ browserURL: process.env.BROWSER_URL }) : await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const p = await b.newPage();
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'load' });
await p.click('#b-play');
await wait(500);
await p.mouse.move(420, 200); await p.mouse.down(); // lance la partie
await wait(200);
const set = (f) => p.evaluate(`(${f})(window.__gf.game())`);
const shot = (n) => p.screenshot({ path: join(out, `${n}.png`) });
await set((g) => { g.invuln = 999; g.t = 20; g.y = 180; g.vy = 0; });
// laser à charge
await set((g) => { g.beamKind = 1; g.beamT = 0; g.beamY = 180; });
await wait(700); await shot('beam-avertissement');
await wait(900); await shot('beam-tir');
await wait(900);
// balayage
await set((g) => { g.beamKind = 2; g.beamT = 0; g.beamY = 200; g.beamY2 = 100; });
await wait(700); await shot('sweep-avertissement');
await wait(1700); await shot('sweep-actif');
await wait(3000);
// météorites, drone, vent
for (const [k, n] of [[2, 'meteores'], [1, 'drone'], [3, 'vent']]) {
  await set(`(g) => { g.evtKind = ${k}; g.evtT = 15; g.beamKind = 0; }`);
  await wait(1500); await shot(`${n}-annonce`);
  await wait(3500); await shot(`${n}-milieu`);
}
const st = await set((g) => ({ mode: g.mode, speed: Math.round(g.speed), evt: g.evtKind, t: Math.round(g.t) }));
console.log(JSON.stringify(st), 'erreurs console :', errs.length ? errs : 'aucune');
await p.mouse.up();
await p.close();
if (process.env.BROWSER_URL) await b.disconnect(); else await b.close();
