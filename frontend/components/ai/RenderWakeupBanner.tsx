'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Server, CheckCircle2, X, RefreshCw, ChevronUp, ChevronDown, Zap } from 'lucide-react';

export const RenderWakeupBanner: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'awake' | 'waking'>('checking');
  const [elapsed, setElapsed] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [wakeAttempt, setWakeAttempt] = useState<number>(0);

  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/ai/health', { cache: 'no-store' });
      const data = await res.json();

      if (data.online) {
        setStatus('awake');
        // Auto-dismiss after 3 seconds once awake
        setTimeout(() => {
          setIsDismissed(true);
        }, 3000);
      } else {
        setStatus('waking');
        // Retry polling in 4 seconds while waking
        checkTimerRef.current = setTimeout(checkHealth, 4000);
      }
    } catch {
      setStatus('waking');
      checkTimerRef.current = setTimeout(checkHealth, 4000);
    }
  };

  useEffect(() => {
    // Initial health check
    checkHealth();

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // Timer for elapsed seconds while waking up
  useEffect(() => {
    if (status === 'waking') {
      elapsedTimerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (status === 'awake') {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [status]);

  if (isDismissed || status === 'checking') {
    return null;
  }

  // Once awake: show quick success pill then disappear
  if (status === 'awake') {
    return (
      <aside aria-label="AI Service Status" className="fixed bottom-5 right-5 z-50 animate-fadeIn">
        <div className="hidden flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#1B3B39]/95 backdrop-blur-md border border-emerald-500/40 shadow-xl text-xs text-emerald-800 dark:text-emerald-200 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>AI Engine Online &amp; Ready!</span>
        </div>
      </aside>
    );
  }

  // If minimized to a subtle floating pill
  if (isMinimized) {
    return (
      <aside aria-label="AI Service Status" className="fixed bottom-5 right-5 z-50 animate-fadeIn">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 dark:bg-[#1B3B39]/95 backdrop-blur-md border border-[#168C80]/40 text-white shadow-2xl text-xs">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
          <div className="flex items-center gap-1.5 font-bold">
            <span>Waking up Render AI...</span>
            <span className="font-mono text-cyan-300 text-[11px]">({elapsed}s)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
            title="Expand notification"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  // Transparent floating screen / glassmorphic card on landing page
  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/20 backdrop-blur-[2px] transition-all animate-fadeIn">
      <div className="pointer-events-auto max-w-md w-full bg-white/95 dark:bg-[#102B2B]/95 backdrop-blur-xl border border-[#168C80]/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#168C80] to-[#32B6A5] text-white flex items-center justify-center shadow-lg shadow-[#168C80]/20 shrink-0">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[#10413E] dark:text-[#F0FAF8]">
                  Waking Up AI Engine
                </h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Render Free Tier
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Spinning up container from idle sleep...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Minimize to corner"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="p-3.5 rounded-2xl bg-[#F0F8F6] dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] text-xs space-y-2 text-slate-600 dark:text-slate-300">
          <p className="leading-relaxed">
            The Python AI service on Render sleeps after 15 minutes of inactivity. We automatically sent a wake-up probe when you opened the page.
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-[#D8E9E4]/60 dark:border-[#345451]/60">
            <span>Expected boot time: <strong>~30–50 seconds</strong></span>
            <span className="font-mono font-bold text-[#168C80] dark:text-[#73D8C7]">
              Elapsed: {elapsed}s
            </span>
          </div>
        </div>

        {/* Progress Animation Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#168C80] via-[#32B6A5] to-[#73D8C7] transition-all duration-1000"
              style={{ width: `${Math.min(95, Math.max(8, (elapsed / 45) * 100))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Sending health probes...</span>
            <span>You can explore while it loads</span>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="text-[11px] font-semibold text-[#168C80] dark:text-[#73D8C7] hover:underline cursor-pointer"
          >
            Continue browsing in background &rarr;
          </button>
          <button
            type="button"
            onClick={() => checkHealth()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Check Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
