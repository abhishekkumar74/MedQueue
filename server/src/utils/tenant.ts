import { JwtPayload } from '../auth/jwt.js';

/**
 * Get target hospital ID based on user authorization.
 * If user is SUPER_ADMIN, they can bypass local hospital restrictions and request any hospital.
 * Otherwise, they are locked to their own hospital_id.
 */
export function getTenantHospitalId(user: JwtPayload | undefined, requestedHospitalId?: string): string {
  if (user?.role === 'SUPER_ADMIN') {
    return requestedHospitalId || user.hospital_id || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  }
  return user?.hospital_id || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
}

/**
 * Enforce multi-tenant logical filtering on a Supabase query.
 * For SUPER_ADMIN, limits by hospital_id only if requestedHospitalId is supplied.
 * For regular staff or patients, strictly filters by their own hospital_id.
 */
export function filterTenant(
  query: any,
  user: JwtPayload | undefined,
  requestedHospitalId?: string
) {
  if (!user) return query;
  if (user.role === 'SUPER_ADMIN') {
    if (requestedHospitalId) {
      return query.eq('hospital_id', requestedHospitalId);
    }
    return query;
  }
  const tenantId = user.hospital_id || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  return query.eq('hospital_id', tenantId);
}
