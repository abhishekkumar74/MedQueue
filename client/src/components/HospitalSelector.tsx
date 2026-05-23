import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSelectedHospitalId, setSelectedHospitalId } from '../lib/api';
import { Building2, ChevronDown, Check } from 'lucide-react';

export interface Hospital {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
}

const DEFAULT_HOSPITALS: Hospital[] = [
  { id: 'd290f1ee-6c54-4b01-90e6-d701748f0851', name: 'Apollo Clinic', slug: 'apollo', address: 'Apollo Street, Delhi' },
  { id: 'a4220b22-83b3-4f9e-a89e-cb01748ff002', name: 'Max Health', slug: 'max', address: 'Max Highway, Noida' },
  { id: '7e90a5fe-4b01-90c6-ff22-a701748f0222', name: 'City Hospital', slug: 'city', address: 'Central Sector, Gurugram' }
];

interface Props {
  className?: string;
  onChange?: (hospitalId: string) => void;
}

export default function HospitalSelector({ className = '', onChange }: Props) {
  const [hospitals, setHospitals] = useState<Hospital[]>(DEFAULT_HOSPITALS);
  const [selectedId, setSelectedId] = useState<string>(getSelectedHospitalId());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchHospitals() {
      try {
        const { data, error } = await supabase.from('hospitals').select('*');
        if (!error && data && data.length > 0) {
          setHospitals(data);
        }
      } catch (err) {
        console.warn('Could not fetch hospitals dynamically, using defaults:', err);
      }
    }
    fetchHospitals();
  }, []);

  const selectedHospital = hospitals.find(h => h.id === selectedId) || hospitals[0];

  function handleSelect(id: string) {
    setSelectedId(id);
    setSelectedHospitalId(id);
    setIsOpen(false);
    if (onChange) onChange(id);
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between w-full rounded-2xl border-2 border-[#E8F3FF] shadow-sm px-4 py-2.5 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-all min-w-[200px]"
      >
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-600" />
          <span className="truncate">{selectedHospital?.name}</span>
        </div>
        <ChevronDown className="w-4 h-4 ml-2 -mr-1 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="origin-top-right absolute right-0 mt-2 w-72 rounded-2xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-50 py-2 divide-y divide-gray-100 overflow-hidden transform scale-100 transition-all">
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Hospital Context</span>
            </div>
            <div className="py-1">
              {hospitals.map(h => (
                <button
                  key={h.id}
                  onClick={() => handleSelect(h.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-violet-50 transition-colors ${
                    h.id === selectedId ? 'bg-violet-50 text-violet-700 font-bold' : 'text-gray-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{h.name}</div>
                    {h.address && <div className="text-xs text-gray-400 truncate max-w-[200px] mt-0.5">{h.address}</div>}
                  </div>
                  {h.id === selectedId && <Check className="w-4 h-4 text-violet-600" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
