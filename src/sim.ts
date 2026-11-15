import {
  CEIL, DIFF_FULL_X, DT, EVENT_DUR, EVENT_MAX, EVENT_MIN, EVENT_REWARD, FLOOR, GRAVITY, GRAZE_COINS, GRAZE_DIST,
  MISSILE_REL, PERKS_TABLE, PLAYER_FRAC, POOL, RAMP_T, SEG_LEN, SPEED0, SPEED_CAP, SPEED_STEP, SPEED_STEP_T, THRUST,
  UNITS_PER_M, VY_DOWN, VY_UP, WARN_TIME,
} from './config';
import { B_BALLOON, B_MAGNET, B_SHIELD, Seg, generate, newSeg } from './gen';
import {
  HEAD_R, K_BEAM, K_LASER, K_METEOR, K_MISSILE, Obs, PY_MAX, PY_MIN, circleGap, headDX, headDY, newObs, playerGap,
} from './geom';
import { Rng } from './rng';

export const EV_COIN = 1;
export const EV_HIT = 2; // coup absorbé (bouclier / ballon)
export const EV_BONUS = 4;
export const EV_GRAZE = 8;
export const EV_WARN = 16;
export const EV_DEAD = 32;
export const EV_BALLOON_END = 64;
export const EV_MISSILE = 128;
export const EV_BEAM = 256; // un laser passe en tir
export const EV_EVENT = 512; // début d'événement
export const EV_EVENT_END = 1024; // événement survécu : récompense

export const E_NONE = 0;
export const E_DRONE = 1;
export const E_METEORS = 2;
export const E_WIND = 3;
export const EVENT_NAMES = ['', 'Drone en vue !', 'Pluie de météorites !', 'Tempête de vent !'];

export const BEAM_WARN = 1.3;
export const BEAM_FIRE = 0.7;
export const SWEEP_FIRE = 3;
export const SWEEP_HALF = 72;
export const METEOR_WARN = 0.9;

/** Vitesse de défilement à l'instant t : +5 % toutes les 20 s, avec un fondu d'une seconde, plafonnée. */
export function speedAt(t: number): number {
  const k = t / SPEED_STEP_T;
  const n = Math.floor(k);
  const f = Math.min(1, (k - n) * SPEED_STEP_T);
  return SPEED0 * Math.min(SPEED_CAP, 1 + SPEED_STEP * (n === 0 ? 0 : n - 1 + f));
}

/** Difficulté (0 → 1) à l'abscisse x : une rampe d'accueil (RAMP_T s à vitesse de départ), puis la montée. */
export function diffAt(x: number): number {
  const x0 = SPEED0 * RAMP_T;
  if (x <= x0) return 0.1 * Math.max(0, x / x0);
  return Math.min(1, 0.1 + (0.9 * (x - x0)) / DIFF_FULL_X);
}

export interface Perks {
  thrust: number;
  magnetDur: number;
  magnetRadius: number;
  shieldChance: number;
  startShield: boolean;
  balloonDur: number;
  coinMult: number;
}

/** Améliorations de la boutique (niveaux 0 à 5) -> effets bornés. */
export function perksFor(lv: { jetpack: number; magnet: number; shield: number; balloon: number; mult: number }): Perks {
  const c = (n: number) => Math.max(0, Math.min(5, Math.floor(n) || 0));
  return {
    thrust: PERKS_TABLE.thrust[c(lv.jetpack)],
    magnetDur: PERKS_TABLE.magnetDur[c(lv.magnet)],
    magnetRadius: PERKS_TABLE.magnetRadius[c(lv.magnet)],
    shieldChance: PERKS_TABLE.shieldChance[c(lv.shield)],
    startShield: c(lv.shield) >= 5,
    balloonDur: PERKS_TABLE.balloonDur[c(lv.balloon)],
    coinMult: PERKS_TABLE.coinMult[c(lv.mult)],
  };
}

export const DEFAULT_PERKS: Perks = perksFor({ jetpack: 0, magnet: 0, shield: 0, balloon: 0, mult: 0 });

export type Mode = 'run' | 'dying' | 'over';

