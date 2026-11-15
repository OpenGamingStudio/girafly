import {
  CEIL, DT, FLOOR, GRAVITY, GRAZE_COINS, GRAZE_DIST, MISSILE_REL, PERKS_TABLE, PLAYER_FRAC, POOL, SEG_LEN, SPEED0,
  SPEED_MAX, THRUST, UNITS_PER_M, VY_DOWN, VY_UP, WARN_TIME,
} from './config';
import { B_BALLOON, B_MAGNET, B_SHIELD, Seg, generate, newSeg } from './gen';
import {
  HEAD_R, K_LASER, K_MISSILE, Obs, PY_MAX, PY_MIN, circleGap, headDX, headDY, newObs, playerGap,
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
    return Math.min(1, this.dist / 600);
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
      diff: this.diff,
      calm: this.segCount === 0,
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
      slot.active = true; slot.kind = o.kind; slot.grazed = false; slot.vx = 0;
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
    this.speed = Math.min(SPEED_MAX, SPEED0 + this.dist * 0.06);
    this.x += this.speed * DT;

    if (this.balloonT > 0) {
      // ballon-zèbre : vol stable, la vitesse verticale suit une cible douce
      const target = held ? -150 : 150;
      this.vy += (target - this.vy) * Math.min(1, 6 * DT);
    } else {
      this.vy += (GRAVITY - (held ? THRUST * this.perks.thrust : 0)) * DT;
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
    this.missileLogic();
    this.collide();
    this.collect();
    this.cull();
    if (held && this.balloonT <= 0) this.emitT += 1;
    this.emit();
    this.updateParts();
  }

  private missileLogic(): void {
    if (this.dist >= 150) {
      this.missileIn -= DT;
      if (this.missileIn <= 0) {
        for (let i = 0; i < POOL.missiles; i++) {
          if (this.warnT[i] > 0 || this.missiles[i].active) continue;
          this.warnT[i] = WARN_TIME;
          this.warnY[i] = Math.max(CEIL + 30, Math.min(FLOOR - 30, this.y + this.rng.range(-40, 40)));
          this.ev |= EV_WARN;
          break;
        }
        this.missileIn = Math.max(2.8, 8 - this.diff * 5) + this.rng.range(0, 2);
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
    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? this.obs : this.missiles;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!o.active) continue;
        if (o.x2 > this.x + 80 && o.x1 > this.x + 80) continue;
        if (playerGap(this.x, this.y, this.vy, o) < 0) {
          this.hit();
          if (this.mode === 'dying') return;
          // le coup absorbé détruit le missile / ignore l'obstacle
          if (o.kind === K_MISSILE) o.active = false;
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
