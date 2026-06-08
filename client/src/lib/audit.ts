import { supabase } from './supabase'

interface AuditEntry {
  actorId?: string
  actorName?: string
  actorRole?: string
  actorEmail?: string
  actionType: string
  actionLabel: string
  entityType?: string
  entityId?: string
  entityLabel?: string
  clinicId?: string
  clinicName?: string
  metadata?: Record<string, unknown>
  isSuspicious?: boolean
}

// Call this whenever a significant action occurs
export async function logAuditEvent(entry: AuditEntry) {
  try {
    // Attempt to enrich with current authenticated session if available
    let resolvedActorId = entry.actorId
    let resolvedActorEmail = entry.actorEmail
    let resolvedActorRole = entry.actorRole
    let resolvedActorName = entry.actorName

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (user) {
        resolvedActorId = resolvedActorId || user.id
        resolvedActorEmail = resolvedActorEmail || user.email
        resolvedActorRole = resolvedActorRole || (user.user_metadata?.role || 'admin')
        resolvedActorName = resolvedActorName || (user.user_metadata?.name || user.email?.split('@')[0] || 'System')
      }
    } catch (_) {
      // Ignore session fetch errors
    }

    await supabase.from('audit_log').insert({
      actor_id:     resolvedActorId,
      actor_name:   resolvedActorName || 'Super Admin',
      actor_role:   resolvedActorRole || 'SUPER_ADMIN',
      actor_email:  resolvedActorEmail || 'admin@medqueue.com',
      action_type:  entry.actionType,
      action_label: entry.actionLabel,
      entity_type:  entry.entityType,
      entity_id:    entry.entityId,
      entity_label: entry.entityLabel,
      clinic_id:    entry.clinicId,
      clinic_name:  entry.clinicName,
      metadata:     entry.metadata ?? {},
      is_suspicious: entry.isSuspicious ?? false,
      created_at:   new Date().toISOString(),
    })
  } catch (err) {
    console.error('Audit log failed:', err)
    // Never throw — audit logging must not break main flow
  }
}

// Pre-built helpers for common actions
export const auditActions = {
  tokenDeleted:      (tokenId: string, clinicName: string) =>
    logAuditEvent({ actionType: 'token_deleted', actionLabel: `Deleted token #${tokenId}`, entityType: 'token', entityId: tokenId, clinicName }),

  staffSuspended:    (staffName: string, clinicName: string) =>
    logAuditEvent({ actionType: 'staff_suspended', actionLabel: `Suspended staff: ${staffName}`, entityType: 'staff', entityLabel: staffName, clinicName }),

  queueReset:        (clinicName: string) =>
    logAuditEvent({ actionType: 'queue_reset', actionLabel: `Force-reset queue for ${clinicName}`, entityType: 'clinic', clinicName }),

  alertResolved:     (alertTitle: string) =>
    logAuditEvent({ actionType: 'alert_resolved', actionLabel: `Resolved alert: ${alertTitle}`, entityType: 'alert' }),

  broadcastSent:     (message: string, target: string) =>
    logAuditEvent({ actionType: 'broadcast_sent', actionLabel: `Broadcast sent to ${target}: "${message.slice(0, 55)}"`, entityType: 'broadcast' }),

  clinicSetupDone:   (clinicName: string) =>
    logAuditEvent({ actionType: 'clinic_created', actionLabel: `New clinic setup: ${clinicName}`, entityType: 'clinic', clinicName }),

  staffRoleChanged:  (staffName: string, oldRole: string, newRole: string) =>
    logAuditEvent({ actionType: 'role_changed', actionLabel: `Role changed: ${staffName} → ${oldRole} to ${newRole}`, entityType: 'staff', entityLabel: staffName }),

  planChanged:       (clinicName: string, newPlan: string) =>
    logAuditEvent({ actionType: 'plan_changed', actionLabel: `${clinicName} plan changed to ${newPlan}`, entityType: 'clinic', clinicName }),
}
