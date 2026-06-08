import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { isValidMQID } from '../lib/mqid'

export type SearchResultType = 'patient' | 'staff' | 'clinic' | 'token' | 'alert'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  meta?: string
  navigateTo: string
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }

    setLoading(true)
    try {
      const searchResults: SearchResult[] = []

      // Search patients
      if (isValidMQID(q.trim().toUpperCase())) {
        const { data: mqPatient } = await supabase
          .from('mq_patients')
          .select('*, hospital_patients(hospital_name, total_visits)')
          .eq('mqid', q.trim().toUpperCase())
          .maybeSingle()

        if (mqPatient) {
          searchResults.push({
            id:         mqPatient.id,
            type:       'patient',
            title:      mqPatient.full_name ?? 'Unknown Patient',
            subtitle:   `MQID: ${mqPatient.mqid} · Phone: ${mqPatient.phone}`,
            meta:       'Patient',
            navigateTo: 'staff',
          })
        }
      } else {
        // Search by name or phone
        const { data: patients } = await supabase
          .from('mq_patients')
          .select('*')
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,mqid.ilike.%${q}%`)
          .limit(5)

        patients?.forEach((p: any) => {
          searchResults.push({
            id:         p.id,
            type:       'patient',
            title:      p.full_name ?? 'Unknown Patient',
            subtitle:   `MQID: ${p.mqid} · ${p.phone ?? '—'}`,
            meta:       'Patient',
            navigateTo: 'staff',
          })
        })
      }

      // Search staff (using staff_users)
      const { data: staff } = await supabase
        .from('staff_users')
        .select('id, name, email, role, hospital_id')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(5)

      staff?.forEach(s => {
        searchResults.push({
          id: s.id,
          type: 'staff',
          title: s.name ?? 'Unknown Staff',
          subtitle: `${s.role ?? '—'} · Hospital ID: ${s.hospital_id ?? '—'}`,
          meta: s.role,
          navigateTo: 'staff',
        })
      })

      // Search clinics (using hospitals)
      const { data: clinics } = await supabase
        .from('hospitals')
        .select('id, name, address')
        .ilike('name', `%${q}%`)
        .limit(3)

      clinics?.forEach(c => {
        searchResults.push({
          id: c.id,
          type: 'clinic',
          title: c.name ?? 'Unknown Clinic',
          subtitle: c.address ?? '—',
          meta: 'Clinic',
          navigateTo: 'hospitals',
        })
      })

      setResults(searchResults)
    } catch (e) {
      console.warn('Global search query failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = () => { setQuery(''); setResults([]) }

  return { query, results, loading, search, clear }
}
