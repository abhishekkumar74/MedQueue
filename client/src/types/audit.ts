export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorName: string
  actorRole: string
  actorEmail: string
  actionType: string
  actionLabel: string
  entityType: string | null
  entityId: string | null
  entityLabel: string | null
  clinicId: string | null
  clinicName: string | null
  ipAddress: string | null
  metadata: Record<string, unknown>
  isSuspicious: boolean
  createdAt: string
}

export interface AuditFilters {
  search: string
  clinicId: string | null
  actionType: string | null
  actorRole: string | null
  dateFrom: string | null
  dateTo: string | null
  suspiciousOnly: boolean
}
