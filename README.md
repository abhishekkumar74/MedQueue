# 🏥 MedQueue — Hospital Queue Management System

A production-ready PWA for managing hospital patient queues with role-based access control.

## Features

- **Patient Registration** — Phone-based registration with token generation
- **Live Token Tracker** — Real-time queue status via Supabase Realtime
- **Role-Based Dashboards**
  - 👨‍⚕️ **Doctor** — Sees only their department's patients, writes prescriptions
  - 🏥 **Ward Boy** — Patient intake (vitals, symptoms), filtered by department
  - 💊 **Pharmacy** — Prescription queue, dispense medications
  - 🔐 **Admin** — Full hospital overview
- **Appointment Booking** — Schedule appointments with time slots
- **PWA Support** — Installable on mobile, works offline
- **OTP Login** — Patients login via phone + OTP

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Database**: Supabase (PostgreSQL + Realtime + RLS)
- **Auth**: Custom RBAC with bcrypt password hashing
- **Deploy**: Vercel (frontend) + Supabase (backend)

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/your-username/medqueue.git
cd medqueue
```

### 2. Setup environment
```bash
cp client/.env.example client/.env
# Fill in your Supabase URL and anon key in client/.env
```


### 4. Install and run
```bash
npm install --prefix client
npm run dev:client
```




## Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Deploy

## Project Structure

```
medqueue/
├── client/                 # React PWA frontend
│   ├── src/
│   │   ├── pages/          # All page components
│   │   ├── components/     # Shared components
│   │   └── lib/            # API, auth, supabase client
│   └── .env.example        # Environment template
├── server/                 # Express API (optional)
├── supabase/
│   ├── COMPLETE_SETUP.sql  # Run this once to setup DB
│   ├── ADD_STAFF.sql       # Template for adding staff
│   └── FIX_OTP_RLS.sql     # Fix if OTP login fails
└── vercel.json             # Vercel deployment config
```

## Security

- All passwords  are encyrpted
- Row Level Security (RLS) enabled on all tables
- Environment variables never committed to git
- Security headers configured in vercel.json
- Role-based data isolation (doctors see only their dept)

## Version

**v1.0.0** — Production ready for hospital use

- This project is the intellectual property of Abhishek Kumar. Unauthorized use or reproduction is prohibited.
