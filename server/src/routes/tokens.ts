import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

// POST /api/tokens/register
router.post('/register', async (req: Request, res: Response) => {
  const { phone, name, age, address, priority = 2, department, doctor_id, room_number } = req.body;

  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    // Upsert patient
    let patientId: string | null = null;
    if (name) {
      const { data: existing } = await db.from('patients').select('id').eq('phone', phone).maybeSingle();
      if (existing) {
        patientId = existing.id;
        await db.from('patients').update({ name, age: age ?? 0, address: address ?? '' }).eq('id', patientId);
      } else {
        const { data: created, error } = await db
          .from('patients')
          .insert({ phone, name, age: age ?? 0, address: address ?? '' })
          .select('id')
          .single();
        if (error) return res.status(400).json({ error: error.message });
        patientId = created.id;
      }
    }

    // Get today's max token number
    const today = new Date().toISOString().split('T')[0];
    const { data: lastToken } = await db
      .from('tokens')
      .select('token_number')
      .gte('created_at', `${today}T00:00:00`)
      .order('token_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tokenNumber = (lastToken?.token_number ?? 0) + 1;

    const { data: token, error: te } = await db
      .from('tokens')
      .insert({
        phone,
        patient_id: patientId,
        status: 'WAITING',
        priority,
        token_number: tokenNumber,
        intake_status: 'ARRIVED',
        department: department ?? null,
        doctor_id: doctor_id ?? null,
        room_number: room_number ?? null,
      })
      .select('*, patients(*)')
      .single();

    if (te) return res.status(400).json({ error: te.message });
    return res.json({ success: true, token });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// GET /api/tokens/queue
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const { data: waiting, error: we } = await db
      .from('tokens')
      .select('*, patients(*), patient_intake(*)')
      .eq('status', 'WAITING')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (we) return res.status(400).json({ error: we.message });

    const { data: serving } = await db
      .from('tokens')
      .select('*, patients(*), patient_intake(*)')
      .eq('status', 'SERVING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.json({ waiting: waiting ?? [], serving: serving ?? null });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// GET /api/tokens/status/:phone
router.get('/status/:phone', async (req: Request, res: Response) => {
  const { phone } = req.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: token } = await db
      .from('tokens')
      .select('*')
      .eq('phone', decodeURIComponent(phone))
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!token) return res.json({ token: null, ahead: 0 });

    let ahead = 0;
    if (token.status === 'WAITING') {
      const { count } = await db
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'WAITING')
        .or(`priority.lt.${token.priority},and(priority.eq.${token.priority},created_at.lt.${token.created_at})`);
      ahead = count ?? 0;
    }

    return res.json({ token, ahead });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// POST /api/tokens/next
router.post('/next', async (_req: Request, res: Response) => {
  try {
    const { data: current } = await db.from('tokens').select('id').eq('status', 'SERVING').maybeSingle();
    if (current) {
      await db.from('tokens').update({ status: 'DONE', intake_status: 'COMPLETED' }).eq('id', current.id);
    }

    const { data: next, error: ne } = await db
      .from('tokens')
      .select('*')
      .eq('status', 'WAITING')
      .eq('intake_status', 'READY_FOR_DOCTOR')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ne) return res.status(400).json({ error: ne.message });
    if (!next) return res.json({ success: true, token: null, message: 'No patient ready for doctor' });

    const { data: updated, error: ue } = await db
      .from('tokens')
      .update({ status: 'SERVING', intake_status: 'WITH_DOCTOR' })
      .eq('id', next.id)
      .select('*, patients(*), patient_intake(*)')
      .single();

    if (ue) return res.status(400).json({ error: ue.message });
    return res.json({ success: true, token: updated });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// POST /api/tokens/done/:id
router.post('/done/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data, error } = await db
      .from('tokens')
      .update({ status: 'DONE', intake_status: 'COMPLETED' })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, token: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// POST /api/tokens/noshow/:id
router.post('/noshow/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data, error } = await db
      .from('tokens')
      .update({ status: 'NO_SHOW', intake_status: 'COMPLETED' })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, token: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

export default router;
