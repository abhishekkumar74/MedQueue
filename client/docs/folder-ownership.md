# MedQueue Developer Folder Ownership Guide

Welcome to the MedQueue engineering team! This guide establishes codebase ownership boundaries, architectural standards, and feature boundary policies to help new developers navigate and maintain the platform cleanly.

---

## 📂 Codebase Responsibility Map

To prevent modular entanglement, the directory tree is organized by strict ownership layers.

```
client/src/
  ├── store/              # Owner: Core Platform Architects
  │                       # Purpose: Standard global persistency controllers & PWA session state managers.
  ├── constants/          # Owner: Technical Product Managers / Clinical Admins
  │                       # Purpose: System-wide configs, medicine rosters, prescription templates.
  ├── types/              # Owner: Lead TypeScript Engineers
  │                       # Purpose: Global type declarations, priority classifications, database interfaces.
  ├── components/          # Owner: UI/UX Frontend Engineers
  │                       # Purpose: Dumb, stateless reusable interfaces (inputs, selectors, custom banners).
  ├── layouts/             # Owner: UI/UX Frontend Engineers
  │                       # Purpose: App envelopes, navigation wrappers, dynamic headers.
  ├── lib/                 # Owner: Core Platform Architects
  │                       # Purpose: Stateless API integrations, dates calculators, analytics, and tenant resolvers.
  └── features/            # Owner: Feature Domain Engineers (By capability area)
      ├── auth/            # Capability: Authentication portals & login nodes
      ├── patient/         # Capability: Patient workspaces & medical timeline records
      ├── doctor/          # Capability: Practitioner dashboard console & prescriptions signing
      ├── pharmacy/        # Capability: Inventory ledger & prescription dispensing desk
      └── queue/           # Capability: Patient triage intake, display boards, and live tokens tracking
```

---

## 🛡️ Feature Boundary Guidelines

When creating new files or implementing features, strictly adhere to these three core boundary rules:

### 1. The Barrel Exports Policy
- Features must **never** perform deep relative imports into other feature directories (e.g. `import X from '../doctor/pages/DoctorPanel'`).
- Always import via the target feature's barrel module (e.g. `import { DoctorPanel } from '../doctor'`).
- This decouples internal changes inside feature subfolders from outer consumers.

### 2. Service Extraction Policy
- Keep stateful page files inside `<feature>/pages/` strictly focused on rendering visual interfaces, layouts, and managing local UI states.
- Move heavy network request chains, Supabase hooks, and domain logic calculations into dedicated services (e.g., `<feature>/services/`) or domain-specific hooks (e.g., `<feature>/hooks/`).

### 3. Local Isolation Rule
- A feature under `features/` must remain self-contained. 
- If a sub-component is only used inside a single page of a domain (e.g. the medication rows list inside the Doctor Panel), place it directly inside that domain folder. Only promote files to the global `components/` or `layouts/` directory when they are genuinely used across **multiple separate feature domains**.
