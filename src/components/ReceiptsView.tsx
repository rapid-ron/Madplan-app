import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import {
  GROCERY_CATEGORIES,
  GroceryCategory,
  Receipt,
  ReceiptLineItem,
} from '../types';

export const ReceiptsView: React.FC = () => {
  const { receipts, profile, saveReceipt, deleteReceipt, updateProfile } = useAppData();

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('alle');
  const [tagFilter, setTagFilter] = useState<string>('alle');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Scanner / Manual editor modal state
  const [showModal, setShowModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');

  // Editable receipt form
  const [storeName, setStoreName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalDkk, setTotalDkk] = useState<number>(0);
  const [primaryCategory, setPrimaryCategory] = useState<GroceryCategory>('Frugt & Grønt');
  const [items, setItems] = useState<ReceiptLineItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['hverdag']);
  const [newTagInput, setNewTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableTags = useMemo(() => {
    const set = new Set<string>(profile.customTags || []);
    receipts.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [profile.customTags, receipts]);

  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receipts.filter((r) => {
      if (categoryFilter !== 'alle') {
        const matchesPrimary = r.primaryCategory === categoryFilter;
        const matchesLine = r.items.some((i) => i.category === categoryFilter);
        if (!matchesPrimary && !matchesLine) return false;
      }
      if (tagFilter !== 'alle' && !r.tags.includes(tagFilter)) return false;
      if (dateFrom && r.purchaseDate < dateFrom) return false;
      if (dateTo && r.purchaseDate > dateTo) return false;
      if (q) {
        const hitStore = r.storeName.toLowerCase().includes(q);
        const hitNotes = r.notes.toLowerCase().includes(q);
        const hitTag = r.tags.some((t) => t.toLowerCase().includes(q));
        const hitItem = r.items.some((i) => i.name.toLowerCase().includes(q));
        if (!hitStore && !hitNotes && !hitTag && !hitItem) return false;
      }
      return true;
    });
  }, [receipts, search, categoryFilter, tagFilter, dateFrom, dateTo]);

  const filteredTotal = useMemo(
    () => filteredReceipts.reduce((sum, r) => sum + r.totalDkk, 0),
    [filteredReceipts]
  );

  const resetForm = () => {
    setPreviewDataUrl(null);
    setPastedText('');
    setScanError(null);
    setStoreName('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setTotalDkk(0);
    setPrimaryCategory('Frugt & Grønt');
    setItems([]);
    setSelectedTags(['hverdag']);
    setNotes('');
  };

  const runGeminiScan = async (payload: { imageBase64?: string; mimeType?: string; receiptText?: string }) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch('/api/receipt/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunne ikke aflæse kvitteringen.');

      setStoreName(data.storeName || 'Supermarked');
      setPurchaseDate(data.purchaseDate || new Date().toISOString().slice(0, 10));
      setTotalDkk(Number(data.totalDkk) || 0);
      setPrimaryCategory(data.primaryCategory || 'Kolonial');
      setItems(Array.isArray(data.items) ? data.items : []);
      setSelectedTags(Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : ['hverdag']);
      setNotes(`Automatisk scannet (${(data.items || []).length} varelinjer kategoriseret)`);
    } catch (err: any) {
      setScanError(err?.message || 'Kunne ikke scanne kvittering.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreviewDataUrl(dataUrl);
      runGeminiScan({ imageBase64: dataUrl, mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  };

  const handleAddLineItem = () => {
    setItems((prev) => [
      ...prev,
      { name: '', quantity: '1 stk', priceDkk: 0, category: primaryCategory },
    ]);
  };

  const handleUpdateLineItem = (idx: number, patch: Partial<ReceiptLineItem>) => {
    setItems((prev) => {
      const next = prev.map((row, i) => (i === idx ? { ...row, ...patch } : row));
      const sum = next.reduce((s, r) => s + (Number(r.priceDkk) || 0), 0);
      if (sum > 0) setTotalDkk(Math.round(sum * 100) / 100);
      return next;
    });
  };

  const handleAddCustomTag = async () => {
    const clean = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    if (!selectedTags.includes(clean)) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    if (!profile.customTags.includes(clean)) {
      await updateProfile({ customTags: [...profile.customTags, clean].slice(0, 30) });
    }
    setNewTagInput('');
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    const cleanItems = items.filter((i) => i.name.trim().length > 0);
    const computedTotal =
      totalDkk > 0
        ? totalDkk
        : cleanItems.reduce((s, i) => s + (Number(i.priceDkk) || 0), 0);

    await saveReceipt({
      id: `rcpt-${Date.now()}`,
      storeName: storeName.trim(),
      purchaseDate,
      totalDkk: computedTotal,
      primaryCategory,
      items: cleanItems,
      tags: selectedTags,
      notes: notes.trim(),
    });
    setShowModal(false);
    resetForm();
    setToast(`Kvittering fra ${storeName.trim()} (${computedTotal.toFixed(2)} kr.) er gemt og kategoriseret.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            Scan med kamera for automatisk vare-kategorisering og udgiftssporing
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Kvitteringer & Udgifter
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span>Scan eller tilføj kvittering</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Advanced Search & Custom Tag Filter Bar */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Søg butik, vare, tag eller note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 pl-10 pr-3 text-sm"
            />
          </div>

          <select
            aria-label="Filtrér på kategori"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="md:col-span-3 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="alle">Alle kategorier</option>
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label="Fra dato"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="md:col-span-2 min-h-[44px] rounded-xl border border-slate-200 px-3 text-xs font-mono tabular-nums text-slate-700"
          />

          <input
            type="date"
            aria-label="Til dato"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="md:col-span-2 min-h-[44px] rounded-xl border border-slate-200 px-3 text-xs font-mono tabular-nums text-slate-700"
          />

          <div className="md:col-span-1 flex items-center justify-end">
            {(search || categoryFilter !== 'alle' || tagFilter !== 'alle' || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('alle');
                  setTagFilter('alle');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="min-h-[40px] px-2.5 text-xs font-medium text-teal-800 hover:underline"
              >
                Nulstil
              </button>
            )}
          </div>
        </div>

        {/* Interactive Custom Tag Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 mr-1 shrink-0">
            <Tag className="w-3.5 h-3.5" />
            Tags:
          </span>
          <button
            onClick={() => setTagFilter('alle')}
            className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tagFilter === 'alle'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Alle
          </button>
          {availableTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(tagFilter === t ? 'alle' : t)}
              className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tagFilter === t
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered Summary Line */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Viser <strong className="text-slate-900 font-mono tabular-nums">{filteredReceipts.length}</strong> kvitteringer
        </span>
        <span>
          Sum i filter:{' '}
          <strong className="text-slate-900 font-mono tabular-nums">
            {filteredTotal.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.
          </strong>
        </span>
      </div>

      {/* Receipts List */}
      {filteredReceipts.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center space-y-2">
          <p className="text-base font-semibold text-slate-900">Ingen kvitteringer fundet</p>
          <p className="text-sm text-slate-500">
            Scan din første dagligvarekvittering eller justér søgefiltrene.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
          {filteredReceipts.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <div key={r.id}>
                <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="flex-1 min-h-[44px] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-left"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{r.storeName}</span>
                        <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                        <span className="text-xs font-mono tabular-nums text-slate-500">{r.purchaseDate}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>{r.primaryCategory}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{r.items.length} varer</span>
                        {r.tags.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-teal-800">{r.tags.map((t) => `#${t}`).join(' ')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-semibold font-mono tabular-nums text-slate-900">
                        {r.totalDkk.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.
                      </span>
                      {expanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => deleteReceipt(r.id)}
                    aria-label={`Slet kvittering fra ${r.storeName}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {expanded && (
                  <div className="px-4 md:px-5 pb-4 pt-2 bg-slate-50/70 border-t border-slate-100 space-y-3">
                    {r.notes && <p className="text-xs text-slate-600">Note: {r.notes}</p>}
                    {r.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2 pr-3 font-medium">Vare</th>
                              <th className="py-2 pr-3 font-medium">Mængde</th>
                              <th className="py-2 pr-3 font-medium">Auto-kategori</th>
                              <th className="py-2 text-right font-medium">Pris</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60">
                            {r.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-2 pr-3 font-medium text-slate-800">{item.name}</td>
                                <td className="py-2 pr-3 text-slate-500">{item.quantity}</td>
                                <td className="py-2 pr-3 text-slate-600">{item.category}</td>
                                <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                                  {item.priceDkk.toFixed(2)} kr.
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Ingen specificerede varelinjer på denne kvittering.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Scanner & Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveReceipt}
            className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Scan eller registrér kvittering
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Tag billede af kvitteringen — Gemini aflæser og kategoriserer varerne automatisk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera / Upload / Text Scan Trigger */}
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isScanning ? 'Aflæser med Gemini...' : 'Tag foto / Vælg kvitteringsbillede'}</span>
                </button>
                {previewDataUrl && (
                  <span className="text-xs text-teal-800 font-medium">Billede vedhæftet</span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Eller indsæt tekst fra digital bon (fx 'Rema 1000: Skyr 26 kr, Øko æg 32 kr...')"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="flex-1 min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
                />
                <button
                  type="button"
                  disabled={isScanning || !pastedText.trim()}
                  onClick={() => runGeminiScan({ receiptText: pastedText })}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Aflæs tekst</span>
                </button>
              </div>

              {scanError && <p className="text-xs text-rose-700 font-medium">{scanError}</p>}
            </div>

            {/* Extracted / Manual Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Butik</span>
                <input
                  required
                  type="text"
                  placeholder="fx Rema 1000, Netto, Føtex"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Dato</span>
                <input
                  required
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Totalbeløb (DKK)</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  min={0}
                  value={totalDkk}
                  onChange={(e) => setTotalDkk(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Primær kategori</span>
                <select
                  value={primaryCategory}
                  onChange={(e) => setPrimaryCategory(e.target.value as GroceryCategory)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {GROCERY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Auto-Categorized Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Varelinjer & Automatisk Kategorisering ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tilføj varelinje
                </button>
              </div>

              {items.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Varenavn"
                        value={item.name}
                        onChange={(e) => handleUpdateLineItem(idx, { name: e.target.value })}
                        className="col-span-5 min-h-[38px] rounded-lg border border-slate-200 px-2.5 text-xs"
                      />
                      <select
                        value={item.category}
                        onChange={(e) =>
                          handleUpdateLineItem(idx, { category: e.target.value as GroceryCategory })
                        }
                        className="col-span-4 min-h-[38px] rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      >
                        {GROCERY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.5"
                        value={item.priceDkk}
                        onChange={(e) =>
                          handleUpdateLineItem(idx, { priceDkk: Number(e.target.value) })
                        }
                        className="col-span-2 min-h-[38px] rounded-lg border border-slate-200 px-2 text-xs font-mono tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 flex items-center justify-center text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Tags */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-800">Brugerdefinerede tags</span>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((t) => {
                  const active = selectedTags.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          active ? prev.filter((x) => x !== t) : [...prev, t]
                        )
                      }
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Opret nyt tag (fx fødselsdag, julemad)"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  className="flex-1 min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Tilføj tag
                </button>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Noter (valgfrit)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                Annuller
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-800"
              >
                Gem kvittering
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