export class Game {
  mode: Mode = 'run';
  t = 0;
  x = 0;
  y = 200;
  vy = 0;
  speed = SPEED0;
  viewW = 640;
  shield = false;
  magnetT = 0;
  balloonT = 0;
  invuln = 0;
  deadT = 0;
  thrusting = false;
  ev = 0;
  rawCoins = 0;
  grazes = 0;
  bonuses = 0;
  balloons = 0;
  shieldsUsed = 0;
  missilesFired = 0;

  readonly perks: Perks;
  readonly obs: Obs[] = [];
  readonly coinX = new Float32Array(POOL.coins);
  readonly coinY = new Float32Array(POOL.coins);
  readonly coinOn = new Uint8Array(POOL.coins);
  readonly bonX = new Float32Array(POOL.bonus);
  readonly bonY = new Float32Array(POOL.bonus);
  readonly bonK = new Uint8Array(POOL.bonus);
  readonly bonOn = new Uint8Array(POOL.bonus);
  readonly missiles: Obs[] = [];
  readonly warnT = new Float32Array(POOL.missiles); // > 0 : avertissement en cours
  readonly warnY = new Float32Array(POOL.missiles);
  // lasers à charge / balayage : deux capsules (haut, bas) ; kind 0 aucun, 1 charge (tir horizontal), 2 balayage (porte)
  readonly beams: Obs[] = [newObs(), newObs()];
  beamKind = 0;
  beamT = 0;
  beamY = 0;
  beamY2 = 0;
  // météorites : alerte au sommet puis chute
  readonly meteors: Obs[] = [];
  readonly metWarn = new Float32Array(POOL.meteors);
  readonly metX = new Float32Array(POOL.meteors);
  // événements
  evtKind = E_NONE;
  evtT = 0;
  evtDroneY = 180;
  windForce = 0;
  eventsDone = 0;
  private evtIn = 0;
  private evtShot = 0;
  private evtMet = 0;
  private hzIn = 1.5;
  // particules de traînée (pool)
  readonly pX = new Float32Array(POOL.parts);
  readonly pY = new Float32Array(POOL.parts);
  readonly pVX = new Float32Array(POOL.parts);
  readonly pVY = new Float32Array(POOL.parts);
  readonly pLife = new Float32Array(POOL.parts);
  readonly pSeed = new Float32Array(POOL.parts);
  private pNext = 0;

  private readonly rng: Rng;
  private readonly fx: Rng;
  private readonly seg: Seg = newSeg();
  private readonly gX = new Float32Array(8);
  private readonly gA = new Float32Array(8);
  private readonly gB = new Float32Array(8);
  private nextX = 0;
  private nextY = 200;
  private segCount = 0;
  private missileIn = 6;
  private emitT = 0;

  constructor(seed: number, perks: Perks = DEFAULT_PERKS) {
    this.perks = perks;
    this.rng = new Rng(seed);
    this.fx = new Rng(seed ^ 0x9e3779b9);
    for (let i = 0; i < POOL.obs; i++) this.obs.push(newObs());
    for (let i = 0; i < POOL.missiles; i++) this.missiles.push(newObs());
    for (let i = 0; i < POOL.meteors; i++) this.meteors.push(newObs());
    this.evtIn = this.rng.range(EVENT_MIN, EVENT_MAX);
    this.shield = perks.startShield;
    this.fill();
  }

  get dist(): number {
    return Math.max(0, Math.floor(this.x / UNITS_PER_M));
  }
  get coins(): number {
    return Math.floor(this.rawCoins * this.perks.coinMult + 1e-9);
  }
  get camX(): number {
    return this.x - PLAYER_FRAC * this.viewW;
  }
  get diff(): number {
    return diffAt(this.x);
  }

  setView(w: number): void {
    this.viewW = w;
  }

  private fill(): void {
    while (this.nextX < this.camX + this.viewW + SEG_LEN) this.addSegment();
  }

