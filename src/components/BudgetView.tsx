import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppData } from '../context/AppDataContext';
import { exportFinanceToExcel, exportReceiptsToCsv } from '../lib/excelExport';
import { requestAndSendNotification } from '../lib/calendarExport';

const BAR_COLORS = ['#0F766E', '#0284C7', '#059669', '#D97706', '#475569', '#6366F1', '#BE123C', '#0E7490'];

export const BudgetView: React.FC = () => {
  const {
    receipts,
    profile,
    activeMealPlan,
    updateProfile,
  } = useAppData();

  const currentYm = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentYm);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(profile.monthlyBudgetDkk);
  const [thresholdDraft, setThresholdDraft] = useState(profile.budgetAlertThreshold);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    const set = new Set<string>([currentYm]);
    receipts.forEach((r) => {
      if (r.purchaseDate.length >= 7) set.add(r.purchaseDate.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [receipts, currentYm]);

  const monthReceipts = useMemo(
    () => receipts.filter((r) => r.purchaseDate.startsWith(selectedMonth)),
    [receipts, selectedMonth]
  );

  const monthTotal = useMemo(
    () => monthReceipts.reduce((sum, r) => sum + r.totalDkk, 0),
    [monthReceipts]
  );

  const remaining = profile.monthlyBudgetDkk - monthTotal;
  const pct = Math.round((monthTotal / Math.max(1, profile.monthlyBudgetDkk)) * 100);
  const overBudget = monthTotal > profile.monthlyBudgetDkk;
  const nearBudget = !overBudget && pct >= profile.budgetAlertThreshold;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of monthReceipts) {
      if (r.items.length > 0) {
        for (const item of r.items) {
          map.set(item.category, (map.get(item.category) || 0) + item.priceDkk);
        }
      } else {
        map.set(r.primaryCategory, (map.get(r.primaryCategory) || 0) + r.totalDkk);
      }
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        share: Math.round((amount / Math.max(1, monthTotal)) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthReceipts, monthTotal]);

  const storeBreakdown = useMemo(() => {
    const map = new Map<string, { store: string; amount: number; trips: number }>();
    for (const r of monthReceipts) {
      const existing = map.get(r.storeName) || { store: r.storeName, amount: 0, trips: 0 };
      existing.amount += r.totalDkk;
      existing.trips += 1;
      map.set(r.storeName, existing);
    }
    return Array.from(map.values())
      .map((s) => ({ ...s, amount: Math.round(s.amount) }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthReceipts]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts) {
      const ym = r.purchaseDate.slice(0, 7);
      map.set(ym, (map.get(ym) || 0) + r.totalDkk);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, total]) => ({
        month,
        total: Math.round(total),
        budget: profile.monthlyBudgetDkk,
      }));
  }, [receipts, profile.monthlyBudgetDkk]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      monthlyBudgetDkk: Math.max(200, Number(budgetDraft) || 3500),
      budgetAlertThreshold: Math.max(50, Math.min(100, Number(thresholdDraft) || 85)),
    });
    setEditingBudget(false);
  };

  const handleEnableBudgetAlerts = async () => {
    const sent = await requestAndSendNotification(
      'Budgetpåmindelser aktiveret',
      `Du får besked når dit dagligvareforbrug passerer ${profile.budgetAlertThreshold}% af ${profile.monthlyBudgetDkk} kr.`
    );
    await updateProfile({ notificationsEnabled: true });
    setNotifFeedback(
      sent
        ? 'Notifikationer er aktive! En test-påmindelse blev sendt.'
        : 'In-app budgetadvarsler er slået til (tillad browser-notifikationer i indstillinger for push-beskeder).'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + Excel Export Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            Månedlig økonomisk opfølgning, kategoristatistik og budgetkontrol
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Budgetrapporter & Statistik
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Vælg måned"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-mono tabular-nums text-slate-800"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <button
            onClick={() => exportReceiptsToCsv(monthReceipts, selectedMonth)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={() => exportFinanceToExcel(receipts, profile, activeMealPlan, selectedMonth)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Eksportér til Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Budget Alert Banner (color + explicit icon + text) */}
      {(overBudget || nearBudget) && (
        <div
          role="alert"
          className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            overBudget
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                {overBudget
                  ? `Budgetoverskridelse i ${selectedMonth}: ${Math.abs(Math.round(remaining))} kr. over grænsen`
                  : `Advarsel: Du har brugt ${pct}% af dit månedsbudget (${profile.budgetAlertThreshold}% grænse)`}
              </p>
              <p className="text-xs opacity-90 mt-0.5 font-mono tabular-nums">
                Forbrugt {Math.round(monthTotal)} kr. ud af {profile.monthlyBudgetDkk} kr.
              </p>
            </div>
          </div>

          <button
            onClick={handleEnableBudgetAlerts}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-white/90 border border-current/20 px-3.5 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Aktivér push-advarsel</span>
          </button>
        </div>
      )}

      {!overBudget && !nearBudget && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <p className="text-sm">
              <strong>Inden for budget:</strong> Du har brugt <span className="font-mono tabular-nums font-semibold">{pct}%</span> af dit månedsbudget og har <span className="font-mono tabular-nums font-semibold">{Math.round(remaining)} kr.</span> tilbage.
            </p>
          </div>
          <button
            onClick={handleEnableBudgetAlerts}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-white border border-emerald-200 px-3 text-xs font-medium text-emerald-900 whitespace-nowrap shrink-0"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Test budgetpåmindelse</span>
          </button>
        </div>
      )}

      {notifFeedback && (
        <p className="text-xs text-teal-800 px-1">{notifFeedback}</p>
      )}

      {/* 4-column Financial KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Samlet forbrug ({selectedMonth})</p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {Math.round(monthTotal).toLocaleString('da-DK')} kr.
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {monthReceipts.length} kvitteringer
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Månedsbudget</p>
            <button
              onClick={() => {
                setBudgetDraft(profile.monthlyBudgetDkk);
                setThresholdDraft(profile.budgetAlertThreshold);
                setEditingBudget((v) => !v);
              }}
              className="text-xs font-medium text-teal-800 hover:underline"
            >
              Redigér
            </button>
          </div>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {profile.monthlyBudgetDkk.toLocaleString('da-DK')} kr.
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                overBudget ? 'bg-rose-600' : nearBudget ? 'bg-amber-500' : 'bg-teal-700'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">{remaining < 0 ? 'Overskredet med' : 'Restbudget'}</p>
          <p
            className={`mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums ${
              remaining < 0 ? 'text-rose-700' : 'text-teal-800'
            }`}
          >
            {Math.abs(Math.round(remaining)).toLocaleString('da-DK')} kr.
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Advarsel ved {profile.budgetAlertThreshold}%
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Gns. pr. indkøbstur</p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {monthReceipts.length > 0 ? Math.round(monthTotal / monthReceipts.length) : 0} kr.
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            Størst: {categoryBreakdown[0]?.category || '—'}
          </p>
        </div>
      </div>

      {/* Inline Budget Editor */}
      {editingBudget && (
        <form
          onSubmit={handleSaveBudget}
          className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row items-end gap-3"
        >
          <label className="flex-1 w-full space-y-1">
            <span className="text-xs font-medium text-slate-700">Månedligt dagligvarebudget (DKK)</span>
            <input
              type="number"
              min={200}
              max={100000}
              step={100}
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
            />
          </label>
          <label className="flex-1 w-full space-y-1">
            <span className="text-xs font-medium text-slate-700">Påmindelsesgrænse (%)</span>
            <input
              type="number"
              min={50}
              max={100}
              value={thresholdDraft}
              onChange={(e) => setThresholdDraft(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
            />
          </label>
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            Gem budget
          </button>
        </form>
      )}

      {/* Visual Statistics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Spend Bar Chart */}
        <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Forbrug pr. dagligvarekategori</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatisk opgjort fra alle kvitteringers varelinjer i {selectedMonth}
            </p>
          </div>

          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Ingen udgifter registreret i denne måned.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBreakdown}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={110}
                    tick={{ fontSize: 11, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(val) => `${val ?? 0} kr.`} />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                    {categoryBreakdown.map((entry, idx) => (
                      <Cell key={entry.category} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Monthly Trend Chart */}
        <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Månedlig udvikling</h2>
            <p className="text-xs text-slate-500 mt-0.5">Samlet dagligvareforbrug sammenlignet pr. måned</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val) => `${val ?? 0} kr.`} />
                <Bar dataKey="total" name="Forbrug (kr.)" fill="#0F766E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Detailed Category & Store Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Kategoritabel ({selectedMonth})</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="px-5 py-2.5 font-medium">Kategori</th>
                <th className="px-5 py-2.5 text-right font-medium">Andel</th>
                <th className="px-5 py-2.5 text-right font-medium">Beløb</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoryBreakdown.map((row) => (
                <tr key={row.category}>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{row.category}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-500">{row.share}%</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {row.amount.toFixed(0)} kr.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Forbrug pr. supermarked</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="px-5 py-2.5 font-medium">Butik</th>
                <th className="px-5 py-2.5 text-right font-medium">Besøg</th>
                <th className="px-5 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storeBreakdown.map((row) => (
                <tr key={row.store}>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{row.store}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-500">{row.trips}</td>
                  <td className="px-5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {row.amount.toLocaleString('da-DK')} kr.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};
