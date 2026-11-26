import * as XLSX from 'xlsx';
import { MealPlan, Receipt, UserProfile } from '../types';

export function exportFinanceToExcel(
  receipts: Receipt[],
  profile: UserProfile,
  activeMealPlan: MealPlan | null,
  monthKey: string // YYYY-MM
): void {
  const wb = XLSX.utils.book_new();

  const monthReceipts = receipts.filter((r) => r.purchaseDate.startsWith(monthKey));
  const totalMonthSpend = monthReceipts.reduce((acc, r) => acc + r.totalDkk, 0);
  const remainingBudget = profile.monthlyBudgetDkk - totalMonthSpend;

  // Sheet 1: Månedsoversigt
  const categoryTotals = new Map<string, number>();
  for (const r of monthReceipts) {
    if (r.items.length > 0) {
      for (const item of r.items) {
        categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + item.priceDkk);
      }
    } else {
      categoryTotals.set(r.primaryCategory, (categoryTotals.get(r.primaryCategory) ?? 0) + r.totalDkk);
    }
  }

  const summaryRows: Array<Record<string, string | number>> = [
    { Felt: 'Periode', Værdi: monthKey, Note: 'Månedlig budgetrapport' },
    { Felt: 'Månedsbudget (DKK)', Værdi: profile.monthlyBudgetDkk, Note: `Husstand: ${profile.householdSize} pers.` },
    { Felt: 'Samlet forbrug (DKK)', Værdi: Math.round(totalMonthSpend * 100) / 100, Note: `${monthReceipts.length} kvitteringer` },
    { Felt: 'Restbudget (DKK)', Værdi: Math.round(remainingBudget * 100) / 100, Note: remainingBudget < 0 ? 'Budget overskredet' : 'Inden for budget' },
    { Felt: 'Udnyttelse (%)', Værdi: Math.round((totalMonthSpend / Math.max(1, profile.monthlyBudgetDkk)) * 100), Note: `Advarselsgrænse: ${profile.budgetAlertThreshold}%` },
    { Felt: '', Værdi: '', Note: '' },
    { Felt: 'Kategori', Værdi: 'Forbrug (DKK)', Note: 'Andel (%)' },
    ...Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        Felt: cat,
        Værdi: Math.round(amount * 100) / 100,
        Note: `${Math.round((amount / Math.max(1, totalMonthSpend)) * 100)}%`,
      })),
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Månedsoversigt');

  // Sheet 2: Alle Kvitteringer
  const receiptRows = receipts
    .slice()
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
    .map((r) => ({
      Dato: r.purchaseDate,
      Butik: r.storeName,
      'Primær kategori': r.primaryCategory,
      'Total (DKK)': r.totalDkk,
      'Antal varer': r.items.length,
      Tags: r.tags.join(', '),
      Noter: r.notes,
    }));
  const wsReceipts = XLSX.utils.json_to_sheet(receiptRows.length > 0 ? receiptRows : [{ Info: 'Ingen kvitteringer endnu' }]);
  wsReceipts['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 26 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsReceipts, 'Kvitteringer');

  // Sheet 3: Detaljerede Varelinjer
  const lineRows: Array<Record<string, string | number>> = [];
  for (const r of receipts) {
    for (const item of r.items) {
      lineRows.push({
        Dato: r.purchaseDate,
        Butik: r.storeName,
        Vare: item.name,
        Mængde: item.quantity,
        Kategori: item.category,
        'Pris (DKK)': item.priceDkk,
        Tags: r.tags.join(', '),
      });
    }
  }
  const wsItems = XLSX.utils.json_to_sheet(lineRows.length > 0 ? lineRows : [{ Info: 'Ingen varelinjer registreret' }]);
  wsItems['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Varelinjer');

  // Sheet 4: Aktiv Madplan & Næring
  if (activeMealPlan) {
    const planRows: Array<Record<string, string | number>> = [];
    for (const day of activeMealPlan.days) {
      for (const meal of day.meals) {
        planRows.push({
          Dag: day.dayName,
          Dato: day.dateIso,
          Måltid: meal.slot === 'breakfast' ? 'Morgenmad' : meal.slot === 'lunch' ? 'Frokost' : 'Aftensmad',
          Ret: meal.title,
          'Kalorier (kcal)': meal.calories,
          'Protein (g)': meal.protein,
          'Kulhydrat (g)': meal.carbs,
          'Fedt (g)': meal.fat,
          'Fibre (g)': meal.fiber,
          'Est. pris (DKK)': meal.estimatedCostDkk,
          'Tid (min)': meal.prepMinutes,
        });
      }
    }
    const wsPlan = XLSX.utils.json_to_sheet(planRows);
    wsPlan['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 38 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPlan, 'Madplan og Næring');
  }

  XLSX.writeFile(wb, `MadPlan-Nord-Økonomi-${monthKey}.xlsx`);
}

export function exportReceiptsToCsv(receipts: Receipt[], monthKey: string): void {
  const header = ['Dato', 'Butik', 'Kategori', 'Beløb (DKK)', 'Tags', 'Noter'];
  const rows = receipts.map((r) => [
    r.purchaseDate,
    `"${r.storeName.replace(/"/g, '""')}"`,
    `"${r.primaryCategory}"`,
    r.totalDkk.toFixed(2),
    `"${r.tags.join('; ')}"`,
    `"${r.notes.replace(/"/g, '""')}"`,
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MadPlan-Nord-Udgifter-${monthKey}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
