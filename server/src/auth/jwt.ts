import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production-min-32-chars!!';
const JWT_EXPIRES_IN = '15m';       // short-lived access token
const REFRESH_EXPIRES_DAYS = 7;

export type UserType = 'staff' | 'patient';

export interface JwtPayload {
  sub: string;          // user id
  type: UserType;
  role?: string;        // staff role
  name: string;
  iat?: number;
  exp?: number;
}

// ── Token generation ──────────────────────────────────────

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ── Refresh token (stored in DB) ──────────────────────────

export async function createRefreshToken(
  userId: string,
  userType: UserType
): Promise<string> {
  const rawToken = uuidv4();
  const hash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);

  const record =
    userType === 'staff'
      ? { staff_user_id: userId, token_hash: hash, expires_at: expiresAt.toISOString() }
      : { patient_id: userId, token_hash: hash, expires_at: expiresAt.toISOString() };

  await db.from('refresh_tokens').insert(record);
  return rawToken;
}

export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; userType: UserType; newRefreshToken: string } | null> {
  // Find all non-expired tokens and check each (bcrypt compare)
  const { data: tokens } = await db
    .from('refresh_tokens')
    .select('*')
    .gt('expires_at', new Date().toISOString());

  if (!tokens) return null;

  for (const t of tokens) {
    const match = await bcrypt.compare(rawToken, t.token_hash);
    if (match) {
      // Delete old token
      await db.from('refresh_tokens').delete().eq('id', t.id);

      const userId = t.staff_user_id ?? t.patient_id;
      const userType: UserType = t.staff_user_id ? 'staff' : 'patient';
      const newRefreshToken = await createRefreshToken(userId, userType);
      return { userId, userType, newRefreshToken };
    }
  }
  return null;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const { data: tokens } = await db
    .from('refresh_tokens')
    .select('id, token_hash');

  if (!tokens) return;
  for (const t of tokens) {
    const match = await bcrypt.compare(rawToken, t.token_hash);
    if (match) {
      await db.from('refresh_tokens').delete().eq('id', t.id);
      return;
    }
  }
}
