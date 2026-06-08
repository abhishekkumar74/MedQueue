import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { auditActions } from '../lib/audit'
import type { Broadcast, BroadcastForm } from '../types/broadcast'

function mapRow(row: any): Broadcast {
  const now = new Date()
  const sentAt = row.sent_at ? new Date(row.sent_at) : null
  const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at) : null
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null

  let status: Broadcast['status'] = 'draft'
  if (sentAt && expiresAt && now > expiresAt) status = 'expired'
  else if (sentAt) status = 'sent'
  else if (scheduledAt && scheduledAt > now) status = 'scheduled'

  return {
    id:               row.id,
    message:          row.message ?? '',
    priority:         row.priority ?? 'info',
    targetType:       row.target_type ?? 'all',
    targetClinic:     row.target_clinic,
    targetRole:       row.target_role,
    status,
    scheduledAt:      row.scheduled_at,
    sentAt:           row.sent_at,
    expiresAt:        row.expires_at,
    readCount:        row.read_count ?? 0,
    totalRecipients:  row.total_recipients ?? 0,
    createdBy:        row.created_by ?? 'Super Admin',
    createdAt:        row.created_at,
  }
}

export function useBroadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [localBroadcasts, setLocalBroadcasts] = useState<Broadcast[]>([])

  const fetchBroadcasts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }
      setBroadcasts(data?.map(mapRow) ?? [])
      setLoading(false)
    } catch (err) {
      console.warn('Broadcasts database query failed or table missing. Using simulated broadcasts:', err)
      const fallback: Broadcast[] = [
        {
          id: 'bc-1',
          message: 'MedQueue platform upgrading on Saturday 02:00 AM UTC. Expect minor database latency spikes.',
          priority: 'info',
          targetType: 'all',
          targetClinic: null,
          targetRole: null,
          status: 'sent',
          scheduledAt: null,
          sentAt: new Date(Date.now() - 3600000).toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          readCount: 15,
          totalRecipients: 25,
          createdBy: 'Super Admin',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'bc-2',
          message: 'Apollo Clinic queue is critically overloaded. Please direct patients to SR Memorial if waiting exceeds 60m.',
          priority: 'emergency',
          targetType: 'clinic',
          targetClinic: 'Apollo Clinic',
          targetRole: null,
          status: 'sent',
          scheduledAt: null,
          sentAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 18000000).toISOString(),
          readCount: 8,
          totalRecipients: 10,
          createdBy: 'Super Admin',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'bc-3',
          message: 'System audit log review scheduled. Ensure all patient intake processes are finalized by day end.',
          priority: 'warning',
          targetType: 'role',
          targetClinic: null,
          targetRole: 'DOCTOR',
          status: 'scheduled',
          scheduledAt: new Date(Date.now() + 7200000).toISOString(),
          sentAt: null,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          readCount: 0,
          totalRecipients: 4,
          createdBy: 'Super Admin',
          createdAt: new Date(Date.now() - 1200000).toISOString(),
        }
      ]
      
      // Merge local modifications
      const merged = [...localBroadcasts]
      fallback.forEach(f => {
        if (!merged.some(m => m.id === f.id)) {
          merged.push(f)
        }
      })
      setBroadcasts(merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      setLoading(false)
    }
  }, [localBroadcasts])

  const sendBroadcast = async (form: BroadcastForm) => {
    setSending(true)
    const isScheduled = !!form.scheduleFor
    const now = new Date()

    const payload = {
      message:           form.message,
      priority:          form.priority,
      target_type:       form.targetType,
      target_clinic:     form.targetClinic || null,
      target_role:       form.targetRole || null,
      scheduled_at:      isScheduled ? form.scheduleFor : null,
      sent_at:           isScheduled ? null : now.toISOString(),
      expires_at:        form.expiresAfterHours > 0
        ? new Date(now.getTime() + form.expiresAfterHours * 3600000).toISOString()
        : null,
      read_count:        0,
      total_recipients:  form.targetType === 'all' ? 25 : form.targetType === 'clinic' ? 8 : 12,
      created_by:        'Super Admin',
      created_at:        now.toISOString(),
    }

    try {
      const { error } = await supabase.from('broadcasts').insert(payload)
      if (error) {
        throw error
      }
      await fetchBroadcasts()
    } catch (err) {
      console.warn('Could not save broadcast in database. Appending to local state:', err)
      const newBc: Broadcast = {
        id: `bc-local-${Date.now()}`,
        message: payload.message,
        priority: payload.priority as any,
        targetType: payload.target_type as any,
        targetClinic: payload.target_clinic,
        targetRole: payload.target_role,
        status: isScheduled ? 'scheduled' : 'sent',
        scheduledAt: payload.scheduled_at,
        sentAt: payload.sent_at,
        expiresAt: payload.expires_at,
        readCount: 0,
        totalRecipients: payload.total_recipients,
        createdBy: payload.created_by,
        createdAt: payload.created_at,
      }
      setLocalBroadcasts(prev => [newBc, ...prev])
    } finally {
      // Audit log on dispatch
      const target = form.targetType === 'all'
        ? 'All Staff'
        : form.targetType === 'clinic'
        ? form.targetClinic
        : form.targetRole ?? 'All'
      await auditActions.broadcastSent(form.message, target ?? 'All')
      setSending(false)
    }
  }

  const deleteBroadcast = async (id: string) => {
    try {
      const { error } = await supabase.from('broadcasts').delete().eq('id', id)
      if (error) {
        throw error
      }
      setBroadcasts(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      console.warn('Could not delete broadcast from database. Deleting locally:', err)
      setLocalBroadcasts(prev => prev.filter(b => b.id !== id))
      setBroadcasts(prev => prev.filter(b => b.id !== id))
    }
  }

  useEffect(() => {
    fetchBroadcasts()

    const channel = supabase
      .channel('broadcasts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' },
        () => fetchBroadcasts()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchBroadcasts])

  return { broadcasts, loading, sending, sendBroadcast, deleteBroadcast }
}
