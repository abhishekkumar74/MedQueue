# 🏥 MedQueue — Hospital Queue Management System

A production-ready Progressive Web App (PWA) for managing hospital patient queues with role-based access control.

## Features

- **Patient Registration** — Phone-based registration with token generation
- **Live Token Tracker** — Real-time queue status
- **Role-Based Dashboards** — Doctor, Ward Boy, Pharmacy, Admin
- **Appointment Booking** — Schedule appointments with time slots
- **PWA Support** — Installable on mobile, works offline
- **OTP Login** — Patients login via phone number

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Database**: Supabase (PostgreSQL + Realtime + RLS)
- **Deploy**: Vercel

## Getting Started

```bash
git clone https://github.com/abhishekkumar74/MedQueue.git
cd MedQueue
cp client/.env.example client/.env
# Add your Supabase credentials in client/.env
npm install --prefix client
npm run dev:client
```

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Security

- Passwords hashed with bcrypt via pgcrypto
- Row Level Security (RLS) on all tables
- Brute force login protection
- Environment variables never committed to git
- Role-based data isolation per department

## License

Private — All rights reserved.
