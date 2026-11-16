import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version';

describe('version', () => {
  it('semver x.y.z et alignée sur package.json', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(JSON.parse(readFileSync('package.json', 'utf8')).version).toBe(VERSION);
  });
  it('le CHANGELOG commence par cette version', () => {
    expect(readFileSync('CHANGELOG.md', 'utf8')).toContain(`## ${VERSION}`);
  });
});
