import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../auth/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── POST /api/auth/staff/login ────────────────────────────
router.post('/staff/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const { data: user, error } = await db
      .from('staff_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = signAccessToken({
      sub: user.id,
      type: 'staff',
      role: user.role,
      name: user.name,
    });
    const refreshToken = await createRefreshToken(user.id, 'staff');

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        room_number: user.room_number,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// ── POST /api/auth/patient/request-otp ───────────────────
router.post('/patient/request-otp', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs for this phone
    await db.from('otps').delete().eq('phone', phone);

    await db.from('otps').insert({ phone, code, expires_at: expiresAt.toISOString() });

    // In production: send SMS via Twilio/MSG91
    // For development: return code in response
    const isDev = process.env.NODE_ENV !== 'production';

    console.log(`OTP for ${phone}: ${code}`);

    return res.json({
      success: true,
      message: 'OTP sent to your phone',
      ...(isDev && { otp: code }), // only in dev mode
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// ── POST /api/auth/patient/verify-otp ────────────────────
router.post('/patient/verify-otp', async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });

  try {
    const { data: otp } = await db
      .from('otps')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!otp) return res.status(401).json({ error: 'Invalid or expired OTP' });

    // Mark OTP as used
    await db.from('otps').update({ used: true }).eq('id', otp.id);

    // Get or create patient
    let { data: patient } = await db
      .from('patients')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (!patient) {
      const { data: created, error } = await db
        .from('patients')
        .insert({ phone, name: '', age: 0, address: '' })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      patient = created;
    }

    const accessToken = signAccessToken({
      sub: patient.id,
      type: 'patient',
      name: patient.name || phone,
    });
    const refreshToken = await createRefreshToken(patient.id, 'patient');

    // Generate QR token for this patient (valid 30 days)
    const qrToken = uuidv4();
    const qrExpiry = new Date();
    qrExpiry.setDate(qrExpiry.getDate() + 30);

    await db.from('qr_tokens').upsert(
      { patient_id: patient.id, token: qrToken, expires_at: qrExpiry.toISOString() },
      { onConflict: 'patient_id' }
    );

    return res.json({
      accessToken,
      refreshToken,
      patient,
      qrToken, // client stores this for QR display
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// ── POST /api/auth/patient/qr-login ──────────────────────
router.post('/patient/qr-login', async (req: Request, res: Response) => {
  const { qrToken } = req.body;
  if (!qrToken) return res.status(400).json({ error: 'qrToken required' });

  try {
    const { data: qr } = await db
      .from('qr_tokens')
      .select('*, patients(*)')
      .eq('token', qrToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!qr) return res.status(401).json({ error: 'Invalid or expired QR code' });

    const patient = qr.patients as Record<string, unknown>;

    const accessToken = signAccessToken({
      sub: qr.patient_id,
      type: 'patient',
      name: (patient.name as string) || (patient.phone as string),
    });
    const refreshToken = await createRefreshToken(qr.patient_id, 'patient');

    return res.json({ accessToken, refreshToken, patient });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  try {
    const result = await rotateRefreshToken(refreshToken);
    if (!result) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const { userId, userType, newRefreshToken } = result;

    let name = '';
    let role: string | undefined;

    if (userType === 'staff') {
      const { data: user } = await db
        .from('staff_users').select('name, role').eq('id', userId).single();
      name = user?.name ?? '';
      role = user?.role;
    } else {
      const { data: patient } = await db
        .from('patients').select('name, phone').eq('id', userId).single();
      name = patient?.name || patient?.phone || '';
    }

    const accessToken = signAccessToken({ sub: userId, type: userType, role, name });

    return res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return res.json({ success: true });
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.type === 'staff') {
    const { data } = await db
      .from('staff_users')
      .select('id, name, email, role, department, room_number, is_active')
      .eq('id', user.sub)
      .single();
    return res.json({ type: 'staff', ...data });
  } else {
    const { data } = await db
      .from('patients')
      .select('id, name, phone, age, address')
      .eq('id', user.sub)
      .single();

    // Also get their QR token
    const { data: qr } = await db
      .from('qr_tokens')
      .select('token, expires_at')
      .eq('patient_id', user.sub)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    return res.json({ type: 'patient', ...data, qrToken: qr?.token });
  }
});

// ── POST /api/auth/staff/create (Admin only) ──────────────
router.post('/staff/create', requireAuth, async (req: Request, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, email, password, role, department, room_number } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role required' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const { data, error } = await db
      .from('staff_users')
      .insert({ name, email: email.toLowerCase(), password_hash: hash, role, department, room_number })
      .select('id, name, email, role, department, room_number')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // If doctor, also create doctors record
    if (role === 'DOCTOR') {
      await db.from('doctors').insert({
        staff_user_id: data.id,
        name,
        specialty: department ?? 'General',
        department: department ?? 'general',
        room_number: room_number ?? null,
      });
    }

    return res.json({ success: true, user: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

export default router;
