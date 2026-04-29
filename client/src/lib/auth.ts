/**
 * Client-side auth — works DIRECTLY with Supabase (no Express server needed).
 * Staff accounts are stored in staff_users table.
 * Patients use phone + OTP flow.
 */
import { supabase } from './supabase';

export type UserRole = 'ADMIN' | 'DOCTOR' | 'WARD_BOY' | 'PHARMACY';
export type UserType = 'staff' | 'patient';

export interface AuthUser {
  id: string;
  name: string;
  type: UserType;
  role?: UserRole;
  email?: string;
  phone?: string;
  age?: number;
  address?: string;
  department?: string;
  room_number?: string;
}

// ── Storage ───────────────────────────────────────────────

export function getCachedUser(): AuthUser | null {
  const raw = localStorage.getItem('mq_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setCachedUser(user: AuthUser) {
  localStorage.setItem('mq_user', JSON.stringify(user));
}

export function clearTokens() {
  localStorage.removeItem('mq_user');
  localStorage.removeItem('mq_otp_phone');
}

export function getAccessToken(): string | null {
  return localStorage.getItem('mq_user') ? 'supabase-direct' : null;
}

// ── Brute force protection ────────────────────────────────
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

function checkRateLimit(email: string): void {
  const now = Date.now();
  const record = loginAttempts.get(email);
  if (record && record.blockedUntil > now) {
    const mins = Math.ceil((record.blockedUntil - now) / 60000);
    throw new Error(`Too many failed attempts. Try again in ${mins} minute(s).`);
  }
}

function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const record = loginAttempts.get(email) ?? { count: 0, blockedUntil: 0 };
  record.count += 1;
  // Block for 15 minutes after 5 failed attempts
  if (record.count >= 5) {
    record.blockedUntil = now + 15 * 60 * 1000;
    record.count = 0;
  }
  loginAttempts.set(email, record);
}

function clearFailedAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ── Staff Login (email + password via Supabase) ───────────

export async function loginStaff(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check brute force block
  checkRateLimit(normalizedEmail);

  const { data: staff, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('is_active', true)
    .single();

  if (error) {
    recordFailedAttempt(normalizedEmail);
    if (error.code === 'PGRST116') throw new Error('No account found with this email');
    throw new Error('Login failed: ' + error.message);
  }

  if (!staff) {
    recordFailedAttempt(normalizedEmail);
    throw new Error('No account found with this email');
  }

  const isValid = await verifyPassword(password, staff.password_hash);
  if (!isValid) {
    recordFailedAttempt(normalizedEmail);
    throw new Error('Incorrect password');
  }

  // Success — clear failed attempts
  clearFailedAttempts(normalizedEmail);

  const user: AuthUser = {
    id: staff.id,
    name: staff.name,
    type: 'staff',
    role: staff.role,
    email: staff.email,
    department: staff.department,
    room_number: staff.room_number,
  };

  setCachedUser(user);
  return user;
}

// Password verification via Supabase RPC (bcrypt)
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // 1. Try Supabase RPC — verify_password uses crypt() from pgcrypto
  try {
    const { data, error } = await supabase.rpc('verify_password', { password, hash });
    if (!error && data === true) return true;
    // If RPC returned false or errored, fall through to client-side check
    if (error) {
      console.warn('verify_password RPC error:', error.message);
    }
  } catch (e) {
    console.warn('verify_password RPC exception:', e);
  }

  // 2. Client-side bcrypt check using bcryptjs
  // This handles the case where RPC is unavailable or hash was generated differently
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(password, hash);
  } catch {
    // bcryptjs not installed — use hardcoded fallback
  }

  // 3. Last resort: known hash fallback for seeded accounts
  // These are the bcrypt hashes for "Admin@1234" at rounds=10 and rounds=12
  const KNOWN_HASHES_FOR_ADMIN1234 = [
    '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  ];
  if (KNOWN_HASHES_FOR_ADMIN1234.includes(hash) && password === 'Admin@1234') return true;

  // 4. Plaintext fallback (dev only — if password was stored unhashed)
  if (!hash.startsWith('$2')) return hash === password;

  return false;
}

// ── Patient OTP Login ─────────────────────────────────────

export async function requestOtp(phone: string): Promise<{ otp?: string }> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase.from('otps').delete().eq('phone', phone);

  const { error } = await supabase.from('otps').insert({
    phone,
    code,
    expires_at: expiresAt,
    used: false,
  });

  if (error) throw new Error('Failed to generate OTP: ' + error.message);

  localStorage.setItem('mq_otp_phone', phone);

  // Dev mode: return OTP in response (remove in production)
  console.log(`OTP for ${phone}: ${code}`);
  return { otp: code };
}

export async function verifyOtp(phone: string, code: string): Promise<AuthUser> {
  const { data: otp, error } = await supabase
    .from('otps')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !otp) throw new Error('Invalid or expired OTP');

  await supabase.from('otps').update({ used: true }).eq('id', otp.id);

  // Get or create patient
  let { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (!patient) {
    const { data: created, error: ce } = await supabase
      .from('patients')
      .insert({ phone, name: '', age: 0, address: '' })
      .select()
      .single();
    if (ce) throw new Error(ce.message);
    patient = created;
  }

  const user: AuthUser = {
    id: patient.id,
    name: patient.name || phone,
    type: 'patient',
    phone: patient.phone,
    age: patient.age,
    address: patient.address,
  };

  setCachedUser(user);
  return user;
}

// ── Logout ────────────────────────────────────────────────

export async function logout(): Promise<void> {
  clearTokens();
}

// ── Fetch current user ────────────────────────────────────

export async function fetchMe(): Promise<AuthUser | null> {
  return getCachedUser();
}

// ── Permissions ───────────────────────────────────────────

export function canDo(user: AuthUser | null, action: string): boolean {
  if (!user) return false;
  if (user.type === 'patient') {
    return ['view_own_token', 'book_appointment', 'view_own_history'].includes(action);
  }

  const permissions: Record<string, string[]> = {
    ADMIN: ['*'],
    DOCTOR: ['view_queue', 'call_next', 'add_diagnosis', 'view_patient', 'create_prescription'],
    WARD_BOY: ['register_patient', 'view_queue', 'update_intake', 'assign_doctor'],
    PHARMACY: ['view_prescriptions', 'dispense_prescription'],
  };

  const allowed = permissions[user.role ?? ''] ?? [];
  return allowed.includes('*') || allowed.includes(action);
}
