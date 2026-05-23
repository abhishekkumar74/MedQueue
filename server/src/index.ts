import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Allowed client origins ────────────────────────────────
const RAW_ORIGINS = process.env.CLIENT_URL ?? 'http://localhost:5173';
const ALLOWED_ORIGINS: string[] = RAW_ORIGINS.split(',').map((o) => o.trim());

// ── Helmet — security headers ─────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", ...ALLOWED_ORIGINS],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false, // relaxed in dev
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// ── Strict CORS ───────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser / server-to-server calls (no Origin header)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hospital-ID'],
  })
);

// ── Body / payload limits ─────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));

// ── Rate limiters ─────────────────────────────────────────
/** Global limiter — 200 requests / minute per IP */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

/** Auth limiter — 10 attempts / 15 minutes per IP (brute-force guard) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts — try again in 15 minutes.' },
  skipSuccessfulRequests: true, // only count failed attempts
});

app.use(globalLimiter);

// ── Health check (unauthenticated, rate-limited by global) ─
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public routes ─────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);

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
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Never leak stack traces or internal details in production
  if (IS_PROD) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } else {
    console.error('[ERROR]', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ MedQueue API server running on http://localhost:${PORT}`);
  console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`   Security: Helmet ✓  Rate-limiting ✓  Strict CORS ✓`);
});
