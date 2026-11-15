// Sons synthétisés (Web Audio) : aucun fichier. Le contexte est créé au premier toucher (règle des navigateurs).
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  on = true;
  volume = 0.8;

  /** À appeler dans un geste du joueur (1er toucher). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.master) this.master.gain.value = 0.35 * this.volume;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = 0.35 * v;
  }

  private tone(f: number, d: number, type: OscillatorType, vol: number, slide?: number, when = 0): void {
    const c = this.ctx;
    if (!c || !this.master || !this.on) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + d + 0.02);
  }

  coin(): void { this.tone(880, 0.08, 'square', 0.18); this.tone(1320, 0.1, 'square', 0.16, undefined, 0.06); }
  bonus(): void { [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, undefined, i * 0.07)); }
  graze(): void { this.tone(1200, 0.12, 'sawtooth', 0.12, 1800); }
  warn(): void { this.tone(660, 0.14, 'square', 0.22); this.tone(660, 0.14, 'square', 0.22, undefined, 0.22); this.tone(660, 0.14, 'square', 0.22, undefined, 0.44); }
  beam(): void { this.tone(220, 0.5, 'sawtooth', 0.3, 90); }
  event(): void { [392, 330, 392, 330].forEach((f, i) => this.tone(f, 0.16, 'square', 0.22, undefined, i * 0.18)); }
  shieldBreak(): void { this.tone(300, 0.25, 'sawtooth', 0.3, 80); }
  dead(): void { this.tone(400, 0.6, 'sawtooth', 0.35, 60); }
  ui(): void { this.tone(500, 0.06, 'triangle', 0.2); }
  woosh(): void { this.tone(140, 0.07, 'sawtooth', 0.04, 100); }
}