  private addSegment(): void {
    const s = this.seg;
    generate(s, this.rng, this.nextX, this.nextY, {
      diff: diffAt(this.nextX) * (this.evtT > 0 ? 0.6 : 1),
      calm: this.segCount === 0,
      ramp: this.nextX < SPEED0 * RAMP_T,
      shieldChance: this.perks.shieldChance,
    });
    const k = this.segCount & 7;
    this.gX[k] = s.x0; this.gA[k] = s.yIn; this.gB[k] = s.yOut;
    this.segCount++;
    this.nextX += s.len;
    this.nextY = s.yOut;
    for (let i = 0; i < s.nObs; i++) {
      const slot = this.obs.find((o) => !o.active);
      if (!slot) break;
      const o = s.obs[i];
      slot.active = true; slot.kind = o.kind; slot.grazed = false; slot.vx = 0; slot.vy = 0;
      slot.amp = o.amp; slot.w = o.w; slot.ph = o.ph; slot.b1 = o.b1; slot.b2 = o.b2;
      slot.x1 = o.x1; slot.y1 = o.y1; slot.x2 = o.x2; slot.y2 = o.y2; slot.r = o.r;
    }
    let c = 0;
    for (let i = 0; i < s.nCoins; i++) {
      while (c < POOL.coins && this.coinOn[c]) c++;
      if (c >= POOL.coins) break;
      this.coinOn[c] = 1; this.coinX[c] = s.cx[i]; this.coinY[c] = s.cy[i];
    }
    for (let i = 0; i < s.nBonus; i++) {
      for (let b = 0; b < POOL.bonus; b++) {
        if (this.bonOn[b]) continue;
        this.bonOn[b] = 1; this.bonX[b] = s.bx[i]; this.bonY[b] = s.by[i]; this.bonK[b] = s.bk[i];
        break;
      }
    }
  }

  /** Trajectoire garantie à l'abscisse x (pour les tests et le robot) ; -1 si hors des segments récents. */
  guideY(x: number): number {
    for (let k = 0; k < 8; k++) {
      if (k >= this.segCount) break;
      if (x >= this.gX[k] && x <= this.gX[k] + SEG_LEN) {
        let t = (x - this.gX[k]) / SEG_LEN;
        t = t * t * (3 - 2 * t);
        return this.gA[k] + (this.gB[k] - this.gA[k]) * t;
      }
    }
    return -1;
  }

  /** Un pas de temps fixe. `held` : le joueur maintient la poussée. */
  step(held: boolean): void {
    if (this.mode === 'over') return;
    if (this.mode === 'dying') {
      this.deadT -= DT;
      this.vy = Math.min(VY_DOWN, this.vy + GRAVITY * DT);
      this.y = Math.min(PY_MAX, this.y + this.vy * DT);
      this.updateParts();
      if (this.deadT <= 0) this.mode = 'over';
      return;
    }
    this.t += DT;
    this.thrusting = held;
    this.speed = speedAt(this.t);
    this.x += this.speed * DT;

    if (this.balloonT > 0) {
      // ballon-zèbre : vol stable, la vitesse verticale suit une cible douce
      const target = held ? -150 : 150;
      this.vy += (target - this.vy) * Math.min(1, 6 * DT);
    } else {
      this.vy += (GRAVITY - (held ? THRUST * this.perks.thrust : 0) + this.windForce) * DT;
      if (this.vy < VY_UP) this.vy = VY_UP;
      if (this.vy > VY_DOWN) this.vy = VY_DOWN;
    }
    this.y += this.vy * DT;
    if (this.y < PY_MIN) { this.y = PY_MIN; if (this.vy < 0) this.vy = 0; }
    if (this.y > PY_MAX) { this.y = PY_MAX; if (this.vy > 0) this.vy = 0; }

    if (this.invuln > 0) this.invuln -= DT;
    if (this.magnetT > 0) this.magnetT -= DT;
    if (this.balloonT > 0) {
      this.balloonT -= DT;
      if (this.balloonT <= 0) this.ev |= EV_BALLOON_END;
    }

    this.fill();
    this.movers();
    this.missileLogic();
    this.beamLogic();
    this.eventLogic();
    this.collide();
    this.collect();
    this.cull();
    if (held && this.balloonT <= 0) this.emitT += 1;
    this.emit();
    this.updateParts();
  }

  /** Portes mobiles : l'ouverture oscille (position déterministe en fonction du temps de jeu). */
  private movers(): void {
    for (let i = 0; i < POOL.obs; i++) {
      const o = this.obs[i];
      if (!o.active || o.amp <= 0) continue;
      const d = o.amp * Math.sin(o.w * this.t + o.ph);
      o.y1 = o.b1 + d; o.y2 = o.b2 + d;
    }
  }

