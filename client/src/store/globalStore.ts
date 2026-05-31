import { AuthUser } from '../lib/auth';

/**
 * MedQueue Global Persistent Store
 * Standardizes read/write access to LocalStorage and SessionStorage across components
 * to prevent developer confusion and hardcoded string typos.
 */
export const globalStore = {
  // ── Authentication & User Session ──
  getUser(): AuthUser | null {
    const raw = localStorage.getItem('mq_auth_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser(user: AuthUser | null): void {
    if (user) {
      localStorage.setItem('mq_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mq_auth_user');
    }
  },

  // ── Multi-Tenant Hospital Isolation ──
  getSelectedHospitalId(): string | null {
    return localStorage.getItem('mq_selected_hospital_id');
  },

  setSelectedHospitalId(id: string): void {
    localStorage.setItem('mq_selected_hospital_id', id);
  },

  clearSelectedHospitalId(): void {
    localStorage.removeItem('mq_selected_hospital_id');
  },

  // ── Super Admin Impersonation Panel ──
  isSuperAdminPortalActive(): boolean {
    return sessionStorage.getItem('mq_superadmin_portal_active') === 'true';
  },

  setSuperAdminPortalActive(active: boolean): void {
    if (active) {
      sessionStorage.setItem('mq_superadmin_portal_active', 'true');
    } else {
      sessionStorage.removeItem('mq_superadmin_portal_active');
    }
  },

  // ── Offline & PWA Client Cache ──
  getFamilyProfiles(phone: string): any[] {
    const raw = localStorage.getItem(`mq_family_profiles_${phone}`);
    return raw ? JSON.parse(raw) : [];
  },

  setFamilyProfiles(phone: string, profiles: any[]): void {
    localStorage.setItem(`mq_family_profiles_${phone}`, JSON.stringify(profiles));
  },

  getMedicalVault(phone: string, profileName: string): any[] {
    const raw = localStorage.getItem(`mq_medical_vault_${phone}_${profileName}`);
    return raw ? JSON.parse(raw) : [];
  },

  setMedicalVault(phone: string, profileName: string, docs: any[]): void {
    localStorage.setItem(`mq_medical_vault_${phone}_${profileName}`, JSON.stringify(docs));
  }
};
