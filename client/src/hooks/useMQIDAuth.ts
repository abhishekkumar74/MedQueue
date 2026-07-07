import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedUser } from '../lib/auth'
import {
  lookupPatientByPhone,
  registerNewPatient,
  linkAuthToPatient,
  getOrCreateHospitalProfile,
  getCurrentPatient,
} from '../lib/mqid'
import type { MQPatient, PatientRegistrationForm } from '../types/mqid'

export type AuthStep =
  | 'idle'
  | 'entering_phone'
  | 'otp_sent'
  | 'verifying_otp'
  | 'needs_registration'   // new patient — show form
  | 'creating_profile'     // saving to DB
  | 'authenticated'
  | 'error'

export interface MQIDAuthState {
  step: AuthStep
  patient: MQPatient | null
  mqid: string | null
  error: string | null
  isNewPatient: boolean
}

export function useMQIDAuth(hospitalId: string, hospitalName: string, localPrefix: string) {
  const [state, setState] = useState<MQIDAuthState>({
    step: 'idle',
    patient: null,
    mqid: null,
    error: null,
    isNewPatient: false,
  })

  const [pendingPhone, setPendingPhone] = useState<string>('')

  // ── On mount: check if already authenticated ─────────
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      let patient: MQPatient | null = null

      if (session) {
        patient = await getCurrentPatient()
        if (!patient && session.user) {
          const userPhone = session.user.phone
          if (userPhone) {
            patient = await lookupPatientByPhone(userPhone)
            if (patient) {
              patient = await linkAuthToPatient(userPhone, session.user.id)
            }
          }
          if (!patient) {
            setPendingPhone(session.user.phone || '')
            setState(s => ({
              ...s,
              step: 'needs_registration',
              isNewPatient: true,
              error: null
            }))
            return
          }
        }
      } else {
        const cached = getCachedUser()
        if (cached && cached.type === 'patient' && cached.phone) {
          patient = await lookupPatientByPhone(cached.phone)
          if (!patient) {
            try {
              // Auto-register global patient record if not exists yet
              const form: PatientRegistrationForm = {
                fullName: cached.name || 'Patient',
                phone: cached.phone,
                dob: '',
                gender: null,
                bloodGroup: null,
                address: cached.address || '',
                city: '',
                emergencyContact: '',
                allergies: [],
              }
              const { patient: registered } = await registerNewPatient(form, cached.id)
              patient = registered
            } catch (e) {
              console.warn('Failed to auto-register patient globally:', e)
            }
          }
        }
      }

      if (patient) {
        // Ensure hospital profile exists
        try {
          await getOrCreateHospitalProfile(
            patient.mqid,
            hospitalId,
            hospitalName,
            localPrefix
          )
        } catch (e) {
          console.warn('Failed to ensure hospital profile exists:', e)
        }
        setState(s => ({
          ...s,
          step: 'authenticated',
          patient,
          mqid: patient.mqid,
        }))
      }
    }
    checkSession()
  }, [hospitalId, hospitalName, localPrefix])

  // ── Step 1: Send OTP ──────────────────────────────────
  const sendOTP = useCallback(async (phone: string) => {
    setState(s => ({ ...s, step: 'entering_phone', error: null }))

    // Normalize phone — add +91 if missing
    const normalizedPhone = phone.startsWith('+')
      ? phone
      : `+91${phone.replace(/\D/g, '')}`

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
    })

    if (error) {
      setState(s => ({ ...s, step: 'error', error: error.message }))
      return
    }

    setPendingPhone(normalizedPhone)
    setState(s => ({ ...s, step: 'otp_sent', error: null }))
  }, [])

  // ── Step 2: Verify OTP ────────────────────────────────
  const verifyOTP = useCallback(async (otp: string) => {
    setState(s => ({ ...s, step: 'verifying_otp', error: null }))

    const { data, error } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: otp.trim(),
      type: 'sms',
    })

    if (error || !data.user) {
      setState(s => ({
        ...s,
        step: 'otp_sent',   // go back to OTP entry
        error: error?.message ?? 'Invalid OTP. Please try again.',
      }))
      return
    }

    const authUserId = data.user.id
    const rawPhone   = pendingPhone.replace('+91', '').replace(/\D/g, '')

    // Check if patient already exists in global registry
    const existingPatient = await lookupPatientByPhone(pendingPhone)
      ?? await lookupPatientByPhone(rawPhone)

    if (existingPatient) {
      // Known patient — link session and proceed
      const linked = await linkAuthToPatient(pendingPhone, authUserId)
        ?? existingPatient

      // Ensure hospital profile exists for this visit
      try {
        await getOrCreateHospitalProfile(
          linked.mqid,
          hospitalId,
          hospitalName,
          localPrefix
        )
      } catch (e) {
        console.warn('Failed to ensure hospital profile exists:', e)
      }

      setState(s => ({
        ...s,
        step: 'authenticated',
        patient: linked,
        mqid: linked.mqid,
        isNewPatient: false,
        error: null,
      }))
    } else {
      // Brand new patient — need registration form
      setState(s => ({
        ...s,
        step: 'needs_registration',
        isNewPatient: true,
        error: null,
      }))
    }
  }, [pendingPhone, hospitalId, hospitalName, localPrefix])

  // ── Step 3: Complete registration (new patients only) ─
  const completeRegistration = useCallback(async (
    form: PatientRegistrationForm
  ) => {
    setState(s => ({ ...s, step: 'creating_profile', error: null }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired. Please try again.')

      // Create global patient record
      const { mqid, patient } = await registerNewPatient(form, user.id)

      // Create hospital profile for first visit
      try {
        await getOrCreateHospitalProfile(
          mqid,
          hospitalId,
          hospitalName,
          localPrefix,
          form
        )
      } catch (e) {
        console.warn('Failed to create hospital profile:', e)
      }

      setState(s => ({
        ...s,
        step: 'authenticated',
        patient,
        mqid,
        error: null,
      }))
    } catch (err: any) {
      setState(s => ({
        ...s,
        step: 'needs_registration',
        error: err?.message ?? 'Registration failed. Please try again.',
      }))
    }
  }, [hospitalId, hospitalName, localPrefix])

  // ── Sign out ──────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({
      step: 'idle',
      patient: null,
      mqid: null,
      error: null,
      isNewPatient: false,
    })
  }, [])

  return {
    ...state,
    pendingPhone,
    sendOTP,
    verifyOTP,
    completeRegistration,
    signOut,
  }
}
