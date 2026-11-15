// Contrôle visuel V2 (biomes, expressions, particules) : node e2e/visuels.mjs <url du build e2e> <dossier>
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
await p.mouse.move(420, 200); await p.mouse.down();
await wait(200);
const set = (f) => p.evaluate(`(${f})(window.__gf.game())`);
const shot = (n) => p.screenshot({ path: join(out, `${n}.png`) });
await set((g) => { g.invuln = 999; g.t = 30; g.y = 180; g.vy = 0; g.beamKind = 0; });
for (const [d, n] of [[0, 'savane'], [600, 'ville'], [1100, 'espace']]) {
  await set(`(g) => { g.x = ${d * 40 + 5}; g.invuln = 999; }`);
  await wait(900); await shot(`biome-${n}`);
}
await set((g) => { g.x = 5; g.invuln = 0; });
await wait(400); await shot('humeur-normale');
await set((g) => { g.beamKind = 1; g.beamT = 0; g.beamY = 80; g.invuln = 0; });
await wait(500); await shot('humeur-peur');
await set((g) => { g.beamKind = 0; g.invuln = 1.5; });
await wait(300); await shot('humeur-sonnee');
console.log(errs.length ? 'ERREURS ' + errs.join(' | ') : 'aucune erreur console');
await p.close();
b.disconnect ? b.disconnect() : await b.close();
