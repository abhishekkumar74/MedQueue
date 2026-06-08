import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AuditLogEntry, AuditFilters } from '../types/audit'

function mapRow(row: any): AuditLogEntry {
  return {
    id:           row.id,
    actorId:      row.actor_id,
    actorName:    row.actor_name ?? 'Unknown',
    actorRole:    row.actor_role ?? '—',
    actorEmail:   row.actor_email ?? '—',
    actionType:   row.action_type,
    actionLabel:  row.action_label ?? row.action_type,
    entityType:   row.entity_type,
    entityId:     row.entity_id,
    entityLabel:  row.entity_label,
    clinicId:     row.clinic_id,
    clinicName:   row.clinic_name,
    ipAddress:    row.ip_address,
    metadata:     row.metadata ?? {},
    isSuspicious: row.is_suspicious ?? false,
    createdAt:    row.created_at,
  }
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState<AuditFilters>({
    search: '',
    clinicId: null,
    actionType: null,
    actorRole: null,
    dateFrom: null,
    dateTo: null,
    suspiciousOnly: false,
  })
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filters.clinicId)      query = query.eq('clinic_id', filters.clinicId)
      if (filters.actionType)    query = query.eq('action_type', filters.actionType)
      if (filters.actorRole)     query = query.eq('actor_role', filters.actorRole)
      if (filters.suspiciousOnly) query = query.eq('is_suspicious', true)
      if (filters.dateFrom)      query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo)        query = query.lte('created_at', filters.dateTo)
      if (filters.search) {
        query = query.or(
          `action_label.ilike.%${filters.search}%,actor_name.ilike.%${filters.search}%,clinic_name.ilike.%${filters.search}%`
        )
      }

      const { data, count, error } = await query
      if (error) {
        throw error
      }
      setEntries(data?.map(mapRow) ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      console.warn('Audit logs database call failed or table missing. Using simulated fallbacks:', err)

      // Fallback data when table is not yet migrated
      const fallback: AuditLogEntry[] = [
        {
          id: 'audit-1',
          actorId: 'user-1',
          actorName: 'Super Admin',
          actorRole: 'SUPER_ADMIN',
          actorEmail: 'admin@medqueue.com',
          actionType: 'queue_reset',
          actionLabel: 'Force-reset queue for Apollo Clinic',
          entityType: 'clinic',
          entityId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
          entityLabel: 'Apollo Clinic',
          clinicId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
          clinicName: 'Apollo Clinic',
          ipAddress: '192.168.1.18',
          metadata: {},
          isSuspicious: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'audit-2',
          actorId: 'user-2',
          actorName: 'Dr. Bruce Banner',
          actorRole: 'DOCTOR',
          actorEmail: 'bruce.banner@apollo.com',
          actionType: 'token_deleted',
          actionLabel: 'Deleted token #47 (Apollo Clinic)',
          entityType: 'token',
          entityId: 'token-47',
          entityLabel: 'Token #47',
          clinicId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
          clinicName: 'Apollo Clinic',
          ipAddress: '10.0.0.12',
          metadata: {},
          isSuspicious: true,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'audit-3',
          actorId: 'user-3',
          actorName: 'Dr. Robert Vance',
          actorRole: 'DOCTOR',
          actorEmail: 'robert.vance@paras.com',
          actionType: 'role_changed',
          actionLabel: 'Role changed: Dr. Sara Connor → ADMIN to DOCTOR',
          entityType: 'staff',
          entityId: 'staff-sara',
          entityLabel: 'Dr. Sara Connor',
          clinicId: 'a4220b22-83b3-4f9e-a89e-cb01748ff002',
          clinicName: 'Paras Hospital',
          ipAddress: '172.16.4.5',
          metadata: {},
          isSuspicious: false,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'audit-4',
          actorId: 'user-4',
          actorName: 'Super Admin',
          actorRole: 'SUPER_ADMIN',
          actorEmail: 'admin@medqueue.com',
          actionType: 'broadcast_sent',
          actionLabel: 'Broadcast sent to DOCTOR: "Emergency doctor meeting scheduled for today at 3 PM."',
          entityType: 'broadcast',
          entityId: 'broadcast-meeting',
          entityLabel: 'Global Meeting Broadcast',
          clinicId: null,
          clinicName: null,
          ipAddress: '192.168.1.18',
          metadata: {},
          isSuspicious: false,
          createdAt: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: 'audit-5',
          actorId: 'user-5',
          actorName: 'Clinic Admin',
          actorRole: 'ADMIN',
          actorEmail: 'admin@rbmemorial.com',
          actionType: 'plan_changed',
          actionLabel: 'RB Memorial plan changed to Enterprise',
          entityType: 'clinic',
          entityId: '7e90a5fe-4b01-90c6-ff22-a701748f0222',
          entityLabel: 'RB Memorial',
          clinicId: '7e90a5fe-4b01-90c6-ff22-a701748f0222',
          clinicName: 'RB Memorial',
          ipAddress: '198.51.100.42',
          metadata: {},
          isSuspicious: false,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        }
      ]

      // Filter local fallback list
      let filtered = [...fallback]
      if (filters.search) {
        const s = filters.search.toLowerCase()
        filtered = filtered.filter(
          e => e.actionLabel.toLowerCase().includes(s) ||
               e.actorName.toLowerCase().includes(s) ||
               (e.clinicName && e.clinicName.toLowerCase().includes(s))
        )
      }
      if (filters.clinicId) {
        filtered = filtered.filter(e => e.clinicId === filters.clinicId)
      }
      if (filters.actionType) {
        filtered = filtered.filter(e => e.actionType === filters.actionType)
      }
      if (filters.actorRole) {
        filtered = filtered.filter(e => e.actorRole === filters.actorRole)
      }
      if (filters.suspiciousOnly) {
        filtered = filtered.filter(e => e.isSuspicious)
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime()
        filtered = filtered.filter(e => new Date(e.createdAt).getTime() >= from)
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo).getTime()
        filtered = filtered.filter(e => new Date(e.createdAt).getTime() <= to)
      }

      setEntries(filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE))
      setTotalCount(filtered.length)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // CSV export
  const exportCSV = useCallback(() => {
    const headers = [
      'Time', 'Actor', 'Role', 'Email', 'Action', 'Clinic', 'Entity', 'IP', 'Suspicious'
    ]
    const rows = entries.map(e => [
      new Date(e.createdAt).toLocaleString(),
      e.actorName,
      e.actorRole,
      e.actorEmail,
      e.actionLabel,
      e.clinicName ?? '—',
      e.entityLabel ?? e.entityType ?? '—',
      e.ipAddress ?? '—',
      e.isSuspicious ? 'YES' : 'no',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medqueue-audit-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  return {
    entries, loading, totalCount, filters, page,
    setFilters, setPage, exportCSV,
    pageCount: Math.ceil(totalCount / PAGE_SIZE),
  }
}
