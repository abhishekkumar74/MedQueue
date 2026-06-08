import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getPatientHospitalHistory } from '../lib/mqid'
import type { HospitalPatient } from '../types/mqid'

export interface VaultRecord {
  id: string
  type: 'prescription' | 'token' | 'visit'
  date: string
  hospitalName: string
  hospitalId: string
  doctorName?: string
  department?: string
  diagnosis?: string
  medicines?: { name: string; dosage: string; duration: string }[]
  status?: string
}

export function useHealthVault(mqid: string | null) {
  const [records, setRecords] = useState<VaultRecord[]>([])
  const [hospitalHistory, setHospitalHistory] = useState<HospitalPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [filterHospital, setFilterHospital] = useState<string | null>(null)

  useEffect(() => {
    if (!mqid) return

    const fetchAll = async () => {
      setLoading(true)
      try {
        // Get all hospitals this patient has visited
        const history = await getPatientHospitalHistory(mqid)
        setHospitalHistory(history)

        // Fetch all prescriptions across all hospitals
        const { data: prescriptions } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('mqid', mqid)
          .order('created_at', { ascending: false })

        // Fetch all tokens across all hospitals
        const { data: tokens } = await supabase
          .from('tokens')
          .select('*')
          .eq('mqid', mqid)
          .order('created_at', { ascending: false })

        const allRecords: VaultRecord[] = [
          ...(prescriptions ?? []).map((p: any): VaultRecord => ({
            id:           p.id,
            type:         'prescription',
            date:         p.created_at,
            hospitalName: p.hospital_name ?? 'Unknown Hospital',
            hospitalId:   p.hospital_id,
            doctorName:   p.doctor_name,
            department:   p.department,
            diagnosis:    p.diagnosis,
            medicines:    p.medicines ?? [],
          })),
          ...(tokens ?? []).map((t: any): VaultRecord => ({
            id:           t.id,
            type:         'token',
            date:         t.created_at,
            hospitalName: t.hospital_name ?? 'Unknown Hospital',
            hospitalId:   t.hospital_id,
            department:   t.department,
            status:       t.status,
          })),
        ]

        // Sort by date descending
        allRecords.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        setRecords(allRecords)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [mqid])

  const filteredRecords = filterHospital
    ? records.filter(r => r.hospitalId === filterHospital)
    : records

  return {
    records: filteredRecords,
    allRecords: records,
    hospitalHistory,
    loading,
    filterHospital,
    setFilterHospital,
  }
}
