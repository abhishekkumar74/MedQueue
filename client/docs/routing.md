# MedQueue Routing Architecture

This document describes the state-driven router architecture implemented in MedQueue. Understanding this flow is essential for managing navigation paths, login redirects, and deep links.

---

## State-Based Router Overview

MedQueue uses a robust **state-based routing mechanism** inside `client/src/App.tsx`. Rather than delegating transitions entirely to an external heavy browser routing library, the application drives layouts using a reactive central `page` state enum.

```
       [ General Landing '/' ]
                 │
                 ▼
         [ Resolve Tenant? ]
        /                 \
     [Yes]                [No]
      /                     \
[ Hospital Landing ]     [ LandingPage ]
  - Patient Portal         - General Info
  - Staff Portal           - SaaS Docs
  - Live Tracker           - System Settings
```

---

## 1. Page State Catalog

The routing system supports the following core views:
- `landing`: The general MedQueue corporate home page.
- `hospital-landing`: The landing page of a specific resolved clinic branch.
- `patient-login` / `staff-login` / `super-admin-login`: Domain login portals.
- `register`: The Patient Outpatient Workspace (requires authentication).
- `appointment`: Appointment Booking screen.
- `tracker`: Outpatient Queue live token numbers viewer.
- `staff`: Doctor console & Ward Boy intake control dashboard (requires staff session).
- `pharmacy`: Pharmacist prescription desk dashboard (requires pharmacy role).
- `super-admin`: Central multi-hospital platform configuration node.

---

## 2. Navigation Actions & Redirects

Transitions are executed using the central `navigate(toPage, state)` handler function.

### Session Authentication Gate
When a state changes, the router evaluates the session context.
1. If a user is not logged in but tries to access `register` or `staff`, the router intercepts the call and forces a redirect to the respective `login` view.
2. After a successful authentication trigger:
   - Patients are redirected to their assigned clinic workspace (`register`).
   - Practitioners and Ward Boys are routed to their designated intake consoles (`staff`).
   - Pharmacists are navigated to `pharmacy`.

### Role-Based Target Resolvers (`getHomeRoute`)
The helper `getHomeRoute(user, slug)` ensures the user lands in the correct home panel based on their authorization privileges:
- `SUPER_ADMIN` -> `super-admin`
- `ADMIN` -> `staff`
- `DOCTOR` -> `staff`
- `WARD_BOY` -> `staff`
- `PHARMACY` -> `pharmacy`
- `patient` (or default) -> `register`

---

## 3. Deep Linking & History States

To preserve user expectations when clicking the browser's **Back** button or reloading the page, MedQueue connects reactive page states to browser history:

### Synchronization with History API
Whenever `navigate(page, state)` is invoked, it updates the browser history stack:
```typescript
window.history.pushState({ page, tenantSlug }, '', urlPath);
```

### Deep Link Resolution
During application boot, `App.tsx` reads `window.location.pathname` and parses path parts:
- `/h/:slug` -> Resolves tenant configuration and displays the clinic branch landing.
- `/h/:slug/patient` -> Resolves the clinic, gates authentication, and lands in the Patient Workspace.
- `/h/:slug/staff` -> Sets clinic context and gates Staff Login.
- `/h/:slug/tracker` -> Directly views the branch's Live Token Display Board.

This robust state-driven routing structure is fully compiled and optimized to compile quickly, resulting in lightning-fast initial load speeds and zero layout flickering.
