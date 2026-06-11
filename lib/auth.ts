import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const jwtSecretRaw = process.env.JWT_SECRET;
if (!jwtSecretRaw) {
  throw new Error(
    'JWT_SECRET environment variable is required. The application cannot start without it.'
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

export interface UsuarioPayload extends JWTPayload {
  id: string;
  nombre: string;
  celular: string;
  rol: 'dueño' | 'tendero';
}

export async function createToken(payload: Omit<UsuarioPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UsuarioPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as UsuarioPayload;
  } catch {
    return null;
  }
}

export async function getTokenFromCookie(cookieHeader: string | null): Promise<UsuarioPayload | null> {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies['session_token'];
  if (!token) return null;

  return verifyToken(token);
}

export function createSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 30 * 24 * 60 * 60;

  return `session_token=${token}; Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}; Max-Age=${maxAge}`;
}

export function deleteSessionCookie(): string {
  return 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

export function encodeUserData(payload: UsuarioPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeUserData(data: string): UsuarioPayload | null {
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}