import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import tokenRoutes from './routes/tokens.js';
import intakeRoutes from './routes/intake.js';
import prescriptionRoutes from './routes/prescriptions.js';
import appointmentRoutes from './routes/appointments.js';
import patientRoutes from './routes/patients.js';
import doctorRoutes from './routes/doctors.js';
import { requireAuth, requireRole } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public routes (no auth needed) ───────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes ──────────────────────────────────────

// Tokens — ward boy registers, staff manages queue
app.use('/api/tokens', requireAuth, tokenRoutes);

// Intake — ward boy only
app.use('/api/intake', requireAuth, requireRole('WARD_BOY', 'ADMIN'), intakeRoutes);

// Prescriptions — doctor creates, pharmacy reads
app.use('/api/prescriptions', requireAuth, prescriptionRoutes);

// Appointments — any authenticated user
app.use('/api/appointments', requireAuth, appointmentRoutes);

// Patients — role-based inside the route
app.use('/api/patients', requireAuth, patientRoutes);

// Doctors list — public read for routing display
app.use('/api/doctors', doctorRoutes);

// ── 404 handler ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ MedQueue API server running on http://localhost:${PORT}`);
  console.log(`   Accepting requests from: ${CLIENT_URL}`);
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
});
