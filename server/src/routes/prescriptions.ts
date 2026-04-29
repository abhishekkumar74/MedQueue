import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/prescriptions — Doctor only
router.post('/', requireRole('DOCTOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { token_id, patient_id, diagnosis, medications, doctor_notes } = req.body;

  if (!token_id || !patient_id) return res.status(400).json({ error: 'token_id and patient_id required' });
  if (!diagnosis || !medications || medications.length === 0) {
    return res.status(400).json({ error: 'diagnosis and at least one medication required' });
  }

  try {
    const { data: intake } = await db
      .from('patient_intake')
      .select('bp, sugar, symptoms')
      .eq('token_id', token_id)
      .maybeSingle();

    const { data: visit, error: ve } = await db
      .from('visits')
      .insert({
        patient_id,
        token_id,
        doctor_id: req.user?.sub ? await getDoctorIdForStaff(req.user.sub) : null,
        bp: intake?.bp ?? '',
        sugar: intake?.sugar ?? '',
        symptoms: intake?.symptoms ?? '',
        doctor_notes: doctor_notes ?? '',
      })
      .select('id')
      .single();

    if (ve) return res.status(400).json({ error: ve.message });

    const { data: prescription, error: pe } = await db
      .from('prescriptions')
      .insert({ token_id, patient_id, visit_id: visit.id, diagnosis, medications, status: 'PENDING', notes: '' })
      .select()
      .single();

    if (pe) return res.status(400).json({ error: pe.message });

    await db.from('tokens').update({ status: 'DONE', intake_status: 'COMPLETED' }).eq('id', token_id);

    return res.json({ success: true, prescription });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// GET /api/prescriptions/pending — Pharmacy sees PENDING/IN_PROGRESS (no full history)
router.get('/pending', async (req: Request, res: Response) => {
  const role = req.user?.role;

  // Pharmacy sees limited fields; Doctor/Admin see everything
  const selectFields = role === 'PHARMACY'
    ? '*, tokens(token_number, phone), patients(name, age)'
    : '*, tokens(*), patients(*)';

  try {
    const { data, error } = await db
      .from('prescriptions')
      .select(selectFields)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data ?? []);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// POST /api/prescriptions/:id/dispense — Pharmacy only
router.post('/:id/dispense', requireRole('PHARMACY', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dispensed_by } = req.body;

  try {
    const { data: current, error: ge } = await db
      .from('prescriptions').select('status').eq('id', id).single();

    if (ge) return res.status(404).json({ error: 'Prescription not found' });
    if (current.status === 'DISPENSED') return res.status(409).json({ error: 'Already dispensed' });
    if (current.status === 'CANCELLED') return res.status(409).json({ error: 'Cannot dispense cancelled prescription' });

    const { data, error } = await db
      .from('prescriptions')
      .update({ status: 'DISPENSED', dispensed_at: new Date().toISOString(), dispensed_by: dispensed_by ?? req.user?.name })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, prescription: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// Helper: get doctor record id from staff_user id
async function getDoctorIdForStaff(staffUserId: string): Promise<string | null> {
  const { data } = await db
    .from('doctors')
    .select('id')
    .eq('staff_user_id', staffUserId)
    .maybeSingle();
  return data?.id ?? null;
}

export default router;
