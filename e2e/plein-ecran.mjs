// Contrôle V2 PR5 : node e2e/plein-ecran.mjs <url du build de production> <dossier>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const pp = process.env.PUPPETEER ?? 'puppeteer-core';
const { default: puppeteer } = await import(pp);
const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = process.env.BROWSER_URL ? await puppeteer.connect({ browserURL: process.env.BROWSER_URL }) : await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const watch = (p) => { p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message)); };
// 1. iPhone : message « Ajouter à l'écran d'accueil », refermable et mémorisé
let ctx = await b.createBrowserContext();
let p = await ctx.newPage(); watch(p);
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await p.goto(url, { waitUntil: 'load' }); await wait(500);
console.log('iPhone : message visible =', await p.evaluate(() => !document.getElementById('s-a2hs').hidden));
await p.screenshot({ path: join(out, 'iphone-a2hs.png') });
await p.click('#b-a2hs-close'); await p.reload({ waitUntil: 'load' }); await wait(400);
console.log('iPhone : après « Compris » + rechargement, visible =', await p.evaluate(() => !document.getElementById('s-a2hs').hidden));
await p.click('#b-options'); await wait(200);
console.log('iPhone : note options =', await p.evaluate(() => document.getElementById('o-full-note').textContent));
await p.screenshot({ path: join(out, 'iphone-options.png') });
await ctx.close();
// 2. Android/Chrome : pas de message ; service worker actif ; hors ligne
ctx = await b.createBrowserContext();
p = await ctx.newPage(); watch(p);
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await p.goto(url, { waitUntil: 'load' }); await wait(1500);
console.log('Android : message iPhone caché =', await p.evaluate(() => document.getElementById('s-a2hs').hidden));
console.log('service worker actif =', await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active));
await p.setOfflineMode(true); await p.reload({ waitUntil: 'load' }); await wait(500);
console.log('hors ligne : le titre s’affiche =', await p.evaluate(() => !!document.getElementById('b-play')));
await p.setOfflineMode(false);
console.log('hauteur app = fenêtre :', await p.evaluate(() => document.getElementById('app').getBoundingClientRect().height === innerHeight));
console.log(errs.length ? 'ERREURS ' + errs.join(' | ') : 'aucune erreur console');
await ctx.close();
b.disconnect ? b.disconnect() : await b.close();
