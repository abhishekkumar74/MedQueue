import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { AuthUser } from '../../../lib/auth';
import { PrescriptionStatus, PRESCRIPTION_STATUS_COLOR, PRESCRIPTION_STATUS_LABEL } from '../../../types';
import { 
  Pill, CheckCircle2, Loader2, AlertCircle,
  RefreshCw, PlusCircle, Edit3, ShieldAlert, 
  TrendingUp, Sparkle, Database, FileSpreadsheet, X, Search
} from 'lucide-react';

interface Props {
  currentUser?: AuthUser | null;
}

interface MedicineRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit_type: string;
  expiry_date: string;
  batch_number: string;
  supplier: string;
  purchase_price: number;
  selling_price: number;
  min_stock_threshold: number;
  created_at: string;
}

export default function PharmacyDashboard({ currentUser }: Props) {
  const hospitalId = (currentUser?.role === 'SUPER_ADMIN' ? (localStorage.getItem('mq_selected_hospital_id') || currentUser?.hospital_id) : currentUser?.hospital_id) || 'd290f1ee-6c54-4b01-90e6-d701748f0851'; // Tenant isolation

  // ── Navigation Tabs ───────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory' | 'suppliers' | 'analytics'>('prescriptions');

  // ── Dashboard States ──────────────────────────────────────
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispensedToday, setDispensedToday] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  const [dispensing, setDispensing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Search & Filters ──────────────────────────────────────
  const [medSearch, setMedSearch] = useState('');
  const [rxSearch, setRxSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'LOW' | 'OUT' | 'ADEQUATE' | 'EXPIRED'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'cards' | 'table'>('cards');

  // ── Dynamic Modals ────────────────────────────────────────
  const [showAddMed, setShowAddMed] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineRow | null>(null);

  // ── Form States ───────────────────────────────────────────
  const [medForm, setMedForm] = useState({
    name: '', category: 'Analgesic', quantity: 100, unit_type: 'tablets',
    expiry_date: '2028-12-31', batch_number: '', supplier: '',
    purchase_price: 1.50, selling_price: 3.00, min_stock_threshold: 20
  });

  // ── Fetch Operations Ledger ─────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (silent) void 0; // silent flag reserved
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const startIST = `${today}T00:00:00+05:30`;

      const [rxPendingRes, rxDispensedRes, medRes, logsRes] = await Promise.all([
        supabase.from('prescriptions').select('*, patients(name), tokens(*)').eq('hospital_id', hospitalId).in('status', ['PENDING', 'IN_PROGRESS']).order('created_at', { ascending: true }),
        supabase.from('prescriptions').select('*, patients(name)').eq('hospital_id', hospitalId).eq('status', 'DISPENSED').gte('dispensed_at', startIST),
        supabase.from('medicines').select('*').eq('hospital_id', hospitalId).order('name'),
        supabase.from('activity_logs').select('*').in('category', ['pharmacy', 'inventory']).order('created_at', { ascending: false }).limit(10)
      ]);

      if (rxPendingRes.error) throw rxPendingRes.error;
      if (rxDispensedRes.error) throw rxDispensedRes.error;
      if (medRes.error) throw medRes.error;

      setPending(rxPendingRes.data ?? []);
      setDispensedToday(rxDispensedRes.data ?? []);
      setMedicines(medRes.data ?? []);
      setActivityLogs(logsRes.data ?? []);

      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database sync failed. Reconnecting...');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time prescription sync subscription
  useEffect(() => {
    const channel = supabase
      .channel('pharmacy-realtime-nodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions', filter: `hospital_id=eq.${hospitalId}` }, () => {
        fetchData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines', filter: `hospital_id=eq.${hospitalId}` }, () => {
        fetchData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, hospitalId]);

  // ── Logging System Activity Helper ─────────────────────────
  const logLocalActivity = async (message: string, category = 'pharmacy', badge_color = 'bg-emerald-600') => {
    try {
      await supabase.from('activity_logs').insert({ message, category, badge_color });
      fetchData(true);
    } catch (e) {
      console.error('Activity logging failure:', e);
    }
  };

  // ── Automatic Stock Decrement Transaction logic ─────────────
  const handleDispense = async (rx: any) => {
    setDispensing(rx.id);
    setError('');
    setSuccess('');

    // Capture state snapshots for graceful rollback
    const originalPending = [...pending];
    const originalDispensed = [...dispensedToday];
    const originalSelected = selected;

    // OPTIMISTICALLY update list arrays immediately (0ms UI latency)
    setPending(prev => prev.filter(p => p.id !== rx.id));
    setDispensedToday(prev => [
      { ...rx, status: 'DISPENSED', dispensed_at: new Date().toISOString() },
      ...prev
    ]);
    setSelected(null);
    setSuccess('Prescription dispatched successfully (optimistic update)...');

    try {
      const medicationsList = (Array.isArray(rx.medications) 
        ? rx.medications 
        : (typeof rx.medications === 'string' ? JSON.parse(rx.medications) : [])) as any[];

      // Transactional check and decrement loop
      for (const med of medicationsList) {
        // Query current stock levels
        const { data: currentMed, error: selectErr } = await supabase
          .from('medicines')
          .select('*')
          .eq('hospital_id', hospitalId)
          .eq('name', med.name)
          .maybeSingle();

        if (selectErr) throw selectErr;

        if (currentMed) {
          // Calculate reduction
          const requestedQty = parseInt(med.quantity) || 1;
          const newQty = Math.max(0, currentMed.quantity - requestedQty);

          const { error: updateErr } = await supabase
            .from('medicines')
            .update({ quantity: newQty })
            .eq('id', currentMed.id);

          if (updateErr) throw updateErr;

          logLocalActivity(`Meds "${med.name}" stock decremented: ${currentMed.quantity} ➔ ${newQty} units (${requestedQty} dispensed).`, 'pharmacy', 'bg-emerald-600');

          // Trigger Low Stock scanning logs
          if (newQty <= currentMed.min_stock_threshold) {
            await supabase.from('security_logs').insert({
              event: `⚠️ Low Stock Alert: "${med.name}" dropped to ${newQty} units (min threshold: ${currentMed.min_stock_threshold}).`,
              ip: '127.0.0.1',
              hospital: hospitalId,
              severity: 'warning'
            });
          }
        } else {
          // Record unavailable medicine warning
          logLocalActivity(`Dispensed item warning: "${med.name}" was not loaded in stock catalog.`, 'system', 'bg-amber-500');
        }
      }

      // Update prescription state
      const { error: rxErr } = await supabase
        .from('prescriptions')
        .update({
          status: 'DISPENSED',
          dispensed_at: new Date().toISOString(),
          dispensed_by: 'Pharmacy Desk Staff'
        })
        .eq('id', rx.id);

      if (rxErr) throw rxErr;

      // Automatically complete corresponding patient token
      const targetTokenId = rx.token_id || rx.tokens?.id;
      if (targetTokenId) {
        await supabase
          .from('tokens')
          .update({ status: 'DONE', intake_status: 'COMPLETED' })
          .eq('id', targetTokenId);
      }

      setSuccess('Prescription dispatched successfully, stock decremented, and token queue closed!');
      logLocalActivity(`Token #${rx.tokens?.token_number} prescription successfully dispensed and closed.`, 'pharmacy', 'bg-[#00A3AD]');
      // Silent sync to confirm all DB records match UI
      fetchData(true);
    } catch (err) {
      // Graceful state rollback on database transaction errors
      setPending(originalPending);
      setDispensedToday(originalDispensed);
      setSelected(originalSelected);
      setSuccess('');
      setError(err instanceof Error ? err.message : 'Prescription dispensing failed. UI states reverted.');
    } finally {
      setDispensing(null);
    }
  };

  // ── Stock Add & Edit RLS Mutators ─────────────────────────
  const handleAddMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, category, quantity, unit_type, expiry_date, batch_number, supplier, purchase_price, selling_price, min_stock_threshold } = medForm;
    if (!name || !batch_number || !supplier) return setError('Please fill all required fields');

    try {
      const { error } = await supabase
        .from('medicines')
        .insert({
          name: name.trim(),
          category,
          quantity: parseInt(quantity as any) || 0,
          unit_type,
          expiry_date,
          batch_number: batch_number.toUpperCase().trim(),
          supplier: supplier.trim(),
          purchase_price: parseFloat(purchase_price as any) || 0.00,
          selling_price: parseFloat(selling_price as any) || 0.00,
          min_stock_threshold: parseInt(min_stock_threshold as any) || 10,
          hospital_id: hospitalId
        });

      if (error) throw error;
      setSuccess(`Medicine "${name}" added to stock ledger successfully!`);
      logLocalActivity(`Inventory added: "${name}" (${quantity} ${unit_type}) registered in catalog.`, 'inventory', 'bg-[#005EB8]');
      setShowAddMed(false);
      setMedForm({
        name: '', category: 'Analgesic', quantity: 100, unit_type: 'tablets',
        expiry_date: '2028-12-31', batch_number: '', supplier: '',
        purchase_price: 1.50, selling_price: 3.00, min_stock_threshold: 20
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adding stock failed');
    }
  };

  const handleEditMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMed) return;

    try {
      const { error } = await supabase
        .from('medicines')
        .update({
          name: editingMed.name,
          category: editingMed.category,
          quantity: parseInt(editingMed.quantity as any) || 0,
          unit_type: editingMed.unit_type,
          expiry_date: editingMed.expiry_date,
          batch_number: editingMed.batch_number.toUpperCase(),
          supplier: editingMed.supplier,
          purchase_price: parseFloat(editingMed.purchase_price as any) || 0,
          selling_price: parseFloat(editingMed.selling_price as any) || 0,
          min_stock_threshold: parseInt(editingMed.min_stock_threshold as any) || 10
        })
        .eq('id', editingMed.id);

      if (error) throw error;
      setSuccess(`Medicine "${editingMed.name}" details updated successfully.`);
      logLocalActivity(`Inventory update: "${editingMed.name}" details updated.`, 'inventory', 'bg-[#00A3AD]');
      setEditingMed(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Updating stock failed');
    }
  };

  const handleRemoveMed = async (id: string, name: string) => {
    const confirmed = window.confirm(`⚠️ Are you sure you want to remove "${name}" from your catalog?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('medicines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess(`Medicine "${name}" removed from database.`);
      logLocalActivity(`Inventory delete: "${name}" removed from stock catalogue.`, 'security', 'bg-red-500');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deleting stock failed');
    }
  };

  const handleIncrementStock = async (id: string, currentQty: number, name: string) => {
    const addition = window.prompt(`Enter tablet/unit quantity to ADD to "${name}" stock:`, '50');
    if (!addition || isNaN(addition as any)) return;

    try {
      const newQty = currentQty + parseInt(addition);
      const { error } = await supabase
        .from('medicines')
        .update({ quantity: newQty })
        .eq('id', id);

      if (error) throw error;
      setSuccess(`Added ${addition} units to "${name}" stock!`);
      logLocalActivity(`Stock added: +${addition} units added to "${name}" (Total: ${newQty}).`, 'inventory', 'bg-[#005EB8]');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjusting stock failed');
    }
  };

  const handleExportCSV = () => {
    const headers = 'Medicine Name,Category,Quantity,Unit,Expiry Date,Batch Number,Supplier,Selling Price\n';
    const rows = medicines.map(m => 
      `"${m.name}",${m.category},${m.quantity},${m.unit_type},${m.expiry_date},${m.batch_number},"${m.supplier}",$${m.selling_price}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `medqueue_pharmacy_inventory_${Date.now()}.csv`);
    a.click();
    logLocalActivity('Pharmacy Inventory CSV report generated and downloaded.', 'system', 'bg-blue-600');
  };

  // Helper date tools
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  // Stock alerts
  const lowStockList = medicines.filter(m => m.quantity <= m.min_stock_threshold && m.quantity > 0);
  const outOfStockList = medicines.filter(m => m.quantity === 0);
  const expiringMeds = medicines.filter(m => {
    const months = (new Date(m.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.5);
    return months <= 6; // within 6 months
  });

  // Filter lists
  const filteredRx = pending.filter(rx => 
    !rxSearch.trim() ||
    rx.patients?.name?.toLowerCase().includes(rxSearch.toLowerCase()) ||
    String(rx.tokens?.token_number).includes(rxSearch)
  );

  const filteredMeds = medicines.filter(m => {
    const matchesSearch = !medSearch.trim() ||
      m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.batch_number.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.supplier.toLowerCase().includes(medSearch.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;

    const isLow = m.quantity <= m.min_stock_threshold && m.quantity > 0;
    const isOut = m.quantity === 0;
    const isExpired = new Date(m.expiry_date) < new Date();
    
    let matchesStatus = true;
    if (selectedStatus === 'LOW') {
      matchesStatus = isLow;
    } else if (selectedStatus === 'OUT') {
      matchesStatus = isOut;
    } else if (selectedStatus === 'ADEQUATE') {
      matchesStatus = !isLow && !isOut && !isExpired;
    } else if (selectedStatus === 'EXPIRED') {
      matchesStatus = isExpired;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Group filtered medicines by category
  const groupedMeds = filteredMeds.reduce((acc, med) => {
    if (!acc[med.category]) acc[med.category] = [];
    acc[med.category].push(med);
    return acc;
  }, {} as Record<string, MedicineRow[]>);

  // Dynamic dynamic list of categories
  const medicineCategories = ['ALL', ...Array.from(new Set(medicines.map(m => m.category).filter(Boolean)))];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F8FB] pb-12 font-sans animate-fade-in">
        {/* Sub Header Skeleton */}
        <div className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-skeleton" />
            <div className="space-y-2">
              <div className="w-32 h-4 bg-slate-200 rounded animate-skeleton" />
              <div className="w-48 h-3 bg-slate-100 rounded animate-skeleton" />
            </div>
          </div>
          <div className="w-40 h-8 bg-slate-100 rounded-xl animate-skeleton" />
        </div>

        {/* Main Body Skeleton */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel: Queue list skeleton */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white h-16 rounded-2xl border border-slate-100 animate-skeleton" />
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 p-4 h-64 animate-skeleton" />
          </div>
          {/* Right Panel: Selection card skeleton */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 h-96 animate-skeleton" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8FB] pb-12 font-sans">
      
      {/* ── Pharmacy Operations Sub Header ── */}
      <div className="bg-white border-b border-slate-200 py-4 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Pill className="w-5 h-5 text-emerald-600 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                Pharmacy Control Desk
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Node Syncing</span>
              </h1>
              <p className="text-xs text-slate-400">Enterprise Pharmacy Stock & Dispense Console</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('prescriptions')} 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'prescriptions' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Dispensing Console
              </button>
              <button 
                onClick={() => setActiveTab('inventory')} 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'inventory' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Stock Manager
              </button>
              <button 
                onClick={() => setActiveTab('analytics')} 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Meds Analytics
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              <button onClick={() => { setPending([]); fetchData(); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        
        {/* ─────────────────────────────────────────────────────────────────
            1. TAB: Prescription Dispensing Console
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'prescriptions' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Left Queue list */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Telemetry Metrics Panel */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Stock Items</span>
                  <div className="text-lg font-black text-slate-800 mt-1">{medicines.length}</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Pending Rx</span>
                  <div className="text-lg font-black text-amber-600 mt-1">{pending.length}</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Dispensed</span>
                  <div className="text-lg font-black text-emerald-600 mt-1">{dispensedToday.length}</div>
                </div>
              </div>

              {/* Warnings and Alarms Console */}
              {(lowStockList.length > 0 || outOfStockList.length > 0 || expiringMeds.length > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-3xl p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-red-800 font-extrabold uppercase tracking-wide">
                    <ShieldAlert className="w-4.5 h-4.5 text-red-600 animate-bounce" />
                    <span>Pharmacy Inventory Warnings</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-red-700 font-semibold">
                    {outOfStockList.length > 0 && (
                      <p>🚨 Out of Stock alert: {outOfStockList.length} critical items require urgent replenishment.</p>
                    )}
                    {lowStockList.length > 0 && (
                      <p>⚠️ Low Stock alert: {lowStockList.length} medicines reached minimum stock thresholds.</p>
                    )}
                    {expiringMeds.length > 0 && (
                      <p>⏰ Expiry warning: {expiringMeds.length} items will expire within 6 months.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Prescription Search & Queue */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Prescriptions Queue</h3>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold">{filteredRx.length} nodes</span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={rxSearch} 
                    onChange={e => setRxSearch(e.target.value)} 
                    placeholder="Search patient / token..." 
                    className="pl-8 pr-4 py-2 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:outline-none w-full text-xs font-semibold"
                  />
                </div>

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                  {filteredRx.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">No pending prescriptions in queue.</div>
                  ) : (
                    filteredRx.map(rx => (
                      <button
                        key={rx.id}
                        onClick={() => setSelected(rx)}
                        className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all hover:shadow-sm ${selected?.id === rx.id ? 'border-[#005EB8] bg-[#005EB8]/5' : 'border-slate-50 bg-slate-50/50'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-xs">{rx.patients?.name || 'General Patient'}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Token #{rx.tokens?.token_number || 'TBA'} • Wait: {timeAgo(rx.created_at)}</p>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${PRESCRIPTION_STATUS_COLOR[rx.status as PrescriptionStatus]}`}>
                            {PRESCRIPTION_STATUS_LABEL[rx.status as PrescriptionStatus]}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right Dispense Console details */}
            <div className="lg:col-span-3">
              {selected ? (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                  
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-base font-black text-slate-800">{selected.patients?.name || 'Patient'}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Token Ticket: #{selected.tokens?.token_number || 'TBA'} • Diagnosis: <span className="font-semibold text-slate-600">{selected.diagnosis || 'General Diagnosis'}</span></p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Prescribed Medications</h4>
                    <div className="space-y-2">
                      {((Array.isArray(selected.medications) 
                        ? selected.medications 
                        : (typeof selected.medications === 'string' ? JSON.parse(selected.medications) : [])) as any[]).map((med: any, idx: number) => {
                        const stockMed = medicines.find(m => m.name.toLowerCase() === med.name.toLowerCase());
                        const hasStock = stockMed && stockMed.quantity >= (med.quantity || 1);
                        return (
                          <div key={idx} className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                {med.name}
                                {!hasStock && (
                                  <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">OUT OF STOCK</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">Dosage: {med.dosage} • Frequency: {med.frequency} • Duration: {med.duration}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-[#005EB8]">Qty: {med.quantity}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">Stock Level: {stockMed ? `${stockMed.quantity} units` : 'Not Loaded'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex gap-3">
                    <button
                      onClick={() => handleDispense(selected)}
                      disabled={dispensing === selected.id}
                      className="flex-1 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {dispensing === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
                      Mark Dispensed (Update Inventory)
                    </button>
                    <button onClick={() => setSelected(null)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs rounded-xl transition-colors">
                      Cancel
                    </button>
                  </div>

                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                  <Pill className="w-12 h-12 text-slate-200 mx-auto mb-3 animate-pulse" />
                  <h4 className="font-extrabold text-slate-700 text-sm">Select Prescription Ticket</h4>
                  <p className="text-xs text-slate-400 mt-1">Select a patient ticket from the pending queue on the left to review medications.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            2. TAB: Stock Manager & Inventory Table
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <Database className="w-4 h-4 text-[#005EB8]" />
                  Meds Stock Directory
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage batch numbers, stock quantities, and minimum thresholds.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Visual Layout Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-2">
                  <button 
                    onClick={() => setLayoutMode('cards')} 
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 ${layoutMode === 'cards' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Grid Cards
                  </button>
                  <button 
                    onClick={() => setLayoutMode('table')} 
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 ${layoutMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Classic Table
                  </button>
                </div>

                <button onClick={() => setShowAddMed(true)} className="flex items-center gap-1 bg-[#005EB8] text-white hover:bg-[#004a96] px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all">
                  <PlusCircle className="w-4 h-4" />
                  Add Medicine
                </button>
                <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Download CSV
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={medSearch} 
                    onChange={e => setMedSearch(e.target.value)} 
                    placeholder="Search stock..." 
                    className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:border-[#005EB8] focus:outline-none w-44 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Interactive Filter Console */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3.5 shadow-inner">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-2">Categories:</span>
                {medicineCategories.map(cat => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-xl text-[10px] font-black transition-all ${isActive ? 'bg-[#005EB8] text-white shadow-md shadow-[#005EB8]/20' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {cat === 'ALL' ? 'All Classes' : cat}
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-slate-100" />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-2">Stock Alert:</span>
                {[
                  { value: 'ALL', label: 'All Items', color: 'bg-white text-slate-700 border-slate-200' },
                  { value: 'LOW', label: '⚠️ Low Stock', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                  { value: 'OUT', label: '🚨 Out of Stock', color: 'bg-red-50 text-red-700 border-red-200' },
                  { value: 'ADEQUATE', label: '✅ Stable Stock', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { value: 'EXPIRED', label: '⏰ Expired Items', color: 'bg-rose-50 text-rose-700 border-rose-200' }
                ].map(item => {
                  const isActive = selectedStatus === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setSelectedStatus(item.value as any)}
                      className={`px-3 py-1 rounded-xl text-[10px] font-black border transition-all ${isActive ? 'bg-slate-800 border-slate-800 text-white shadow-md' : `${item.color} hover:shadow-sm`}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredMeds.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
                No medicines found matching the active filters or search terms. Try clearing selectors.
              </div>
            ) : layoutMode === 'cards' ? (
              /* CARD VIEW SECTION GRIDS */
              <div className="space-y-8">
                {Object.entries(groupedMeds).map(([category, list]) => (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <span className="w-2 h-2 rounded-full bg-[#005EB8]" />
                      <h4 className="font-black text-xs text-slate-800 uppercase tracking-widest">
                        {category}s
                      </h4>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                        {list.length} {list.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {list.map(med => {
                        const isLow = med.quantity <= med.min_stock_threshold && med.quantity > 0;
                        const isOut = med.quantity === 0;
                        const isExpired = new Date(med.expiry_date) < new Date();
                        
                        // Dynamic progress meter percent
                        const threshold = med.min_stock_threshold || 10;
                        const meterPercent = Math.min(100, Math.round((med.quantity / (threshold * 3)) * 100));
                        
                        // Status styling helper
                        let statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        let statusText = 'Stable';
                        let barColor = 'bg-emerald-500';
                        
                        if (isOut) {
                          statusBg = 'bg-red-50 text-red-700 border-red-200';
                          statusText = 'Out of Stock';
                          barColor = 'bg-red-500';
                        } else if (isLow) {
                          statusBg = 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
                          statusText = 'Low Stock Alert';
                          barColor = 'bg-amber-500';
                        } else if (isExpired) {
                          statusBg = 'bg-rose-50 text-rose-700 border-rose-200';
                          statusText = 'Expired';
                          barColor = 'bg-rose-500';
                        }

                        return (
                          <div key={med.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                            
                            {/* Card Header */}
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <h5 className="font-extrabold text-sm text-slate-800 tracking-tight group-hover:text-[#005EB8] transition-colors">{med.name}</h5>
                                  <span className="inline-block text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Batch: {med.batch_number}</span>
                                </div>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusBg}`}>
                                  {statusText}
                                </span>
                              </div>

                              {/* Progress bar visual stock meter */}
                              <div className="mt-4 space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-slate-400">Current Stock:</span>
                                  <span className="text-slate-700 text-xs font-black">{med.quantity} {med.unit_type}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                    style={{ width: `${meterPercent}%` }} 
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold">
                                  <span>Min threshold: {med.min_stock_threshold} units</span>
                                  <span>Level: {meterPercent}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Details Grid */}
                            <div className="my-4 pt-3 border-t border-slate-50 grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] font-bold text-slate-400">
                              <div>
                                <span className="block text-[8px] uppercase font-extrabold text-slate-300">Supplier</span>
                                <span className="text-slate-600 truncate block max-w-full">{med.supplier}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase font-extrabold text-slate-300">Expiry Date</span>
                                <span className={`text-slate-600 block ${isExpired ? 'text-rose-600 font-black' : ''}`}>{med.expiry_date}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase font-extrabold text-slate-300">Selling Price</span>
                                <span className="text-slate-700 font-extrabold">₹{med.selling_price}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase font-extrabold text-slate-300">Purchase Cost</span>
                                <span className="text-slate-500">₹{med.purchase_price}</span>
                              </div>
                            </div>

                            {/* Card Actions Footer */}
                            <div className="pt-3 border-t border-slate-50 flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => handleIncrementStock(med.id, med.quantity, med.name)} 
                                className="bg-[#005EB8]/5 text-[#005EB8] hover:bg-[#005EB8]/10 px-2.5 py-1.5 rounded-xl font-black text-[9px] tracking-wide transition-all uppercase flex items-center gap-1"
                              >
                                <PlusCircle className="w-3 h-3" /> Add Stock
                              </button>
                              <button 
                                onClick={() => setEditingMed(med)} 
                                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl font-black text-[9px] tracking-wide transition-all uppercase"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleRemoveMed(med.id, med.name)} 
                                className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-xl font-black text-[9px] tracking-wide transition-all uppercase"
                              >
                                Delete
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* TRADITIONAL TABLE VIEW AS FALLBACK */
              <div className="overflow-x-auto w-full scrollbar-none">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Medicine Name</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Stock Level</th>
                      <th className="pb-3">Unit Type</th>
                      <th className="pb-3">Expiry Date</th>
                      <th className="pb-3">Batch Number</th>
                      <th className="pb-3">Supplier</th>
                      <th className="pb-3">Selling Price</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 pr-2 text-right">Inventory Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filteredMeds.map(med => {
                      const isLow = med.quantity <= med.min_stock_threshold && med.quantity > 0;
                      const isOut = med.quantity === 0;
                      const isExpired = new Date(med.expiry_date) < new Date();
                      
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 pl-2 font-bold text-slate-800">{med.name}</td>
                          <td className="py-3.5 font-bold text-slate-500">{med.category}</td>
                          <td className="py-3.5 font-extrabold text-sm">{med.quantity}</td>
                          <td className="py-3.5 text-slate-400 uppercase text-[10px]">{med.unit_type}</td>
                          <td className="py-3.5 font-bold text-slate-600">{med.expiry_date}</td>
                          <td className="py-3.5 text-[#00A3AD] font-bold uppercase tracking-wider">{med.batch_number}</td>
                          <td className="py-3.5 text-slate-500 font-semibold">{med.supplier}</td>
                          <td className="py-3.5 font-bold text-slate-700">₹{med.selling_price}</td>
                          <td className="py-3.5">
                            {isOut ? (
                              <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">OUT OF STOCK</span>
                            ) : isLow ? (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full animate-pulse">LOW STOCK</span>
                            ) : isExpired ? (
                              <span className="text-[9px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">EXPIRED</span>
                            ) : (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ADEQUATE</span>
                            )}
                          </td>
                          <td className="py-3.5 pr-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => handleIncrementStock(med.id, med.quantity, med.name)} className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2 py-1 rounded-lg font-bold text-[10px] transition-colors">
                                Add Stock
                              </button>
                              <button onClick={() => setEditingMed(med)} className="bg-[#005EB8]/10 text-[#005EB8] hover:bg-[#005EB8]/20 px-2 py-1 rounded-lg font-bold text-[10px] transition-colors">
                                Edit
                              </button>
                              <button onClick={() => handleRemoveMed(med.id, med.name)} className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold text-[10px] transition-colors">
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            3. TAB: Meds Analytics
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-4">
              <TrendingUp className="w-4 h-4 text-[#005EB8]" />
              Medicine Dispensing Analytics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <h4 className="font-extrabold text-slate-700 mb-3">Daily Dispensing Trend</h4>
                {/* SVG Line Graph */}
                <svg viewBox="0 0 200 100" className="w-full h-32 text-emerald-600">
                  <path d="M 0 90 Q 50 10, 100 60 T 200 20 L 200 100 L 0 100 Z" fill="rgba(16, 185, 129, 0.1)" stroke="currentColor" strokeWidth="2.5" />
                </svg>
                <div className="flex justify-between text-[8px] text-slate-400 mt-2 font-bold uppercase">
                  <span>9:00 AM</span>
                  <span>1:00 PM</span>
                  <span>5:00 PM</span>
                  <span>9:00 PM</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <h4 className="font-extrabold text-slate-700 mb-3">Recent Dispensing Activity Logs</h4>
                <div className="space-y-2">
                  {activityLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="flex items-start gap-2 bg-white p-2 rounded-xl border border-slate-100 text-xs">
                      <Sparkle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-700">{log.message}</p>
                        <span className="text-[9px] text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MODALS & DIALOG FORMS
      ───────────────────────────────────────────────────────────────── */}

      {/* Add Medicine Modal */}
      {showAddMed && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative">
            <button onClick={() => setShowAddMed(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Pill className="w-5 h-5 text-[#005EB8]" />
              Add New Medicine
            </h3>
            <form onSubmit={handleAddMedSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Medicine Name</label>
                <input type="text" value={medForm.name} onChange={e => setMedForm({...medForm, name: e.target.value})} placeholder="Paracetamol 500mg" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Category</label>
                  <select value={medForm.category} onChange={e => setMedForm({...medForm, category: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="Analgesic">Analgesic</option>
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Antihistamine">Antihistamine</option>
                    <option value="NSAID">NSAID</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Unit Type</label>
                  <input type="text" value={medForm.unit_type} onChange={e => setMedForm({...medForm, unit_type: e.target.value})} placeholder="tablets / bottles" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Quantity</label>
                  <input type="number" value={medForm.quantity} onChange={e => setMedForm({...medForm, quantity: parseInt(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Min Threshold</label>
                  <input type="number" value={medForm.min_stock_threshold} onChange={e => setMedForm({...medForm, min_stock_threshold: parseInt(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Expiry Date</label>
                  <input type="date" value={medForm.expiry_date} onChange={e => setMedForm({...medForm, expiry_date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Batch Number</label>
                  <input type="text" value={medForm.batch_number} onChange={e => setMedForm({...medForm, batch_number: e.target.value})} placeholder="B-PC8812" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Supplier</label>
                  <input type="text" value={medForm.supplier} onChange={e => setMedForm({...medForm, supplier: e.target.value})} placeholder="Sun Pharma" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Purchase Price (₹)</label>
                  <input type="number" step="0.01" value={medForm.purchase_price} onChange={e => setMedForm({...medForm, purchase_price: parseFloat(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Selling Price (₹)</label>
                  <input type="number" step="0.01" value={medForm.selling_price} onChange={e => setMedForm({...medForm, selling_price: parseFloat(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <button type="submit" className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-bold text-xs rounded-xl shadow-lg transition-all">
                Onboard Medication
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Medicine Modal */}
      {editingMed && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative">
            <button onClick={() => setEditingMed(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Edit3 className="w-5 h-5 text-[#005EB8]" />
              Modify Medicine Stock
            </h3>
            <form onSubmit={handleEditMedSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Medicine Name</label>
                <input type="text" value={editingMed.name} onChange={e => setEditingMed({...editingMed, name: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Category</label>
                  <select value={editingMed.category} onChange={e => setEditingMed({...editingMed, category: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="Analgesic">Analgesic</option>
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Antihistamine">Antihistamine</option>
                    <option value="NSAID">NSAID</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Unit Type</label>
                  <input type="text" value={editingMed.unit_type} onChange={e => setEditingMed({...editingMed, unit_type: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Quantity</label>
                  <input type="number" value={editingMed.quantity} onChange={e => setEditingMed({...editingMed, quantity: parseInt(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Min Threshold</label>
                  <input type="number" value={editingMed.min_stock_threshold} onChange={e => setEditingMed({...editingMed, min_stock_threshold: parseInt(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Expiry Date</label>
                  <input type="date" value={editingMed.expiry_date} onChange={e => setEditingMed({...editingMed, expiry_date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Batch Number</label>
                  <input type="text" value={editingMed.batch_number} onChange={e => setEditingMed({...editingMed, batch_number: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Supplier</label>
                  <input type="text" value={editingMed.supplier} onChange={e => setEditingMed({...editingMed, supplier: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Purchase Price (₹)</label>
                  <input type="number" step="0.01" value={editingMed.purchase_price} onChange={e => setEditingMed({...editingMed, purchase_price: parseFloat(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Selling Price (₹)</label>
                  <input type="number" step="0.01" value={editingMed.selling_price} onChange={e => setEditingMed({...editingMed, selling_price: parseFloat(e.target.value) || 0})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <button type="submit" className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-bold text-xs rounded-xl shadow-lg transition-all">
                Update Medication Stock
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
