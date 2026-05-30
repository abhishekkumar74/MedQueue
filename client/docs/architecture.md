# MedQueue Architecture Documentation

This document explains the **feature-first (domain-driven) architecture** deployed across the MedQueue healthcare SaaS client codebase. Grouping directories and page modules by business capability ensures the application is highly decoupled, highly maintainable, and clear for new onboarding developers.

---

## Codebase Directory Blueprint

The MedQueue client application is structured as follows under `client/src/`:

```
client/src/
  ├── components/          # Shared, pure base UI components (reusable across all domains)
  │   ├── ErrorBoundary.tsx
  │   ├── OfflineIndicator.tsx
  │   ├── PhoneInput.tsx
  │   ├── HospitalSelector.tsx
  │   └── index.ts         # Components barrel export
  ├── layouts/             # Shared app structures, global wrappers, and header navigation
  │   ├── UniversalHeader.tsx
  │   ├── SetupBanner.tsx
  │   └── index.ts         # Layouts barrel export
  ├── lib/                 # Core shared services, utilities, and API client integrations
  │   ├── analytics.ts     # Telemetry tracking & logs
  │   ├── api.ts           # Shared server requests interface
  │   ├── auth.ts          # Authentication business logic & helpers
  │   ├── dateUtils.ts     # Date conversion & multi-timezone (IST) formatting
  │   ├── supabase.ts      # Supabase client instantiation
  │   └── tenant.ts        # Tenant slug resolution & brand config mappings
  ├── features/            # Domain-driven isolated business capabilities
  │   ├── auth/            # Auth Domain (Logins & Registration portals)
  │   ├── patient/         # Outpatient metrics & records tracking
  │   ├── doctor/          # Practitioner console & availability controls
  │   ├── pharmacy/        # Medication inventory & prescription dispensing
  │   ├── queue/           # Intake, live token trackers & digital displays
  │   ├── hospitals/       # Tenant branches landings
  │   ├── appointments/    # Outpatient consultation bookings
  │   ├── admin/           # Super Admin & Clinic Admin control pads
  │   └── landing/         # General non-tenant home and routing landings
  ├── App.tsx              # Root controller / State-based Router
  ├── main.tsx             # Application entry point
  ├── types.ts             # Global domain TypeScript type declarations
  └── index.css            # Styles system (TailwindCSS)
```

---

## Architectural Layers

To prevent modular entanglement and circular dependency spaghetti, the codebase is divided into four strict operational layers:

### 1. Shared Utilities (`client/src/lib/`)
Contains pure services and database clients. 
- Files here are completely stateless.
- They must never import files from `features/` or `layouts/`.

### 2. Base Interfaces & Reusable Shells (`client/src/components/` & `client/src/layouts/`)
Common design tokens, shared layout envelopes, global banners, and headers.
- **Components** (`components/`): Dumb, reusable, and visual primitives (e.g. custom inputs, boundary wrappers, selectors).
- **Layouts** (`layouts/`): Global containers and header components that surround features, passing logged-in user state down safely.

### 3. Business Domains (`client/src/features/`)
Self-contained packages organized around single business capabilities. Each feature folder has:
- **`pages/`**: Stateful router-level views (e.g., `DoctorPanel.tsx`, `LiveTokenTracker.tsx`).
- **`index.ts`**: The barrel file. Only exports components that are designed to be visible to outer features (e.g. cross-feature panels used inside compound dashboards).

### 4. Root Router (`client/src/App.tsx` & `client/src/main.tsx`)
The central switchboard that instantiates global states (authenticated session, tenant context) and routes requests dynamically.

---

## Barrel Exports Pattern (`index.ts`)

To avoid deeply nested and repetitive import declarations, every folder boundary exports a single module `index.ts` containing the shared public API.

Instead of writing:
```tsx
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
```

Outer features and the root router import from the barrel file:
```tsx
import { LoginPage, RegisterPage } from './features/auth';
```

This decoupling ensures that internal feature file structures can be refactored safely without affecting imports in the rest of the application.