  private warnMissile(y: number, delay: number): boolean {
    for (let i = 0; i < POOL.missiles; i++) {
      if (this.warnT[i] > 0 || this.missiles[i].active) continue;
      this.warnT[i] = WARN_TIME + delay;
      this.warnY[i] = Math.max(CEIL + 30, Math.min(FLOOR - 30, y));
      return true;
    }
    return false;
  }

  /** Tire un danger toutes les quelques secondes, jamais pendant la rampe d'accueil ; toujours un signal avant. */
  private hazardPick(): void {
    const d = this.diff;
    const r = this.rng;
    const kinds = ['missile'];
    if (d >= 0.3) kinds.push('salvo');
    if (d >= 0.45 && this.beamKind === 0) kinds.push('beam');
    if (d >= 0.65 && this.beamKind === 0) kinds.push('sweep');
    const k = kinds[r.int(0, kinds.length - 1)];
    if (k === 'missile') {
      if (this.warnMissile(this.y + r.range(-40, 40), 0)) this.ev |= EV_WARN;
    } else if (k === 'salvo') {
      const n = d > 0.7 ? 3 : 2;
      const c = this.y;
      let any = false;
      for (let i = 0; i < n; i++) any = this.warnMissile(c + (i - (n - 1) / 2) * r.range(70, 100), i * 0.4) || any;
      if (any) this.ev |= EV_WARN;
    } else if (k === 'beam') {
      this.beamKind = 1; this.beamT = 0;
      this.beamY = Math.max(CEIL + 40, Math.min(FLOOR - 40, this.y + r.range(-30, 30)));
      this.ev |= EV_WARN;
    } else {
      this.beamKind = 2; this.beamT = 0;
      // l'ouverture démarre là où est Gigi et glisse vers l'autre moitié, ≤ 70 unités par seconde
      this.beamY = Math.max(CEIL + SWEEP_HALF + 6, Math.min(FLOOR - SWEEP_HALF - 6, this.y));
      const dir = this.beamY > (CEIL + FLOOR) / 2 ? -1 : 1;
      this.beamY2 = Math.max(CEIL + SWEEP_HALF + 6, Math.min(FLOOR - SWEEP_HALF - 6, this.beamY + dir * 70 * SWEEP_FIRE));
      this.ev |= EV_WARN;
    }
  }

  private missileLogic(): void {
    if (this.t >= RAMP_T && this.evtKind !== E_DRONE) {
      this.hzIn -= DT;
      if (this.hzIn <= 0) {
        this.hazardPick();
        this.hzIn = Math.max(2.2, 6.5 - this.diff * 4.5) + this.rng.range(0, 1.8);
      }
    }
    for (let i = 0; i < POOL.missiles; i++) {
      if (this.warnT[i] > 0) {
        this.warnT[i] -= DT;
        if (this.warnT[i] <= 0) {
          const m = this.missiles[i];
          m.active = true; m.kind = K_MISSILE; m.grazed = true; m.r = 6;
          m.x1 = this.camX + this.viewW + 40; m.x2 = m.x1 - 30; m.y1 = m.y2 = this.warnY[i];
          m.vx = this.speed - MISSILE_REL;
          this.missilesFired++;
          this.ev |= EV_MISSILE;
        }
      }
      const m = this.missiles[i];
      if (m.active) {
        m.x1 += m.vx * DT; m.x2 += m.vx * DT;
        if (m.x1 < this.camX - 60) m.active = false;
      }
    }
  }

  /** Laser à charge (ligne fine qui clignote, puis tir) ou à balayage (ouverture qui glisse). */
  private beamLogic(): void {
    const [a, b] = this.beams;
    if (this.beamKind === 0) { a.active = false; b.active = false; return; }
    this.beamT += DT;
    const fireT = this.beamKind === 1 ? BEAM_FIRE : SWEEP_FIRE;
    const e = this.beamT - BEAM_WARN;
    if (e >= fireT) { this.beamKind = 0; a.active = false; b.active = false; return; }
    if (e < 0) { a.active = false; b.active = false; return; }
    if (e - DT < 0) this.ev |= EV_BEAM;
    const x1 = this.camX - 20, x2 = this.camX + this.viewW + 20;
    a.kind = K_BEAM; b.kind = K_BEAM; a.grazed = true; b.grazed = true;
    a.x1 = x1; a.x2 = x2; b.x1 = x1; b.x2 = x2;
    if (this.beamKind === 1) {
      a.active = true; b.active = false;
      a.r = 7; a.y1 = a.y2 = this.beamY;
    } else {
      const c = this.beamY + (this.beamY2 - this.beamY) * (e / SWEEP_FIRE);
      a.active = true; b.active = true; a.r = b.r = 5;
      a.y1 = a.y2 = c - SWEEP_HALF - 5;
      b.y1 = b.y2 = c + SWEEP_HALF + 5;
    }
  }

