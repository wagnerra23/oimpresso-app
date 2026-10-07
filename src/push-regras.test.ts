import { describe, expect, it } from 'vitest';
import { pushNoBuild } from './push-regras';

describe('pushNoBuild', () => {
  it('liga só quando o build marcou VITE_PUSH=1 (google-services.json presente)', () => {
    expect(pushNoBuild('1')).toBe(true);
  });

  it('build sem push (VITE_PUSH ausente ou vazio) não chama o Firebase', () => {
    expect(pushNoBuild(undefined)).toBe(false);
    expect(pushNoBuild('')).toBe(false);
    expect(pushNoBuild('0')).toBe(false);
    expect(pushNoBuild('true')).toBe(false);
  });
});
