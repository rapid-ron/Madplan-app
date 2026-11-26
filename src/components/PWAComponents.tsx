import React, { useState } from 'react';
import { Download, Smartphone, UtensilsCrossed, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-teal-700/20 bg-teal-50 text-teal-900 font-medium hover:bg-teal-100/80 transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
          compact ? 'px-3 py-2 text-xs' : 'w-full px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isInstallable ? 'Installér Android-app' : 'Installér som app'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-teal-700 shrink-0" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Installér MadPlan Nord på mobilen
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                aria-label="Luk"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-slate-600 list-decimal pl-5">
                <li>Tryk på <strong>Del</strong>-ikonet nederst i Safari.</li>
                <li>Rul ned og vælg <strong>Føj til hjemmeskærm</strong>.</li>
                <li>Tryk på <strong>Tilføj</strong> — appen åbner nu i fuld skærm og virker offline.</li>
              </ol>
            ) : (
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  MadPlan Nord er bygget som en fuld Android-klar PWA med offline-understøttelse og kan også pakkes direkte til en Android APK (via Trusted Web Activity / PWABuilder).
                </p>
                <ol className="space-y-2 list-decimal pl-5">
                  <li>Åbn appen i <strong>Chrome på Android</strong>.</li>
                  <li>Tryk på menuen (tre prikker) øverst til højre.</li>
                  <li>Vælg <strong>Installér app</strong> eller <strong>Føj til startskærm</strong>.</li>
                </ol>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Forstået
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-900 px-3.5 py-2 text-xs font-medium text-amber-50 shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline-tilstand — Gemte data vises lokalt</span>
    </div>
  );
};

export const RecipeImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = 'w-full h-44 object-cover' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-teal-50/70 text-slate-500 ${className}`}
      >
        <UtensilsCrossed className="w-7 h-7 text-teal-700/60" />
        <span className="text-xs font-medium text-slate-600 px-3 text-center line-clamp-1">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
