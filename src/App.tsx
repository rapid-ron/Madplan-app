/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Cloud,
  Receipt as ReceiptIcon,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator, PWAInstallButton } from './components/PWAComponents';
import { MealPlanView } from './components/MealPlanView';
import { ShoppingListView } from './components/ShoppingListView';
import { RecipesView } from './components/RecipesView';
import { ReceiptsView } from './components/ReceiptsView';
import { BudgetView } from './components/BudgetView';
import { SettingsSyncView } from './components/SettingsSyncView';
import { AppSection } from './types';

const NAV_ITEMS: Array<{
  id: AppSection;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'madplan', label: 'Madplan', shortLabel: 'Madplan', icon: CalendarDays },
  { id: 'indkoeb', label: 'Indkøbsliste', shortLabel: 'Indkøb', icon: ShoppingCart },
  { id: 'opskrifter', label: 'Opskrifter', shortLabel: 'Opskrifter', icon: BookOpen },
  { id: 'kvitteringer', label: 'Kvitteringer', shortLabel: 'Kvittering', icon: ReceiptIcon },
  { id: 'budget', label: 'Budget & Statistik', shortLabel: 'Budget', icon: BarChart3 },
  { id: 'indstillinger', label: 'Synk & Backup', shortLabel: 'Synk', icon: Settings },
];

const AppShell: React.FC = () => {
  const [section, setSection] = useState<AppSection>('madplan');
  const {
    user,
    cloudSynced,
    shoppingItems,
    isOverBudget,
    isNearBudget,
    budgetUsagePercent,
    signInWithGoogle,
  } = useAppData();

  const remainingShopCount = shoppingItems.filter((i) => !i.checked).length;

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Persistent Sidebar (248px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/80 z-30">
        <div className="px-6 py-5 border-b border-slate-100">
          <button
            onClick={() => setSection('madplan')}
            className="text-xl font-bold tracking-tight font-display text-slate-900 whitespace-nowrap"
          >
            MadPlan Nord
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full min-h-[44px] flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'indkoeb' && remainingShopCount > 0 && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      active ? 'text-teal-100' : 'text-slate-400'
                    }`}
                  >
                    {remainingShopCount}
                  </span>
                )}
                {item.id === 'budget' && (isOverBudget || isNearBudget) && (
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-amber-200' : isOverBudget ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2.5">
          <PWAInstallButton />
          {user ? (
            <button
              onClick={() => setSection('indstillinger')}
              className="w-full min-h-[44px] flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
            >
              <Cloud className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user.displayName || 'Synkroniseret'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {cloudSynced ? 'Cloud-synk aktiv' : 'Synkroniserer...'}
                </p>
              </div>
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Cloud className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Aktivér Cloud-Synk</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Compact Top App Bar (52px) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 flex items-center justify-between gap-4">
        <button
          onClick={() => setSection('madplan')}
          className="text-base font-bold font-display tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          MadPlan Nord
        </button>

        <div className="flex items-center gap-1.5">
          <PWAInstallButton compact />
          <button
            onClick={() => setSection('indstillinger')}
            aria-label="Cloud-synk og indstillinger"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
              section === 'indstillinger'
                ? 'bg-teal-700 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Global Budget Overrun Alert Strip (when outside Budget view) */}
        {section !== 'budget' && isOverBudget && (
          <div className="bg-rose-700 text-white px-4 md:px-8 py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Månedsbudget overskredet ({budgetUsagePercent}% brugt)
            </span>
            <button
              onClick={() => setSection('budget')}
              className="font-semibold underline whitespace-nowrap shrink-0"
            >
              Se budgetrapport
            </button>
          </div>
        )}

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {section === 'madplan' && (
            <MealPlanView onNavigateToShopping={() => setSection('indkoeb')} />
          )}
          {section === 'indkoeb' && (
            <ShoppingListView onReceiptCreated={() => setSection('kvitteringer')} />
          )}
          {section === 'opskrifter' && <RecipesView />}
          {section === 'kvitteringer' && <ReceiptsView />}
          {section === 'budget' && <BudgetView />}
          {section === 'indstillinger' && <SettingsSyncView />}
        </main>
      </div>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar (5 primary destinations) */}
      <nav
        aria-label="Primær mobilnavigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight truncate max-w-full px-1">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </ErrorBoundary>
  );
}