  private meteorStep(): void {
    for (let i = 0; i < POOL.meteors; i++) {
      if (this.metWarn[i] > 0) {
        this.metWarn[i] -= DT;
        if (this.metWarn[i] <= 0) {
          const m = this.meteors[i];
          m.active = true; m.kind = K_METEOR; m.grazed = true; m.r = 9; m.vx = 0; m.vy = 320;
          m.x1 = m.x2 = this.metX[i]; m.y1 = CEIL - 30; m.y2 = CEIL - 10;
          this.ev |= EV_MISSILE;
        }
      }
      const m = this.meteors[i];
      if (m.active) {
        m.y1 += m.vy * DT; m.y2 += m.vy * DT;
        if (m.y1 > FLOOR + 30) m.active = false;
      }
    }
  }

  /** Événements toutes les 60 à 90 s : drone qui tire, pluie de météorites, tempête de vent (15 s, pièces à la clé). */
  private eventLogic(): void {
    if (this.evtKind === E_NONE) {
      this.windForce = 0;
      this.meteorStep();
      if (this.t < RAMP_T) return;
      this.evtIn -= DT;
      if (this.evtIn > 0 || this.beamKind !== 0) return;
      this.evtKind = [E_DRONE, E_METEORS, E_WIND][this.rng.int(0, 2)];
      this.evtT = EVENT_DUR;
      this.evtShot = 2;
      this.evtMet = 1.2;
      this.ev |= EV_EVENT;
      return;
    }
    this.evtT -= DT;
    const el = EVENT_DUR - this.evtT;
    if (this.evtKind === E_DRONE) {
      this.evtDroneY += (Math.max(CEIL + 40, Math.min(FLOOR - 40, this.y)) - this.evtDroneY) * Math.min(1, 1.6 * DT);
      this.evtShot -= DT;
      if (this.evtShot <= 0 && this.evtT > 1.5) {
        // tirs groupés : un missile, puis une salve de 2 au milieu de l'événement
        const salvo = el > 6 && el < 9 ? 2 : 1;
        let any = false;
        for (let i = 0; i < salvo; i++) any = this.warnMissile(this.evtDroneY + (i - (salvo - 1) / 2) * 80, i * 0.35) || any;
        if (any) this.ev |= EV_WARN;
        this.evtShot = salvo === 2 ? 2.8 : 2.2;
      }
    } else if (this.evtKind === E_METEORS) {
      this.evtMet -= DT;
      if (this.evtMet <= 0 && this.evtT > 1.5) {
        for (let i = 0; i < POOL.meteors; i++) {
          if (this.metWarn[i] > 0 || this.meteors[i].active) continue;
          this.metWarn[i] = METEOR_WARN;
          this.metX[i] = this.x + this.rng.range(110, 300);
          break;
        }
        this.evtMet = 0.7;
      }
    } else if (this.evtKind === E_WIND) {
      // rafales verticales alternées : 3 s dans un sens, 3 s dans l'autre ; mise en place douce la 1re seconde
      const ramp = Math.min(1, el);
      this.windForce = Math.sin((el * Math.PI) / 3) * 420 * ramp * Math.min(1, this.evtT);
    }
    this.meteorStep();
    if (this.evtT <= 0) {
      this.evtKind = E_NONE;
      this.windForce = 0;
      this.rawCoins += EVENT_REWARD;
      this.eventsDone++;
      this.ev |= EV_EVENT_END;
      this.evtIn = this.rng.range(EVENT_MIN, EVENT_MAX);
    }
  }

  private hit(): void {
    if (this.invuln > 0) return;
    if (this.balloonT > 0) {
      this.balloonT = 0;
      this.invuln = 1.2;
      this.ev |= EV_HIT | EV_BALLOON_END;
    } else if (this.shield) {
      this.shield = false;
      this.shieldsUsed++;
      this.invuln = 1.2;
      this.ev |= EV_HIT;
    } else {
      this.mode = 'dying';
      this.deadT = 0.8;
      this.vy = -180;
      this.ev |= EV_DEAD;
    }
  }

