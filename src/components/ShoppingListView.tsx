import React, { useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Plus,
  Receipt as ReceiptIcon,
  RefreshCw,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { GROCERY_CATEGORIES, GroceryCategory, ShoppingItem } from '../types';

export const ShoppingListView: React.FC<{ onReceiptCreated: () => void }> = ({
  onReceiptCreated,
}) => {
  const {
    shoppingItems,
    activeMealPlan,
    toggleShoppingItem,
    addShoppingItem,
    deleteShoppingItem,
    clearCheckedShoppingItems,
    rebuildShoppingListFromPlan,
    saveReceipt,
  } = useAppData();

  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('1 stk');
  const [newCategory, setNewCategory] = useState<GroceryCategory>('Frugt & Grønt');
  const [newPrice, setNewPrice] = useState<number>(20);
  const [hideChecked, setHideChecked] = useState(false);
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => (hideChecked ? shoppingItems.filter((i) => !i.checked) : shoppingItems),
    [shoppingItems, hideChecked]
  );

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, ShoppingItem[]>();
    for (const item of visibleItems) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).sort(
      (a, b) => GROCERY_CATEGORIES.indexOf(a[0]) - GROCERY_CATEGORIES.indexOf(b[0])
    );
  }, [visibleItems]);

  const stats = useMemo(() => {
    const total = shoppingItems.length;
    const checked = shoppingItems.filter((i) => i.checked).length;
    const estTotal = shoppingItems.reduce((sum, i) => sum + i.estimatedPriceDkk, 0);
    const estChecked = shoppingItems
      .filter((i) => i.checked)
      .reduce((sum, i) => sum + i.estimatedPriceDkk, 0);
    return { total, checked, estTotal, estChecked };
  }, [shoppingItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addShoppingItem({
      name: newName.trim(),
      amount: newAmount.trim() || '1 stk',
      category: newCategory,
      estimatedPriceDkk: Math.max(0, Number(newPrice) || 0),
      checked: false,
      fromMealPlanId: 'manual',
    });
    setNewName('');
    setNewAmount('1 stk');
    setNewPrice(20);
  };

  const handleAutoCategorizeInput = async () => {
    if (!newName.trim()) return;
    setIsAutoCategorizing(true);
    try {
      const res = await fetch('/api/grocery/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [newName.trim()] }),
      });
      const data = await res.json();
      if (res.ok && data.categorized?.[0]) {
        const hit = data.categorized[0];
        setNewCategory(hit.category);
        setNewPrice(hit.estimatedPriceDkk);
        setFeedback(`Auto-kategoriseret som "${hit.category}" (~${hit.estimatedPriceDkk} kr.)`);
      }
    } catch {
      setFeedback('Kunne ikke auto-kategorisere varen.');
    } finally {
      setIsAutoCategorizing(false);
    }
  };

  const handleLogCheckedAsReceipt = async () => {
    const checked = shoppingItems.filter((i) => i.checked);
    if (checked.length === 0) return;

    const categoryTotals = new Map<GroceryCategory, number>();
    for (const i of checked) {
      categoryTotals.set(i.category, (categoryTotals.get(i.category) || 0) + i.estimatedPriceDkk);
    }
    const primaryCategory =
      Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Kolonial';

    await saveReceipt({
      id: `rcpt-${Date.now()}`,
      storeName: 'Indkøbsliste-tur',
      purchaseDate: new Date().toISOString().slice(0, 10),
      totalDkk: checked.reduce((s, i) => s + i.estimatedPriceDkk, 0),
      primaryCategory,
      items: checked.map((i) => ({
        name: i.name,
        quantity: i.amount,
        priceDkk: i.estimatedPriceDkk,
        category: i.category,
      })),
      tags: ['ugeindkøb', 'madplan'],
      notes: 'Overført direkte fra afkrydsede varer i indkøbslisten',
    });

    await clearCheckedShoppingItems();
    onReceiptCreated();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            Synkroniseres automatisk mellem dine enheder
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Automatisk Indkøbsliste
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setHideChecked((v) => !v)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {hideChecked ? 'Vis alle varer' : 'Skjul afkrydsede'}
          </button>

          {activeMealPlan && (
            <button
              onClick={async () => {
                await rebuildShoppingListFromPlan(activeMealPlan);
                setFeedback('Indkøbslisten er opdateret fra ugens madplan.');
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4 text-teal-700" />
              <span>Hent fra madplan</span>
            </button>
          )}

          {stats.checked > 0 && (
            <button
              onClick={handleLogCheckedAsReceipt}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <ReceiptIcon className="w-4 h-4" />
              <span>Bogfør {stats.checked} i budget ({stats.estChecked} kr.)</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Status</p>
          <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {stats.checked} / {stats.total}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Estimeret kurv</p>
          <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-teal-800">
            {stats.estTotal} kr.
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Afkrydset</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900">
              {stats.estChecked} kr.
            </p>
          </div>
          {stats.checked > 0 && (
            <button
              onClick={clearCheckedShoppingItems}
              className="min-h-[40px] px-3 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Ryd
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-sm text-teal-900">
          {feedback}
        </div>
      )}

      {/* Quick Add Item Bar with Gemini Auto-Categorization */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl bg-white border border-slate-200/80 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
      >
        <label className="md:col-span-4 space-y-1">
          <span className="text-xs font-medium text-slate-600">Tilføj vare</span>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="fx Økologisk havremælk"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={handleAutoCategorizeInput}
              disabled={isAutoCategorizing || !newName.trim()}
              title="Auto-kategorisér med Gemini"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-teal-700 hover:bg-teal-50 disabled:opacity-40"
            >
              {isAutoCategorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            </button>
          </div>
        </label>

        <label className="md:col-span-2 space-y-1">
          <span className="text-xs font-medium text-slate-600">Mængde</span>
          <input
            type="text"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
          />
        </label>

        <label className="md:col-span-3 space-y-1">
          <span className="text-xs font-medium text-slate-600">Kategori</span>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as GroceryCategory)}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            {GROCERY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-1 space-y-1">
          <span className="text-xs font-medium text-slate-600">Pris kr.</span>
          <input
            type="number"
            min={0}
            value={newPrice}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2.5 text-sm font-mono tabular-nums text-slate-900"
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" />
            <span>Tilføj</span>
          </button>
        </div>
      </form>

      {/* Grouped Shopping Categories */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center space-y-2">
          <p className="text-base font-semibold text-slate-900">Indkøbslisten er tom</p>
          <p className="text-sm text-slate-500">
            Tilføj varer ovenfor eller hent automatisk alle ingredienser fra ugens madplan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {grouped.map(([category, items]) => (
            <section
              key={category}
              className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">{category}</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {items.length} varer · {items.reduce((s, i) => s + i.estimatedPriceDkk, 0)} kr.
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <button
                      onClick={() => toggleShoppingItem(item.id)}
                      className="flex-1 min-h-[44px] flex items-center gap-3 text-left"
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          item.checked
                            ? 'bg-teal-700 border-teal-700 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {item.checked && <Check className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            item.checked ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.amount} · <span className="font-mono tabular-nums">~{item.estimatedPriceDkk} kr.</span>
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => deleteShoppingItem(item.id)}
                      aria-label={`Fjern ${item.name}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
