import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

// POST /api/appointments
router.post('/', async (req: Request, res: Response) => {
  const { phone, patient_name, department, doctor_id, appointment_date, time_slot, consultation_fee = 0 } = req.body;

  if (!phone || !patient_name || !department || !appointment_date || !time_slot) {
    return res.status(400).json({ error: 'phone, patient_name, department, appointment_date, and time_slot required' });
  }

  try {
    // Check slot conflict
    if (doctor_id) {
      const { data: existing } = await db
        .from('appointments')
        .select('id')
        .eq('doctor_id', doctor_id)
        .eq('appointment_date', appointment_date)
        .eq('time_slot', time_slot)
        .maybeSingle();

      if (existing) return res.status(409).json({ error: 'Time slot already booked' });
    }

    const { data: patient } = await db.from('patients').select('id').eq('phone', phone).maybeSingle();

    const { data, error } = await db
      .from('appointments')
      .insert({
        patient_id: patient?.id ?? null,
        phone,
        patient_name,
        department,
        doctor_id: doctor_id ?? null,
        appointment_date,
        time_slot,
        status: 'SCHEDULED',
        consultation_fee,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true, appointment: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

// GET /api/appointments/slots?date=YYYY-MM-DD&doctor_id=xxx
router.get('/slots', async (req: Request, res: Response) => {
  const { date, doctor_id } = req.query as { date?: string; doctor_id?: string };

  if (!date) return res.status(400).json({ error: 'date query parameter required' });

  try {
    const query = db
      .from('appointments')
      .select('time_slot')
      .eq('appointment_date', date)
      .in('status', ['SCHEDULED', 'CONFIRMED']);

    if (doctor_id) query.eq('doctor_id', doctor_id);

    const { data: booked } = await query;
    const bookedSlots = new Set((booked ?? []).map((a: { time_slot: string }) => a.time_slot));

    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endMin = min + 30;
        const endHour = endMin >= 60 ? hour + 1 : hour;
        const endTime = `${endHour.toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
        const slotStr = `${startTime}-${endTime}`;
        slots.push({ id: slotStr, startTime, endTime, available: !bookedSlots.has(slotStr), doctorId: doctor_id ?? '' });
      }
    }

    return res.json(slots);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' });
  }
});

export default router;