  private collide(): void {
    const hx = this.x + headDX(this.vy);
    const hy = this.y + headDY(this.vy);
    for (let pass = 0; pass < 4; pass++) {
      const list = pass === 0 ? this.obs : pass === 1 ? this.missiles : pass === 2 ? this.beams : this.meteors;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!o.active) continue;
        if (o.x2 > this.x + 80 && o.x1 > this.x + 80) continue;
        if (playerGap(this.x, this.y, this.vy, o) < 0) {
          this.hit();
          if (this.mode === 'dying') return;
          // le coup absorbé détruit le missile / ignore l'obstacle
          if (o.kind === K_MISSILE || o.kind === K_METEOR) o.active = false;
        } else if (o.kind === K_LASER && !o.grazed && circleGap(hx, hy, HEAD_R, o) < GRAZE_DIST) {
          // frôler un laser avec la tête : +1 frôlé et des pièces bonus
          o.grazed = true;
          this.grazes++;
          this.rawCoins += GRAZE_COINS;
          this.ev |= EV_GRAZE;
        }
      }
    }
  }

  private collect(): void {
    const mx = this.x;
    const my = this.y - 10;
    const magnet = this.magnetT > 0;
    const R = this.perks.magnetRadius;
    for (let i = 0; i < POOL.coins; i++) {
      if (!this.coinOn[i]) continue;
      let dx = mx - this.coinX[i];
      let dy = my - this.coinY[i];
      let d2 = dx * dx + dy * dy;
      if (magnet && d2 < R * R) {
        const d = Math.sqrt(d2) || 1;
        const step = Math.min(d, 620 * DT);
        this.coinX[i] += (dx / d) * step;
        this.coinY[i] += (dy / d) * step;
        dx = mx - this.coinX[i]; dy = my - this.coinY[i]; d2 = dx * dx + dy * dy;
      }
      if (d2 < 26 * 26) {
        this.coinOn[i] = 0;
        this.rawCoins++;
        this.ev |= EV_COIN;
      }
    }
    for (let i = 0; i < POOL.bonus; i++) {
      if (!this.bonOn[i]) continue;
      const dx = mx - this.bonX[i];
      const dy = my - this.bonY[i];
      if (dx * dx + dy * dy < 30 * 30) {
        this.bonOn[i] = 0;
        this.bonuses++;
        this.ev |= EV_BONUS;
        const k = this.bonK[i];
        if (k === B_SHIELD) this.shield = true;
        else if (k === B_MAGNET) this.magnetT = this.perks.magnetDur;
        else if (k === B_BALLOON) { this.balloonT = this.perks.balloonDur; this.balloons++; }
      }
    }
  }

  private cull(): void {
    const left = this.camX - 80;
    for (let i = 0; i < POOL.obs; i++) {
      const o = this.obs[i];
      if (o.active && Math.max(o.x1, o.x2) + o.r < left) o.active = false;
    }
    for (let i = 0; i < POOL.coins; i++) if (this.coinOn[i] && this.coinX[i] < left) this.coinOn[i] = 0;
    for (let i = 0; i < POOL.bonus; i++) if (this.bonOn[i] && this.bonX[i] < left) this.bonOn[i] = 0;
  }

  private emit(): void {
    if (this.emitT < 2) return;
    this.emitT = 0;
    const i = this.pNext;
    this.pNext = (i + 1) % POOL.parts;
    const f = this.fx;
    this.pX[i] = this.x - 18; this.pY[i] = this.y + 12;
    this.pVX[i] = -50 + f.range(-20, 10); this.pVY[i] = 70 + f.range(-20, 30);
    this.pLife[i] = 0.7; this.pSeed[i] = f.next();
  }

  private updateParts(): void {
    for (let i = 0; i < POOL.parts; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= DT;
      this.pX[i] += this.pVX[i] * DT;
      this.pY[i] += this.pVY[i] * DT;
    }
  }

  /** Consomme et remet à zéro les événements du pas (audio, vibration, annonces). */
  takeEvents(): number {
    const e = this.ev;
    this.ev = 0;
    return e;
  }
}
