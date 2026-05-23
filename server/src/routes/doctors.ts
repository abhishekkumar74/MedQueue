import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { filterTenant } from '../utils/tenant.js';

const router = Router();

// GET /api/doctors — public, used for patient routing display
router.get('/', async (req: Request, res: Response) => {
  try {
    let query = db
      .from('doctors')
      .select('id, name, specialty, department, room_number, is_available')
      .eq('is_available', true);

    const targetHospital = req.query.hospital_id as string || req.user?.hospital_id;
    if (targetHospital) {
      query = query.eq('hospital_id', targetHospital);
    }

    const { data, error } = await query.order('department');

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data ?? []);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// GET /api/doctors/:id/queue — how many patients waiting for this doctor
router.get('/:id/queue', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { count } = await db
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', id)
      .eq('status', 'WAITING');

    return res.json({ doctorId: id, waiting: count ?? 0 });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// PUT /api/doctors/:id/availability — doctor toggles availability
router.put('/:id/availability', requireAuth, requireRole('DOCTOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_available } = req.body;

  try {
    let checkQuery = db.from('doctors').select('hospital_id').eq('id', id);
    checkQuery = filterTenant(checkQuery, req.user);
    const { data: check } = await checkQuery.maybeSingle();
    if (!check) return res.status(403).json({ error: 'Doctor not found in your hospital context' });

    const { data, error } = await db
      .from('doctors')
      .update({ is_available })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, doctor: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

export default router;
