import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ClinicHealth {
  clinicId: string
  healthScore: number        // 0-100
  status: 'healthy' | 'degraded' | 'critical'
  activeTokens: number
  queueLoadPercent: number   // 0-100
  doctorsOnline: number
  doctorsTotal: number
  lastIncidentAt: string | null
  lastIncidentTitle: string | null
  avgWaitMins: number
}

export function useClinicHealth(clinicId: string) {
  const [health, setHealth] = useState<ClinicHealth | null>(null)

  useEffect(() => {
    const fetch = async () => {
      // Active tokens (using WAITING / SERVING and hospital_id)
      const { data: tokens } = await supabase
        .from('tokens')
        .select('id, created_at')
        .eq('hospital_id', clinicId)
        .in('status', ['WAITING', 'SERVING'])

      const activeTokens = tokens?.length ?? 0
      const queueLoadPercent = Math.min(100, Math.round((activeTokens / 50) * 100))

      // Doctors (using staff_users, hospital_id, role DOCTOR, is_active)
      const { data: staff } = await supabase
        .from('staff_users')
        .select('id, is_active')
        .eq('hospital_id', clinicId)
        .eq('role', 'DOCTOR')

      const doctorsOnline = staff?.filter(s => s.is_active).length ?? 0
      const doctorsTotal  = staff?.length ?? 0

      // Last incident
      const { data: incidents } = await supabase
        .from('incidents')
        .select('title, created_at')
        .eq('clinic_id', clinicId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(1)

      const lastIncident = incidents?.[0]

      // Health score calculation
      let score = 100
      if (queueLoadPercent > 80) score -= 40
      else if (queueLoadPercent > 60) score -= 20
      if (doctorsTotal > 0 && doctorsOnline / doctorsTotal < 0.5) score -= 20
      if (lastIncident) score -= 15
      score = Math.max(0, score)

      const status: ClinicHealth['status'] =
        score >= 70 ? 'healthy' : score >= 40 ? 'degraded' : 'critical'

      setHealth({
        clinicId,
        healthScore: score,
        status,
        activeTokens,
        queueLoadPercent,
        doctorsOnline,
        doctorsTotal,
        lastIncidentAt: lastIncident?.created_at ?? null,
        lastIncidentTitle: lastIncident?.title ?? null,
        avgWaitMins: Math.round(activeTokens * 3.5),
      })
    }

    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [clinicId])

  return health
}
