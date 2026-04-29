import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/patients/history/:phone
// DOCTOR/ADMIN: full history | WARD_BOY: basic info | PHARMACY: denied
router.get('/history/:phone', async (req: Request, res: Response) => {
  const { phone } = req.params;
  const role = req.user?.role;
  const userType = req.user?.type;

  // Pharmacy cannot access patient history
  if (role === 'PHARMACY') {
    return res.status(403).json({ error: 'Pharmacy cannot access patient history' });
  }

  try {
    const { data: patient } = await db
      .from('patients')
      .select('*')
      .eq('phone', decodeURIComponent(phone))
      .maybeSingle();

    if (!patient) return res.json({ patient: null, visits: [] });

    // Ward boy sees basic info only (no doctor notes)
    if (role === 'WARD_BOY') {
      return res.json({
        patient: {
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          age: patient.age,
          address: patient.address,
        },
        visits: [], // ward boy doesn't need visit history
      });
    }

    // Doctor/Admin/Patient sees full history
    const { data: visits } = await db
      .from('visits')
      .select('*, tokens(*)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });

    // Patient can only see their own data
    if (userType === 'patient' && req.user?.sub !== patient.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({ patient, visits: visits ?? [] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// GET /api/patients/lookup/:phone — ward boy looks up returning patient
router.get('/lookup/:phone', async (req: Request, res: Response) => {
  const { phone } = req.params;

  try {
    const { data: patient } = await db
      .from('patients')
      .select('id, name, phone, age, address')
      .eq('phone', decodeURIComponent(phone))
      .maybeSingle();

    // Also get their QR token if exists
    let qrToken = null;
    if (patient) {
      const { data: qr } = await db
        .from('qr_tokens')
        .select('token')
        .eq('patient_id', patient.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      qrToken = qr?.token ?? null;
    }

    return res.json({ patient: patient ?? null, qrToken });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// PUT /api/patients/:id — update patient details
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, age, address } = req.body;
  const role = req.user?.role;
  const userType = req.user?.type;

  // Patient can only update their own record
  if (userType === 'patient' && req.user?.sub !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Pharmacy cannot update patients
  if (role === 'PHARMACY') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { data, error } = await db
      .from('patients')
      .update({ name, age, address })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, patient: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

export default router;
