// @vitest-environment node
//
// jose exige que el secreto sea `Uint8Array` y lo valida con `instanceof`. En el
// entorno jsdom hay dos Uint8Array distintas (la de jsdom y la nativa de Node) y
// jose rechaza la instancia "equivocada" con "payload must be an instance of
// Uint8Array". Como los tests de auth no necesitan DOM, corremos este archivo en
// entorno Node puro, donde solo hay una Uint8Array.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import type * as AuthModule from '@/lib/auth';

// lib/auth.ts lee JWT_SECRET al cargar el modulo y lanza si falta. Usamos import
// dinamico dentro de beforeAll (tras setear el env) en lugar de import top-level,
// que se resolveria antes de que pudieramos stubear la variable.
let auth: typeof AuthModule;

const TEST_SECRET = 'test-jwt-secret-de-al-menos-32-caracteres-para-testing';

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  auth = await import('@/lib/auth');
});

describe('createToken / verifyToken - roundtrip', () => {
  it('un token creado y verificado recupera el payload original', async () => {
    const payload = {
      id: 'user-123',
      nombre: 'Juan',
      celular: '3001234567',
      rol: 'dueño' as const,
      token_version: 3,
    };
    const token = await auth.createToken(payload);
    const verified = await auth.verifyToken(token);

    expect(verified).not.toBeNull();
    expect(verified).toMatchObject(payload);
    // iat y exp los setea jose
    expect(verified?.iat).toBeTypeOf('number');
    expect(verified?.exp).toBeTypeOf('number');
  });

  it('verifyToken devuelve null para un token mal formado', async () => {
    expect(await auth.verifyToken('no.es.un.jwt')).toBeNull();
    expect(await auth.verifyToken('')).toBeNull();
    expect(await auth.verifyToken('aaa.bbb.ccc')).toBeNull();
  });

  it('verifyToken devuelve null para un token firmado con otro secreto', async () => {
    // Firmamos con el secreto de test y luego alteramos el secreto del modulo
    // es dificil sin recargar; en su lugar firmamos manualmente con jose otro
    // secreto y confirmamos que verifyToken lo rechaza.
    const { SignJWT } = await import('jose');
    const otroSecreto = new TextEncoder().encode('otro-secreto-distinto-de-32-caracteres!!');
    const tokenIntruso = await new SignJWT({ id: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otroSecreto);

    expect(await auth.verifyToken(tokenIntruso)).toBeNull();
  });

  it('verifyToken devuelve null para un token expirado', async () => {
    vi.useFakeTimers();
    try {
      const token = await auth.createToken({
        id: 'u1',
        nombre: 'X',
        celular: '3001234567',
        rol: 'tendero',
        token_version: 0,
      });
      // TOKEN_EXPIRY = '7d'; avanzamos 8 dias para forzar expiracion
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
      expect(await auth.verifyToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getTokenFromCookie', () => {
  it('devuelve null si el header es null', async () => {
    expect(await auth.getTokenFromCookie(null)).toBeNull();
  });

  it('devuelve null si no hay cookie session_token', async () => {
    expect(await auth.getTokenFromCookie('otra=valor')).toBeNull();
    expect(await auth.getTokenFromCookie('')).toBeNull();
  });

  it('recupera el payload de una cookie session_token valida', async () => {
    const token = await auth.createToken({
      id: 'u1',
      nombre: 'X',
      celular: '3001234567',
      rol: 'tendero',
      token_version: 1,
    });
    // La cookie puede venir entre otras cookies
    const header = `tema=oscuro; session_token=${token}; otro=valor`;
    const result = await auth.getTokenFromCookie(header);
    expect(result?.id).toBe('u1');
    expect(result?.rol).toBe('tendero');
  });
});

describe('createSessionCookie / deleteSessionCookie', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('createSessionCookie en produccion incluye Secure', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const cookie = auth.createSessionCookie('tok');
    expect(cookie).toContain('session_token=tok');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=');
  });

  it('createSessionCookie fuera de produccion omite Secure', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cookie = auth.createSessionCookie('tok');
    expect(cookie).not.toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('deleteSessionCookie siempre borra con Max-Age=0', () => {
    const cookie = auth.deleteSessionCookie();
    expect(cookie).toContain('session_token=');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });
});
