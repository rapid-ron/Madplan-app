import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Cloud,
  Download,
  HardDriveDownload,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { DIET_LABELS, DietType } from '../types';
import { downloadWeeklyPlanIcs, requestAndSendNotification } from '../lib/calendarExport';
import { PWAInstallButton } from './PWAComponents';

export const SettingsSyncView: React.FC = () => {
  const {
    user,
    cloudSynced,
    syncError,
    profile,
    activeMealPlan,
    mealPlans,
    recipes,
    receipts,
    shoppingItems,
    backups,
    signInWithGoogle,
    signOutUser,
    updateProfile,
    createCloudBackup,
    restoreCloudBackup,
    deleteCloudBackup,
  } = useAppData();

  const [backupLabel, setBackupLabel] = useState('');
  const [newTag, setNewTag] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBackingUp(true);
    try {
      await createCloudBackup(
        backupLabel.trim() || `Cloud-backup ${new Date().toLocaleDateString('da-DK')}`
      );
      setBackupLabel('');
      setStatusMsg(
        user
          ? 'Sikker cloud-backup er gemt og krypteret under din Google-konto.'
          : 'Lokal sikkerhedskopi oprettet. Log ind med Google for sikker cloud-backup på tværs af enheder.'
      );
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadJsonBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'MadPlan Nord',
      profile,
      mealPlans,
      recipes,
      receipts,
      shoppingItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `madplan-nord-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMsg('Lokal JSON-sikkerhedskopi er downloadet.');
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTag.trim().toLowerCase().replace(/^#/, '');
    if (!clean || profile.customTags.includes(clean)) return;
    await updateProfile({ customTags: [...profile.customTags, clean].slice(0, 30) });
    setNewTag('');
  };

  const handleRemoveTag = async (tag: string) => {
    await updateProfile({ customTags: profile.customTags.filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500">
          Synkronisering mellem enheder, sikker cloud-backup, kalendertider og Android-installation
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
          Cloud-Synk & Indstillinger
        </h1>
      </div>

      {statusMsg && (
        <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {syncError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {syncError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cloud Sync & Secure Cloud Backup */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Cloud className="w-5 h-5 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Cloud-synkronisering på tværs af enheder
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {user
                      ? `Logget ind som ${user.email}. Alle madplaner, indkøbslister, opskrifter og kvitteringer synkroniseres i realtid.`
                      : 'Log ind med Google for automatisk realtids-synkronisering mellem din Android-telefon, tablet og computer.'}
                  </p>
                </div>
              </div>
            </div>

            {user ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-emerald-700">
                    {cloudSynced ? 'Aktiv cloud-synkronisering' : 'Forbinder til cloud...'}
                  </span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span>Konto: {user.displayName || user.email}</span>
                </div>
                <button
                  onClick={signOutUser}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log ud</span>
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-800"
              >
                <LogIn className="w-4 h-4" />
                <span>Log ind med Google & aktivér cloud-synk</span>
              </button>
            )}
          </section>

          {/* Secure Cloud Backup */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Sikker Cloud-Backup & Gendannelse</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Opret øjebliksbilleder af hele din madplan, opskriftsdatabase og kvitteringshistorik. Kun din verificerede konto har adgang.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateBackup} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                placeholder="Navn på sikkerhedskopi (fx November 2026)"
                value={backupLabel}
                onChange={(e) => setBackupLabel(e.target.value)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={isBackingUp}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <HardDriveDownload className="w-4 h-4" />
                <span>Opret backup</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>JSON</span>
              </button>
            </form>

            {backups.length > 0 ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                {backups.map((b) => (
                  <li key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{b.label}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {new Date(b.createdAtIso).toLocaleString('da-DK')} · {b.deviceName} ·{' '}
                        {b.counts.recipes} opskrifter · {b.counts.receipts} kvitteringer
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await restoreCloudBackup(b);
                          setStatusMsg(`Gendannede sikkerhedskopien "${b.label}".`);
                        }}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-teal-800 hover:bg-teal-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Gendan</span>
                      </button>
                      <button
                        onClick={() => deleteCloudBackup(b.id)}
                        aria-label="Slet backup"
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 pt-1">
                Ingen gemte sikkerhedskopier endnu. Opret din første ovenfor.
              </p>
            )}
          </section>

          {/* Custom Tags Manager */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Brugerdefinerede tags</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Brug dine egne tags på kvitteringer og opskrifter for hurtig filtrering.
              </p>
            </div>

            <form onSubmit={handleAddTag} className="flex gap-2">
              <input
                type="text"
                placeholder="Tilføj nyt tag (fx sukkerfri, ugebudget)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              />
              <button
                type="submit"
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tilføj</span>
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {profile.customTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleRemoveTag(tag)}
                  title="Klik for at fjerne tag"
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                >
                  <span>#{tag}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Calendar Meal Times, Diet Preferences & Android App */}
        <div className="lg:col-span-5 space-y-6">
          {/* Calendar & Meal-Time Reminders */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-teal-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Kalender & Måltidspåmindelser
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Indstil dine faste spisetider — bruges til automatisk kalender-eksport (.ics & Google Kalender) med 30 min. påmindelse.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Morgenmad</span>
                <input
                  type="time"
                  value={profile.mealTimes.breakfast}
                  onChange={(e) =>
                    updateProfile({
                      mealTimes: { ...profile.mealTimes, breakfast: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2.5 text-sm font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Frokost</span>
                <input
                  type="time"
                  value={profile.mealTimes.lunch}
                  onChange={(e) =>
                    updateProfile({
                      mealTimes: { ...profile.mealTimes, lunch: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2.5 text-sm font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Aftensmad</span>
                <input
                  type="time"
                  value={profile.mealTimes.dinner}
                  onChange={(e) =>
                    updateProfile({
                      mealTimes: { ...profile.mealTimes, dinner: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2.5 text-sm font-mono tabular-nums"
                />
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              {activeMealPlan && (
                <button
                  onClick={() => {
                    downloadWeeklyPlanIcs(activeMealPlan, profile.mealTimes);
                    setStatusMsg('Kalenderfil (.ics) til Google/Apple/Outlook Kalender er downloadet.');
                  }}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Download .ics kalender</span>
                </button>
              )}
              <button
                onClick={async () => {
                  const ok = await requestAndSendNotification(
                    'MadPlan Nord — Påmindelse',
                    `Aftensmad kl. ${profile.mealTimes.dinner}. Notifikationer fungerer på denne enhed.`
                  );
                  setStatusMsg(
                    ok
                      ? 'Test-påmindelse blev sendt til din enhed.'
                      : 'Giv tilladelse til notifikationer i din browser for at modtage påmindelser.'
                  );
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Bell className="w-4 h-4" />
                <span>Test notifikation</span>
              </button>
            </div>
          </section>

          {/* Household & Default Diet */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Kost- & Husstandspræferencer</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-600">Standard kosttype</span>
                <select
                  value={profile.dietType}
                  onChange={(e) => updateProfile({ dietType: e.target.value as DietType })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {(Object.keys(DIET_LABELS) as DietType[]).map((k) => (
                    <option key={k} value={k}>
                      {DIET_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Daglige kalorier</span>
                <input
                  type="number"
                  step={50}
                  value={profile.dailyCalories}
                  onChange={(e) => updateProfile({ dailyCalories: Number(e.target.value) })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Husstand (pers.)</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={profile.householdSize}
                  onChange={(e) => updateProfile({ householdSize: Number(e.target.value) })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>
            </div>
          </section>

          {/* Android App / PWA Install Card */}
          <section className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-teal-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Android-app & Offline PWA</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Installér MadPlan Nord direkte på din Android-telefon som en fuldskærms-app med kamera-scanner, offline-adgang og APK/TWA-kompatibelt manifest.
                </p>
              </div>
            </div>
            <PWAInstallButton />
          </section>
        </div>
      </div>
    </div>
  );
};
