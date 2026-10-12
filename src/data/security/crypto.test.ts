import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson, passwordKey, prfKey, randomBytes, unwrapDataKey, wrapDataKey } from './crypto';

const ITERATIONS = 1000; // fast for tests; the app uses 600.000

describe('wrapping the data key', () => {
  it('only unwraps with the same password', async () => {
    const dataKey = randomBytes(32);
    const salt = randomBytes(16);
    const wrapped = await wrapDataKey(await passwordKey('correcta horse', salt, ITERATIONS), dataKey);
    expect(await unwrapDataKey(await passwordKey('correcta horse', salt, ITERATIONS), wrapped)).toEqual(dataKey);
    expect(await unwrapDataKey(await passwordKey('incorrecta', salt, ITERATIONS), wrapped)).toBeNull();
    expect(await unwrapDataKey(await passwordKey('correcta horse', randomBytes(16), ITERATIONS), wrapped)).toBeNull();
  });

  it('treats the same password typed with different accent encodings as equal', async () => {
    const salt = randomBytes(16);
    const dataKey = randomBytes(32);
    const composed = 'contraseñá'; // precomposed characters
    const decomposed = composed.normalize('NFD');
    const wrapped = await wrapDataKey(await passwordKey(composed, salt, ITERATIONS), dataKey);
    expect(await unwrapDataKey(await passwordKey(decomposed, salt, ITERATIONS), wrapped)).toEqual(dataKey);
  });

  it('unwraps with the same Face ID secret only', async () => {
    const dataKey = randomBytes(32);
    const secret = randomBytes(32);
    const wrapped = await wrapDataKey(await prfKey(secret), dataKey);
    expect(await unwrapDataKey(await prfKey(new Uint8Array(secret)), wrapped)).toEqual(dataKey);
    expect(await unwrapDataKey(await prfKey(randomBytes(32)), wrapped)).toBeNull();
  });

  it('uses a different IV each time', async () => {
    const key = await passwordKey('x'.repeat(8), randomBytes(16), ITERATIONS);
    const dataKey = randomBytes(32);
    const a = await wrapDataKey(key, dataKey);
    const b = await wrapDataKey(key, dataKey);
    expect(a.iv).not.toEqual(b.iv);
    expect(a.data).not.toEqual(b.data);
  });
});

describe('record encryption', () => {
  const dataKey = randomBytes(32);
  const value = { name: 'Banco', amount: 123456, title: 'Nómina', tags: ['a', 'b'], nothing: null };

  it('round-trips JSON values', () => {
    expect(decryptJson(dataKey, encryptJson(dataKey, value))).toEqual(value);
  });

  it('hides the content and never repeats ciphertexts', () => {
    const a = encryptJson(dataKey, value);
    const b = encryptJson(dataKey, value);
    expect(a).not.toEqual(b);
    expect(new TextDecoder().decode(a)).not.toContain('Banco');
  });

  it('rejects another key or an altered payload', () => {
    const payload = encryptJson(dataKey, value);
    expect(() => decryptJson(randomBytes(32), payload)).toThrow();
    const altered = new Uint8Array(payload);
    altered[altered.length - 1] ^= 1;
    expect(() => decryptJson(dataKey, altered)).toThrow();
  });
});
