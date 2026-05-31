# MedQueue Role Navigation & State Matrix

This document maps out the state-driven page routing, home resolvers, security gates, and action catalogs defined for each of the **7 authorized user roles** in the MedQueue multi-tenant platform.

---

## Unified Navigation Mapping

When a user logs in, `App.tsx` invokes the role-based target resolver `getHomeRoute(user, slug)` inside `client/src/lib/tenant.ts` to identify their primary home workspace view.

| User Role | Home Workspace Route | Allowed Active Page Views | Permitted Actions Catalog |
| :--- | :--- | :--- | :--- |
| **Guest / Visitor** | `landing` (or `hospital-landing`) | `landing`, `hospital-landing`, `patient-login`, `staff-login`, `tracker` | Read branch timing schedules, browse clinical practitioner rosters, register new patient profiles. |
| **Patient** | `register` (Patient Workspace) | `register`, `appointment`, `history`, `tracker` | Book consultation tokens, upload lab tests to document vaults, add family profiles, track live queue wait times. |
| **Doctor** | `staff` (Doctor Panel) | `staff` | Request next patient ticket, mark patient no-shows, inject medication templates, sign prescriptions, order diagnostics. |
| **Ward Boy** | `staff` (Intake Panel) | `staff` | Register incoming patient arrivals, capture triage vitals (BP, sugar, temp), mark patients "Ready for Doctor". |
| **Pharmacist** | `pharmacy` (Pharmacy Desk) | `pharmacy` | View prescription ledger, review medication dosages, mark orders "Dispensed" / "Out of Stock". |
| **Clinic Admin** | `staff` (Admin Dashboard) | `staff`, `pharmacy` | Manage practitioner roster slots, toggle doctor availability states, register emergency walk-ins, export CSV operations audits. |
| **Super Admin** | `super-admin` (Control Panel) | `super-admin`, `staff`, `pharmacy` | Create new tenant clinics, override tenant configurations, impersonate sub-branches, manage global subscriptions. |

---

## State Transition & Security Flow

MedQueue's state-based router gates transitions contextually to enforce role boundary rules.

```
       [ Authentication Gate Triggered ]
                      │
                      ▼
             [ Active Session? ]
            /                 \
         [Yes]                [No]
          /                     \
[ Check Role Privileges ]    [ Force LoginPage Redirect ]
  - doctor/staff -> 'staff'
  - patient      -> 'register'
  - pharmacy     -> 'pharmacy'
```

### 🔐 Route Isolation & Verification Gates
1. **Outpatient Gate**: If the browser state is set to `'register'`, but the authenticated `user.type` is not `'patient'`, the router intercepts the loop and redirects to `patient-login`.
2. **Clinical Security Gate**: Accessing the `'staff'` view requires a validated staff credentials object (`user.type === 'staff'`). Users attempting direct URL deep links without active sessions are gracefully directed to the secure `staff-login` portal.
3. **Impersonation Sandbox**: A `SUPER_ADMIN` can trigger a temporary impersonation key (`mq_selected_hospital_id` in LocalStorage). This allows the Super Admin to seamlessly inspect and modify specific clinic sub-branch states while remaining inside the central control panel.
