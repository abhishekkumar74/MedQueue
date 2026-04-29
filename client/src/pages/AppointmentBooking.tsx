import { useState, useEffect } from 'react';
import { bookAppointment, getAppointmentSlots, registerToken } from '../lib/api';
import { Department, DEPARTMENT_LABEL, TimeSlot } from '../types';
import { AuthUser } from '../lib/auth';
import PhoneInput, { isValidPhone } from '../components/PhoneInput';
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Hash, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const DEPARTMENTS: Department[] = [
  'general', 'cardiology', 'orthopedics', 'pediatrics',
  'gynecology', 'neurology', 'dermatology', 'ent', 'ophthalmology'
];

const MOCK_DOCTORS: Record<string, { name: string; specialty: string; fee: number }> = {
  'general': { name: 'Dr. Sarah Chen', specialty: 'General Practitioner', fee: 500 },
  'cardiology': { name: 'Dr. Julian Thorne', specialty: 'Cardiology Specialist', fee: 1200 },
  'orthopedics': { name: 'Dr. Priya Sharma', specialty: 'Orthopedic Surgeon', fee: 1000 },
  'pediatrics': { name: 'Dr. Arun Mehta', specialty: 'Pediatrician', fee: 700 },
  'gynecology': { name: 'Dr. Meena Patel', specialty: 'Gynecologist', fee: 900 },
  'neurology': { name: 'Dr. Ravi Kumar', specialty: 'Neurologist', fee: 1100 },
  'dermatology': { name: 'Dr. Anita Singh', specialty: 'Dermatologist', fee: 800 },
  'ent': { name: 'Dr. Suresh Nair', specialty: 'ENT Specialist', fee: 750 },
  'ophthalmology': { name: 'Dr. Kavita Rao', specialty: 'Ophthalmologist', fee: 850 },
};

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function AppointmentBooking({ onNavigate, currentUser }: { 
  onNavigate: (p: string, state?: Record<string, unknown>) => void;
  currentUser?: AuthUser | null;
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [department, setDepartment] = useState<Department>('general');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');

  // Pre-fill from logged-in patient
  useEffect(() => {
    if (currentUser?.type === 'patient') {
      if (currentUser.name && currentUser.name !== currentUser.phone) setPatientName(currentUser.name);
      if (currentUser.phone) setPhone(currentUser.phone);
      if (currentUser.age) setAge(String(currentUser.age));
      if (currentUser.address) setAddress(currentUser.address);
    }
  }, [currentUser]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const doctor = MOCK_DOCTORS[department] ?? MOCK_DOCTORS['general'];

  // Load slots when date or department changes
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const dateStr = selectedDate.toISOString().split('T')[0];
    getAppointmentSlots(dateStr, department)
      .then(data => setSlots(data))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, department]);

  // Calendar helpers
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function selectDay(day: number) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date < todayMidnight) return; // past date
    setSelectedDate(date);
  }

  function isPast(day: number) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < todayMidnight;
  }

  function isSelected(day: number) {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewDate.getFullYear() &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getDate() === day;
  }

  async function handleBook() {
    if (!patientName.trim()) return setError('Full name is required');
    if (!age.trim()) return setError('Age is required');
    if (!address.trim()) return setError('Address is required');
    if (!isValidPhone(phone)) return setError('Please enter a valid 10-digit mobile number');
    if (!selectedDate || !selectedSlot) return setError('Please select a date and time slot');
    setBooking(true); setError('');
    try {
      await bookAppointment({
        phone,
        patient_name: patientName.trim(),
        department,
        doctor_id: department,
        appointment_date: selectedDate.toISOString().split('T')[0],
        time_slot: `${selectedSlot.startTime}-${selectedSlot.endTime}`,
        consultation_fee: doctor.fee,
      });
      setSuccess(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Booking failed';
      if (msg.includes('409') || msg.toLowerCase().includes('conflict') || msg.toLowerCase().includes('booked')) {
        setError('This time slot was just booked. Please select another slot.');
      } else {
        setError(msg);
      }
    } finally { setBooking(false); }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#E8F3FF] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#005EB8] mb-2">Appointment Confirmed!</h2>
          <p className="text-gray-500 text-sm mb-6">Your appointment has been booked successfully.</p>
          <div className="bg-[#E8F3FF] rounded-xl p-4 text-left text-sm space-y-2 mb-6">
            <p><span className="font-semibold">Doctor:</span> {doctor.name}</p>
            <p><span className="font-semibold">Date:</span> {selectedDate?.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><span className="font-semibold">Time:</span> {selectedSlot?.startTime} – {selectedSlot?.endTime}</p>
            <p><span className="font-semibold">Fee:</span> ₹{doctor.fee}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  const data = await registerToken({
                    phone: phone.trim(),
                    name: patientName.trim(),
                    department,
                    priority: 2,
                  });
                  onNavigate('tracker', { tokenNumber: data.token.token_number, phone: data.token.phone });
                } catch {
                  onNavigate('register');
                }
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
            >
              Also Get Queue Token Now
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="w-full py-3 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8F3FF]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Book an Appointment</h1>
          <p className="text-gray-500 text-sm mt-1">Select your preferred date and time for your consultation.</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Calendar + Slots + Patient Info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Department selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
              <select
                value={department}
                onChange={e => { setDepartment(e.target.value as Department); setSelectedSlot(null); }}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-[#005EB8] focus:outline-none"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
              </select>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">
                  {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                </h2>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                  <button
                    key={day}
                    onClick={() => selectDay(day)}
                    disabled={isPast(day)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                      isSelected(day)
                        ? 'bg-[#005EB8] text-white font-bold'
                        : isPast(day)
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-[#E8F3FF] text-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-800 mb-3">Available Time Slots</h3>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#005EB8]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => slot.available && setSelectedSlot(slot)}
                        disabled={!slot.available}
                        className={`py-2.5 px-2 rounded-lg text-sm font-medium border-2 transition-all ${
                          selectedSlot?.id === slot.id
                            ? 'border-[#005EB8] bg-[#005EB8] text-white'
                            : slot.available
                            ? 'border-gray-200 text-gray-700 hover:border-[#005EB8] hover:text-[#005EB8]'
                            : 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
                        }`}
                      >
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Patient info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h3 className="font-bold text-gray-800">Patient Details</h3>
              {/* Name */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="Full Name *"
                  required
                  className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              {/* Age */}
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="Age *"
                  min="1" max="120"
                  required
                  className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              {/* Phone */}
              <div>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  disabled={currentUser?.type === 'patient' && !!currentUser.phone}
                />
              </div>
              {/* Address */}
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Address *"
                  rows={2}
                  required
                  className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right: Appointment Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-4">
              <h3 className="font-bold text-gray-800 mb-4">Appointment Summary</h3>

              {/* Doctor */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#E8F3FF] flex items-center justify-center text-2xl">👨‍⚕️</div>
                <div>
                  <div className="font-bold text-[#005EB8] text-sm">{doctor.name}</div>
                  <div className="text-xs text-gray-500">{doctor.specialty}</div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Date</div>
                    <div className="font-semibold">
                      {selectedDate
                        ? selectedDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Not selected'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Time</div>
                    <div className="font-semibold">
                      {selectedSlot ? `${selectedSlot.startTime} (30 min)` : 'Not selected'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-400">Location</div>
                    <div className="font-semibold">Main Hospital, Wing A</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-600 font-semibold">Consultation Fee</span>
                <span className="text-lg font-extrabold text-[#005EB8]">₹{doctor.fee}</span>
              </div>

              <button
                onClick={handleBook}
                disabled={booking || !selectedDate || !selectedSlot || !patientName.trim() || !isValidPhone(phone) || !age.trim() || !address.trim()}
                className="w-full mt-4 min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {booking ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {booking ? 'Booking…' : 'Confirm Booking →'}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">Cancel free of charge up to 24h before</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
