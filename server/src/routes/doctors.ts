import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/doctors — public, used for patient routing display
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await db
      .from('doctors')
      .select('id, name, specialty, department, room_number, is_available')
      .eq('is_available', true)
      .order('department');

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
