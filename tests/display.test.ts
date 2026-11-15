import { describe, expect, it } from 'vitest';
import { isIPhone } from '../src/display';
import { defaultSave, migrate } from '../src/save';

const nav = (ua: string, pts = 0) => ({ userAgent: ua, maxTouchPoints: pts }) as Navigator;

describe('détection iPhone (pas de plein écran dans Safari)', () => {
  it("reconnaît l'iPhone et l'iPad en mode bureau, pas Android ni un Mac sans tactile", () => {
    expect(isIPhone(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'))).toBe(true);
    expect(isIPhone(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5))).toBe(true);
    expect(isIPhone(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0))).toBe(false);
    expect(isIPhone(nav('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537.36', 5))).toBe(false);
  });
});

describe('option plein écran', () => {
  it('est active par défaut, y compris pour une ancienne sauvegarde, et se désactive', () => {
    expect(defaultSave().options.fullscreen).toBe(true);
    const old = { ...defaultSave(), options: { sound: true, volume: 0.5 } };
    expect(migrate(old).options.fullscreen).toBe(true);
    expect(migrate({ ...defaultSave(), options: { fullscreen: false } }).options.fullscreen).toBe(false);
  });
});
