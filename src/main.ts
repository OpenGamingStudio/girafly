import './style.css';
import { Loadout, drawGigi, drawThumb } from './art';
import { Sound } from './audio';
import {
  ITEMS, Item, NONE, freeIds, SLOTS, SLOT_LABEL, Slot, UPGRADES, isUnlocked, itemById, itemsOf, unlockText,
} from './catalog';
import { DT, H, MAX_DPR } from './config';
import { render } from './render';
import { BONUSES, DANGERS, bonusInfo } from './info';
import { ICONS } from './icons';
import { boom, clearFx, coinBurst, dust, smoke, sparks, updateFx } from './fx';
import { PY_MAX } from './geom';
import { TUTO_KIND, applyRun, missionText } from './missions';
import { Save, load, localStore, persist } from './save';
import {
  EV_BALLOON_END, EV_BEAM, EV_BONUS, EV_EVENT, EV_EVENT_END, EVENT_NAMES, EV_COIN, EV_DEAD, EV_GRAZE, EV_HIT, EV_WARN, Game, perksFor,
} from './sim';

const $ = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} manquant`);
  return e as T;
};
const store = localStore();
const save: Save = load(store);
const flush = () => persist(store, save);
const sound = new Sound();
sound.on = save.options.sound;
sound.volume = save.options.volume;

const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d', { alpha: false })!;
const live = $('live');
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => save.options.reduceMotion ?? mq.matches;
const applyMotion = () => document.documentElement.classList.toggle('reduce', reduced());

type Screen = 'title' | 'ready' | 'play' | 'pause' | 'over' | 'shop' | 'missions' | 'options' | 'help';
let screen: Screen = 'title';
let prevScreen: Screen = 'title';
const panels: Partial<Record<Screen, HTMLElement>> = {
  title: $('s-title'), pause: $('s-pause'), over: $('s-over'), shop: $('s-shop'),
  missions: $('s-missions'), options: $('s-options'), help: $('s-help'),
};
const hud = $('hud');
const rotate = $('s-rotate');

function say(t: string): void {
  live.textContent = '';
  window.setTimeout(() => { live.textContent = t; }, 30);
}

function show(s: Screen, focusId?: string): void {
  prevScreen = screen;
  screen = s;
  for (const [k, el] of Object.entries(panels)) if (el) el.hidden = k !== s;
  hud.hidden = !(s === 'ready' || s === 'play' || s === 'pause');
  $('hud-ready').hidden = s !== 'ready';
  if (focusId) window.setTimeout(() => $(focusId).focus(), 0);
  else if (s === 'ready' || s === 'play') (document.activeElement as HTMLElement | null)?.blur();
}

// ---------- Taille du canvas (DPR plafonné, visualViewport) ----------
let scale = 1;
let viewW = 640;
function resize(): void {
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = canvas.height / H;
  viewW = canvas.width / scale;
  game.setView(viewW);
  demo.setView(viewW);
  const portrait = h > w;
  rotate.hidden = !portrait;
  if (portrait && (screen === 'play' || screen === 'ready')) pause();
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// ---------- Parties ----------
const loadout = (): Loadout => save.equipped;
const makeGame = () => new Game((Math.random() * 2 ** 31) | 0, perksFor(save.upgrades));
let game = makeGame(); // partie
let demo = makeGame(); // fond animé du menu
let held = false;
let shake = 0;
let happy = 0; // secondes de joie après une pièce
let smokeT = 0;
let flash = 0;
let nextMilestone = 100;

function startRun(): void {
  game = makeGame();
  clearFx();
  happy = 0;
  game.setView(viewW);
  nextMilestone = 100;
  held = false;
  lastDist = -1; lastCoins = -1; lastRatio = [-1, -1, -1]; bannerT = 0; elBanner.hidden = true;
  show('ready');
  paintHud();
  say('Maintiens l’écran pour décoller.');
}

function pause(): void {
  if (screen === 'play' || screen === 'ready') {
    held = false;
    show('pause', 'b-resume');
  }
}
function resume(): void {
  show(game.t > 0 ? 'play' : 'ready');
}

function endRun(): void {
  const st = { dist: game.dist, coins: game.coins, grazes: game.grazes, bonuses: game.bonuses, balloons: game.balloons };
  const newRecord = st.dist > save.bestDist;
  const r = applyRun(save.missions, st, save.missionSeed + save.games * 3, save.missionsDone);
  const bonus = r.done.reduce((a, m) => a + m.reward, 0);
  save.missions = r.missions;
  save.missionSeed += 3;
  save.missionsDone += r.done.length;
  if (r.done.some((m) => m.kind === TUTO_KIND)) save.tutoDone = true;
  for (const id of freeIds(save.missionsDone)) if (!save.owned.includes(id)) save.owned.push(id);
  save.coins += st.coins + bonus;
  save.totalCoins += st.coins + bonus;
  save.games++;
  save.totalDist += st.dist;
  save.grazes += st.grazes;
  if (newRecord) save.bestDist = st.dist;
  flush();
  $('o-dist').textContent = String(st.dist);
  $('o-best').textContent = String(save.bestDist);
  $('o-coins').textContent = String(st.coins + bonus);
  $('o-record').hidden = !newRecord;
  $('o-extra').textContent = st.grazes ? `${st.grazes} laser${st.grazes > 1 ? 's' : ''} frôlé${st.grazes > 1 ? 's' : ''} !` : '';
  const ul = $('o-missions');
  ul.textContent = '';
  for (const m of r.done) {
    const li = document.createElement('li');
    li.className = 'rounded-xl border-[3px] border-ink bg-sun px-3 py-1 font-bold';
    li.textContent = `Mission accomplie : ${missionText(m)} (+${m.reward} pièces)`;
    ul.appendChild(li);
  }
  show('over', 'b-again');
  say(`Partie terminée. ${st.dist} mètres, ${st.coins} pièces.${newRecord ? ' Nouveau record !' : ''}${r.done.length ? ` ${r.done.length} mission accomplie.` : ''}`);
}

// ---------- HUD ----------
let lastDist = -1, lastCoins = -1;
const elDist = $('hud-dist'), elCoins = $('hud-coins'), elBonus = $('hud-bonus');
function paintHud(): void {
  if (game.dist !== lastDist) { lastDist = game.dist; elDist.textContent = String(lastDist); }
  if (game.coins !== lastCoins) { lastCoins = game.coins; elCoins.textContent = String(lastCoins); }
  paintBonus();
}

// Bonus actifs : une pastille par type (icône, nom, jauge de durée restante).
const bonusChips = BONUSES.map((bi) => {
  const li = document.createElement('li');
  li.className = 'bchip';
  li.hidden = true;
  li.insertAdjacentHTML('afterbegin', ICONS[bi.icon]);
  const box = document.createElement('span');
  box.className = 'min-w-0 flex-1';
  const nm = document.createElement('span');
  nm.className = 'nm';
  nm.textContent = bi.name;
  box.appendChild(nm);
  let bar: HTMLElement | null = null;
  if (bi.kind !== 0) {
    const g = document.createElement('span');
    g.className = 'gauge mt-1';
    bar = document.createElement('i');
    g.appendChild(bar);
    box.appendChild(g);
  }
  li.appendChild(box);
  elBonus.appendChild(li);
  return { li, bar };
});
let lastRatio = [-1, -1, -1];
function paintBonus(): void {
  const r = [game.shield ? 1 : 0, game.magnetT > 0 ? game.magnetT / game.perks.magnetDur : 0, game.balloonT > 0 ? game.balloonT / game.perks.balloonDur : 0];
  for (let i = 0; i < 3; i++) {
    if (r[i] === lastRatio[i]) continue;
    lastRatio[i] = r[i];
    const c = bonusChips[i];
    c.li.hidden = r[i] <= 0;
    if (c.bar) c.bar.style.width = `${Math.round(r[i] * 100)}%`;
  }
}

let bannerT = 0;
function announceText(name: string, fx: string): void {
  $('bn-icon').textContent = '';
  $('bn-name').textContent = name;
  $('bn-fx').textContent = fx;
  elBanner.hidden = false;
  bannerT = 2;
}
const elBanner = $('hud-banner');
function announce(k: number): void {
  const bi = bonusInfo(k);
  if (!bi) return;
  const ic = $('bn-icon');
  ic.textContent = '';
  ic.insertAdjacentHTML('afterbegin', ICONS[bi.icon]);
  $('bn-name').textContent = bi.name;
  $('bn-fx').textContent = `${bi.fx} · ${bi.dur(game.perks)}`;
  elBanner.hidden = false;
  bannerT = 2.6;
  say(`${bi.name} : ${bi.fx}, ${bi.dur(game.perks)}.`);
}

function onEvents(e: number): void {
  if (e & EV_COIN) { sound.coin(); coinBurst(game.x + 8, game.y - 26, reduced()); happy = 1.2; }
  if (e & EV_BONUS) { sound.bonus(); announce(game.pickK); }
  if (e & EV_GRAZE) { sound.graze(); say('Frôlé !'); }
  if (e & EV_WARN) { sound.warn(); }
  if (e & EV_BEAM) { sound.beam(); shake = Math.max(shake, 0.4); }
  if (e & EV_EVENT) { sound.event(); say(EVENT_NAMES[game.evtKind]); }
  if (e & EV_EVENT_END) { sound.bonus(); say('Événement survécu : pièces bonus !'); }
  if (e & EV_HIT) { sound.shieldBreak(); shake = 1; flash = 1; boom(game.x, game.y - 6, reduced()); sparks(game.x, game.y - 6, 10, reduced()); }
  if (e & EV_BALLOON_END && !(e & EV_HIT)) say('Le ballon s’envole.');
  if (e & EV_BALLOON_END) { announceText('Ballon éclaté', e & EV_HIT ? 'Il a pris le choc pour toi' : 'Fin du vol'); }
  if (e & EV_DEAD) {
    sound.dead(); shake = 1; flash = 1; boom(game.x, game.y - 6, reduced());
    if (navigator.userActivation?.hasBeenActive && navigator.vibrate) navigator.vibrate(60);
  }
}

// ---------- Boucle (pas de temps fixe) ----------
let acc = 0;
let last = performance.now();
let tSec = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tSec += dt;
  const reduce = reduced();
  if (screen === 'play') {
    acc += dt;
    let n = 0;
    let ev = 0;
    while (acc >= DT && n < 6) {
      game.step(held);
      ev |= game.takeEvents();
      acc -= DT;
      n++;
      if (game.mode === 'over') break;
    }
    if (n === 6) acc = 0;
    if (ev) onEvents(ev);
    // fumée du jetpack et poussière au sol
    smokeT -= dt;
    if (smokeT <= 0 && game.mode === 'run') {
      smokeT = reduce ? 0.2 : 0.05;
      if (game.thrusting) smoke(game.x - 20, game.y + 14);
      else if (game.y >= PY_MAX - 2 && !reduce) dust(game.x - 8, game.y + 18);
    }
    happy = Math.max(0, happy - dt);
    if (game.dist >= nextMilestone) { say(`${nextMilestone} mètres`); nextMilestone += 100; }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) elBanner.hidden = true; }
    paintHud();
    if (game.mode === 'over') endRun();
  } else if (screen === 'title' || screen === 'over' || screen === 'shop' || screen === 'missions' || screen === 'options' || screen === 'help') {
    // fond animé : un robot suit la trajectoire garantie
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 3) {
      for (const m of demo.missiles) m.active = false;
      const tg = demo.guideY(demo.x + 50);
      demo.step(demo.y + demo.vy * 0.12 > (tg < 0 ? 200 : tg));
      demo.takeEvents();
      acc -= DT; n++;
      if (demo.mode !== 'run') { demo = makeGame(); demo.setView(viewW); }
    }
    if (n === 3) acc = 0;
  }
  const g = screen === 'play' || screen === 'ready' || screen === 'pause' ? game : demo;
  if (screen !== 'pause') updateFx(dt);
  shake = Math.max(0, shake - dt * 3);
  flash = Math.max(0, flash - dt * 4);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (!reduce && shake > 0) ctx.translate(Math.sin(tSec * 90) * 5 * shake, Math.cos(tSec * 70) * 5 * shake);
  render(ctx, g, loadout(), { w: viewW, reduce, shake, flash, happy }, tSec, loadout().trail);
  if (screen === 'shop' && !$('p-style').hidden) drawPreview();
  requestAnimationFrame(frame);
}

// ---------- Entrées ----------
const down = new Set<number>();
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (screen !== 'play' && screen !== 'ready') return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  down.add(e.pointerId);
  held = true;
  if (screen === 'ready') { show('play'); sound.ui(); }
});
const release = (e: PointerEvent) => { down.delete(e.pointerId); held = down.size > 0 || keyHeld; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let keyHeld = false;
window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
    if (screen === 'play' || screen === 'ready') { pause(); e.preventDefault(); } else if (screen === 'pause') { resume(); e.preventDefault(); }
    return;
  }
  if ((e.code === 'Space' || e.key === 'ArrowUp') && (screen === 'play' || screen === 'ready')) {
    e.preventDefault();
    keyHeld = true;
    held = true;
    if (screen === 'ready') show('play');
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.key === 'ArrowUp') { keyHeld = false; held = down.size > 0; }
});
window.addEventListener('blur', () => { keyHeld = false; held = false; down.clear(); if (screen === 'play') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') pause(); });

// ---------- Boutons ----------
const on = (id: string, fn: () => void) => $(id).addEventListener('click', () => { sound.unlock(); sound.ui(); fn(); });
on('b-play', startRun);
on('b-again', startRun);
on('b-resume', resume);
on('b-quit', () => openTitle());
on('btn-pause', pause);
on('b-over-menu', () => openTitle());
on('b-shop', () => openShop('title'));
on('b-over-shop', () => openShop('over'));
on('b-shop-close', () => openTitle('b-shop'));
on('b-missions', openMissions);
on('b-missions-close', () => openTitle('b-missions'));
on('b-options', openOptions);
on('b-options-close', () => openTitle('b-options'));
let helpFrom: Screen = 'title';
function openHelp(from: Screen): void {
  helpFrom = from;
  paintHelp();
  show('help', 'b-help-close');
}
on('b-help', () => openHelp('title'));
on('b-pause-help', () => openHelp('pause'));
on('b-help-close', () => { if (helpFrom === 'pause') show('pause', 'b-pause-help'); else openTitle('b-help'); });

const countText = (): string => `${save.missionsDone} mission${save.missionsDone > 1 ? 's' : ''}`;
function openTitle(focus = 'b-play'): void {
  $('t-count').textContent = countText();
  $('t-best').textContent = String(save.bestDist);
  $('t-coins').textContent = String(save.coins);
  show('title', focus);
}
// Échap ferme les panneaux
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (screen === 'shop' || screen === 'missions' || screen === 'options' || screen === 'help') openTitle();
});

// ---------- Options ----------
function paintOptions(): void {
  $('o-sound').setAttribute('aria-checked', String(save.options.sound));
  $('o-motion').setAttribute('aria-checked', String(reduced()));
  ($('o-volume') as HTMLInputElement).value = String(Math.round(save.options.volume * 100));
}
function openOptions(): void { paintOptions(); show('options', 'o-sound'); }
$('o-sound').addEventListener('click', () => {
  save.options.sound = !save.options.sound; sound.on = save.options.sound; flush(); paintOptions(); sound.unlock(); sound.ui();
});
$('o-motion').addEventListener('click', () => {
  save.options.reduceMotion = !reduced(); flush(); applyMotion(); paintOptions();
});
$('o-volume').addEventListener('input', (e) => {
  save.options.volume = Number((e.target as HTMLInputElement).value) / 100; sound.setVolume(save.options.volume); flush();
});

// ---------- Missions ----------
function openMissions(): void {
  $('m-count').textContent = countText();
  const ul = $('m-list');
  ul.textContent = '';
  for (const m of save.missions) {
    const li = document.createElement('li');
    li.className = 'rounded-xl border-[3px] border-ink bg-white px-3 py-2';
    const t = document.createElement('p');
    t.className = 'font-bold';
    t.textContent = missionText(m);
    const p = document.createElement('p');
    p.className = 'text-sm';
    p.textContent = `${m.progress} / ${m.target} · récompense : ${m.reward} pièces`;
    li.append(t, p);
    ul.appendChild(li);
  }
  show('missions', 'b-missions-close');
}

// ---------- Tuto ----------
function helpRow(icon: string, name: string, text: string, tag?: string): HTMLElement {
  const li = document.createElement('li');
  li.className = 'row';
  const ic = document.createElement('span');
  ic.className = 'ico';
  ic.insertAdjacentHTML('afterbegin', icon);
  const p = document.createElement('p');
  const b = document.createElement('b');
  b.textContent = name;
  p.append(b);
  if (tag) { const t = document.createElement('span'); t.className = 'tag ml-2'; t.textContent = tag; p.append(t); }
  const d = document.createElement('span');
  d.className = 'block';
  d.textContent = text;
  p.append(d);
  li.append(ic, p);
  return li;
}
function paintHelp(): void {
  const pk = perksFor(save.upgrades);
  const lb = $('help-bonus'), ld = $('help-danger');
  lb.textContent = ''; ld.textContent = '';
  for (const b of BONUSES) lb.append(helpRow(ICONS[b.icon], b.name, b.long, b.dur(pk)));
  for (const d of DANGERS) ld.append(helpRow(ICONS[d.icon], d.name, d.text));
}

// ---------- Boutique ----------
let shopTab: 'gadgets' | 'style' = 'gadgets';
let slot: Slot = 'coat';
let selected: Item | null = null;
let shopFrom: Screen = 'title';
const unl = () => ({ missionsDone: save.missionsDone });

function openShop(from: Screen): void {
  shopFrom = from;
  void shopFrom;
  show('shop', 'tab-gadgets');
  paintShop();
}
function setTab(t: 'gadgets' | 'style'): void {
  shopTab = t;
  paintShop();
}
$('tab-gadgets').addEventListener('click', () => setTab('gadgets'));
$('tab-style').addEventListener('click', () => setTab('style'));

function paintShop(): void {
  $('shop-coins').textContent = String(save.coins);
  $('tab-gadgets').setAttribute('aria-selected', String(shopTab === 'gadgets'));
  $('tab-style').setAttribute('aria-selected', String(shopTab === 'style'));
  $('p-gadgets').hidden = shopTab !== 'gadgets';
  $('p-style').hidden = shopTab !== 'style';
  if (shopTab === 'gadgets') paintGadgets(); else paintStyle();
}

function paintGadgets(): void {
  const ul = $('gadgets');
  ul.textContent = '';
  const icons: Record<string, string> = { jetpack: ICONS.missile, magnet: ICONS.magnet, shield: ICONS.shield, balloon: ICONS.balloon, mult: ICONS.coin };
  for (const u of UPGRADES) {
    const lv = save.upgrades[u.key];
    const li = document.createElement('li');
    li.className = 'flex items-center gap-3 rounded-xl border-[3px] border-ink bg-white px-3 py-2';
    const ic = document.createElement('span');
    ic.className = 'ico shrink-0';
    ic.insertAdjacentHTML('afterbegin', icons[u.key] ?? '');
    const txt = document.createElement('div');
    txt.className = 'min-w-0 flex-1';
    const head = document.createElement('p');
    head.className = 'font-bold';
    head.append(`${u.name} `);
    const lvl = document.createElement('span');
    lvl.className = 'tag ml-1';
    lvl.textContent = `Niveau ${lv}/5`;
    const pips = document.createElement('span');
    pips.className = 'ml-2 inline-flex gap-1 align-middle';
    pips.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 5; i++) {
      const pip = document.createElement('span');
      pip.className = i < lv ? 'pip on' : 'pip';
      pips.appendChild(pip);
    }
    head.append(lvl, pips);
    const desc = document.createElement('p');
    desc.className = 'text-sm';
    desc.textContent = u.desc;
    const eff = document.createElement('p');
    eff.className = 'text-sm';
    const now = document.createElement('b');
    now.textContent = u.effect(lv);
    eff.append('Maintenant : ', now);
    if (lv < 5) { eff.append(' → niveau suivant : '); const nx = document.createElement('b'); nx.textContent = u.effect(lv + 1); eff.append(nx); }
    txt.append(head, desc, eff);
    const act = document.createElement('div');
    act.className = 'flex w-36 shrink-0 flex-col items-stretch gap-1 text-center';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    const note = document.createElement('span');
    note.className = 'text-xs font-bold';
    if (lv >= 5) { b.textContent = 'Niveau max'; b.disabled = true; }
    else {
      const cost = u.costs[lv];
      b.textContent = `Acheter ${cost}`;
      b.setAttribute('aria-label', `Améliorer ${u.name} au niveau ${lv + 1} pour ${cost} pièces`);
      b.disabled = save.coins < cost;
      if (b.disabled) note.textContent = `Il te manque ${cost - save.coins} pièces`;
      b.addEventListener('click', () => {
        if (save.coins < cost) return;
        save.coins -= cost; save.upgrades[u.key] = lv + 1; flush(); sound.bonus(); paintShop();
        say(`${u.name} niveau ${lv + 1}.`);
        window.setTimeout(() => ($('gadgets').querySelectorAll('button')[UPGRADES.indexOf(u)] as HTMLElement | undefined)?.focus(), 0);
      });
    }
    act.append(b, note);
    li.append(ic, txt, act);
    ul.appendChild(li);
  }
}

const ownsItem = (i: Item) => save.owned.includes(i.id);
function previewLoadout(): Loadout {
  const lo = { ...save.equipped };
  if (selected) lo[selected.slot] = selected.id;
  return lo;
}

function paintStyle(): void {
  const tabs = $('slot-tabs');
  tabs.textContent = '';
  for (const s of SLOTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab');
    b.className = 'btn tab text-sm';
    b.setAttribute('aria-selected', String(s === slot));
    b.textContent = SLOT_LABEL[s];
    b.addEventListener('click', () => { slot = s; selected = null; paintStyle(); });
    tabs.appendChild(b);
  }
  const ul = $('items');
  ul.textContent = '';
  const list: (Item | null)[] = [...(slot === 'hat' ? [null] : []), ...itemsOf(slot)];
  for (const it of list) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'item';
    const id = it ? it.id : NONE[slot];
    const eq = save.equipped[slot] === id;
    if (eq) b.classList.add('equipped');
    b.setAttribute('aria-pressed', String((selected ? selected.id : null) === (it ? it.id : null) && selected !== null));
    const cv = document.createElement('canvas');
    cv.width = 112; cv.height = 112;
    cv.setAttribute('aria-hidden', 'true');
    const name = it ? it.name : 'Aucun';
    let state = '';
    if (!it) state = eq ? 'Équipé' : 'Retirer';
    else if (eq) state = 'Équipé';
    else if (ownsItem(it)) state = 'Acheté';
    else if (!isUnlocked(it, unl())) state = `Verrouillé · ${unlockText(it)}`;
    else state = `Acheter · ${it.price}`;
    const lab = document.createElement('span');
    lab.textContent = name;
    const st = document.createElement('span');
    st.className = 'text-[0.7rem] font-normal';
    st.textContent = state;
    b.append(cv, lab, st);
    b.addEventListener('click', () => { selected = it ?? { id: NONE[slot], slot, name: 'Aucun', price: 0 }; paintStyle(); });
    li.appendChild(b);
    ul.appendChild(li);
    const c2 = cv.getContext('2d');
    if (c2) { if (it) drawThumb(c2, it.id, slot, save.equipped, 112, 112); else drawThumb(c2, NONE[slot], slot, save.equipped, 112, 112); }
  }
  paintSelection();
}

function paintSelection(): void {
  const act = $<HTMLButtonElement>('sel-act');
  const nm = $('sel-name');
  const it = selected;
  if (!it) { nm.textContent = 'Choisis un objet'; act.textContent = '—'; act.disabled = true; act.onclick = null; return; }
  nm.textContent = it.name;
  const none = it.id === NONE[it.slot];
  const owned = none || ownsItem(it);
  const eq = save.equipped[it.slot] === it.id;
  act.disabled = false;
  if (eq) { act.textContent = 'Équipé'; act.disabled = true; act.onclick = null; return; }
  if (owned) {
    act.textContent = 'Équiper';
    act.onclick = () => { save.equipped[it.slot] = it.id; flush(); sound.ui(); selected = null; paintStyle(); say(`${it.name} équipé.`); };
    return;
  }
  const real = itemById(it.id) ?? it;
  if (!isUnlocked(real, unl())) { act.textContent = `Verrouillé : ${unlockText(real)} à accomplir`; act.disabled = true; act.onclick = null; return; }
  act.disabled = save.coins < real.price;
  act.textContent = act.disabled ? `Acheter ${real.price} (il manque ${real.price - save.coins})` : `Acheter ${real.price}`;
  act.onclick = () => {
    if (save.coins < real.price) return;
    save.coins -= real.price; save.owned.push(real.id); save.equipped[real.slot] = real.id; flush(); sound.bonus();
    $('shop-coins').textContent = String(save.coins); selected = null; paintStyle(); say(`${real.name} acheté et équipé.`);
  };
}

function drawPreview(): void {
  const cv = $<HTMLCanvasElement>('preview');
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#7fd4ff';
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#f2c86b';
  c.fillRect(0, cv.height - 28, cv.width, 28);
  c.save();
  c.translate(cv.width / 2 - 8, cv.height * 0.62);
  c.scale(3.2, 3.2);
  const bob = reduced() ? 0 : Math.sin(tSec * 3) * 2;
  c.translate(0, bob);
  drawGigi(c, previewLoadout(), { vy: reduced() ? 0 : Math.cos(tSec * 3) * 40, t: tSec, speed: 260, thrusting: true, calm: reduced() });
  c.restore();
}

void ITEMS; void EV_DEAD;
// ---------- Démarrage ----------
applyMotion();
mq.addEventListener?.('change', applyMotion);
resize();
openTitle('b-play');
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

// Crochet de test e2e : présent seulement dans `npm run build:e2e` (dist-e2e) ou `vite dev`, jamais dans dist.
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  (window as unknown as { __gf: unknown }).__gf = { game: () => game };
}
