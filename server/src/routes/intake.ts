import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/intake/token/:tokenId
router.get('/token/:tokenId', async (req: Request, res: Response) => {
  const { tokenId } = req.params;
  try {
    const { data, error } = await db
      .from('patient_intake')
      .select('*')
      .eq('token_id', tokenId)
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data ?? null);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// POST /api/intake/start
router.post('/start', async (req: Request, res: Response) => {
  const { token_id } = req.body;
  if (!token_id) return res.status(400).json({ error: 'token_id required' });

  try {
    const { data: token, error: te } = await db
      .from('tokens')
      .select('patient_id')
      .eq('id', token_id)
      .maybeSingle();

    if (te || !token) return res.status(404).json({ error: 'Token not found' });
    if (!token.patient_id) return res.status(400).json({ error: 'Patient not linked to token' });

    const { data: intake, error: ie } = await db
      .from('patient_intake')
      .insert({ token_id, patient_id: token.patient_id })
      .select()
      .single();

    if (ie) return res.status(400).json({ error: ie.message });
    return res.json({ success: true, intake });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// PUT /api/intake/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { bp, sugar, temperature, symptoms, notes } = req.body;

  try {
    const { data, error } = await db
      .from('patient_intake')
      .update({ bp: bp ?? '', sugar: sugar ?? '', temperature: temperature ?? '', symptoms: symptoms ?? '', notes: notes ?? '', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Mark token ready for doctor
    await db.from('tokens').update({ intake_status: 'READY_FOR_DOCTOR' }).eq('id', data.token_id);

    return res.json({ success: true, intake: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

export default router;
