import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { getTenantHospitalId, filterTenant } from '../utils/tenant.js';

const router = Router();

// POST /api/tokens/register
router.post('/register', async (req: Request, res: Response) => {
  const { phone, name, age, address, priority = 2, department, doctor_id, room_number } = req.body;

  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const hospitalId = getTenantHospitalId(req.user, req.body.hospital_id);

  try {
    // Upsert patient
    let patientId: string | null = null;
    if (name) {
      const { data: existing } = await db.from('patients')
        .select('id')
        .eq('phone', phone)
        .eq('hospital_id', hospitalId)
        .maybeSingle();

      if (existing) {
        patientId = existing.id;
        await db.from('patients')
          .update({ name, age: age ?? 0, address: address ?? '' })
          .eq('id', patientId);
      } else {
        const { data: created, error } = await db
          .from('patients')
          .insert({ phone, name, age: age ?? 0, address: address ?? '', hospital_id: hospitalId })
          .select('id')
          .single();
        if (error) return res.status(400).json({ error: error.message });
        patientId = created.id;
      }
    }

    // Get today's max token number for this hospital and department (composite sequencer)
    const today = new Date().toISOString().split('T')[0];
    const { data: lastToken } = await db
      .from('tokens')
      .select('token_number')
      .eq('hospital_id', hospitalId)
      .eq('department', department ?? '')
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
        hospital_id: hospitalId,
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
router.get('/queue', async (req: Request, res: Response) => {
  const department = req.query.department as string | undefined;
  const targetHospital = req.query.hospital_id as string | undefined;

  try {
    let waitingQuery = db.from('tokens').select('*, patients(*), patient_intake(*)').eq('status', 'WAITING');
    waitingQuery = filterTenant(waitingQuery, req.user, targetHospital);
    if (department) {
      waitingQuery = waitingQuery.eq('department', department);
    }
    const { data: waiting, error: we } = await waitingQuery
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (we) return res.status(400).json({ error: we.message });

    let servingQuery = db.from('tokens').select('*, patients(*), patient_intake(*)').eq('status', 'SERVING');
    servingQuery = filterTenant(servingQuery, req.user, targetHospital);
    if (department) {
      servingQuery = servingQuery.eq('department', department);
    }
    const { data: serving } = await servingQuery
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
  const targetHospital = req.query.hospital_id as string | undefined;

  try {
    let tokenQuery = db.from('tokens').select('*').eq('phone', decodeURIComponent(phone)).gte('created_at', `${today}T00:00:00`);
    tokenQuery = filterTenant(tokenQuery, req.user, targetHospital);
    const { data: token } = await tokenQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!token) return res.json({ token: null, ahead: 0 });

    let ahead = 0;
    if (token.status === 'WAITING') {
      let aheadQuery = db.from('tokens').select('*', { count: 'exact', head: true }).eq('status', 'WAITING');
      aheadQuery = filterTenant(aheadQuery, req.user, targetHospital || token.hospital_id);
      const { count } = await aheadQuery
        .or(`priority.lt.${token.priority},and(priority.eq.${token.priority},created_at.lt.${token.created_at})`);
      ahead = count ?? 0;
    }

    return res.json({ token, ahead });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// POST /api/tokens/next
router.post('/next', async (req: Request, res: Response) => {
  const department = req.body.department as string | undefined;
  const hospitalId = getTenantHospitalId(req.user, req.body.hospital_id);

  try {
    let currentQuery = db.from('tokens').select('id').eq('status', 'SERVING').eq('hospital_id', hospitalId);
    if (department) currentQuery = currentQuery.eq('department', department);
    const { data: current } = await currentQuery.maybeSingle();

    if (current) {
      await db.from('tokens').update({ status: 'DONE', intake_status: 'COMPLETED' }).eq('id', current.id);
    }

    let nextQuery = db
      .from('tokens')
      .select('*')
      .eq('status', 'WAITING')
      .eq('intake_status', 'READY_FOR_DOCTOR')
      .eq('hospital_id', hospitalId);
    
    if (department) nextQuery = nextQuery.eq('department', department);

    const { data: next, error: ne } = await nextQuery
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
