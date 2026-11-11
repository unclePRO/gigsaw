'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Star,
  Sparkles,
  Clock,
  DollarSign,
  ShieldCheck,
  FolderGit2,
  ExternalLink,
  Briefcase,
  MapPin,
  RotateCcw,
  X,
  Code2,
  Palette,
  TrendingUp,
  Mail,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { IPastProject } from '@/types';

export interface FreelancerProfileData {
  id?: string;
  name: string;
  email?: string;
  title?: string;
  category?: string;
  bio?: string;
  skills?: string[];
  rating?: number;
  completedProjects?: number;
  pastProjects?: IPastProject[];
  yearsOfExperience?: number;
  hourlyRate?: number;
  location?: string;
  typicalDeliveryDays?: number;
  availability?: string;
  matchScore?: number;
  matchScoreBreakdown?: any;
  matchReasons?: string[];
}

interface FreelancerProfileHoverCardProps {
  freelancer: FreelancerProfileData;
  children: React.ReactNode;
  onSwap?: () => void;
  isSwapping?: boolean;
  align?: 'left' | 'right' | 'center';
}

export const FreelancerProfileHoverCard: React.FC<FreelancerProfileHoverCardProps> = ({
  freelancer,
  children,
  onSwap,
  isSwapping = false,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Close when clicking outside if pinned
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsPinned(false);
        setIsOpen(false);
      }
    };

    if (isOpen || isPinned) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isPinned]);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!isOpen && !isPinned) {
      openTimerRef.current = setTimeout(() => {
        setIsOpen(true);
      }, 80);
    }
  };

  const handleMouseLeave = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (!isPinned) {
      closeTimerRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 250);
    }
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned((prev) => {
      const next = !prev;
      setIsOpen(next);
      return next;
    });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned(false);
    setIsOpen(false);
  };

  // Determine role theme styles
  const category = (freelancer.category || 'dev').toLowerCase();
  const isDev = category.includes('dev');
  const isDesigner = category.includes('design') || category.includes('ui');
  const isMarketer = category.includes('market') || category.includes('seo');

  const gradientHeader = isDev
    ? 'from-[#10413E] via-[#168C80] to-[#32B6A5]'
    : isDesigner
    ? 'from-indigo-900 via-purple-700 to-pink-600'
    : 'from-amber-900 via-orange-700 to-amber-500';

  const roleLabel = isDev ? 'Software Engineer' : isDesigner ? 'Visual & UI/UX Designer' : 'Growth & Marketing Strategist';
  const RoleIcon = isDev ? Code2 : isDesigner ? Palette : TrendingUp;

  // Normalized score
  const rawScore = Number(freelancer.matchScore) || 94;
  const matchScore = rawScore > 100 ? Math.min(99, Math.round(rawScore / 100)) : Math.min(99, Math.max(1, Math.round(rawScore)));

  // Alignment classes for desktop popover
  const alignmentClass =
    align === 'right'
      ? 'right-0 sm:right-0 sm:left-auto'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0 sm:left-0 sm:right-auto';

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger element (Avatar, Name, or Card trigger) */}
      <div onClick={handleTogglePin} className="cursor-pointer">
        {children}
      </div>

      {/* Rich Profile Hover Card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={`${freelancer.name} full profile preview`}
          className={`absolute top-full mt-2.5 z-50 w-[350px] sm:w-[420px] max-w-[92vw] ${alignmentClass} animate-fadeIn`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.25))' }}
        >
          <div className="bg-white dark:bg-[#102B2B] border border-slate-200 dark:border-[#168C80]/50 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl max-h-[85vh] flex flex-col text-left">
            {/* Top Gradient Banner */}
            <div className={`relative px-5 pt-4 pb-12 bg-gradient-to-r ${gradientHeader} text-white`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/25 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white border border-white/20">
                  <RoleIcon className="w-3 h-3 shrink-0" />
                  <span>{roleLabel}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/30 backdrop-blur-md text-[10px] font-bold text-emerald-200 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Available</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors"
                    title="Close preview"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Header Overlap Section with Avatar */}
            <div className="relative px-5 pb-4 -mt-9 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-end gap-3.5 min-w-0">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#168C80] to-[#32B6A5] text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white dark:border-[#102B2B]">
                    {freelancer.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm"
                    title="Verified Specialist"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                      {freelancer.name}
                    </h4>
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200/50 dark:border-cyan-800/50 shrink-0">
                      PRO
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {freelancer.title || roleLabel}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{freelancer.location || 'Remote (Global)'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Match Score Badge */}
              <div className="flex flex-col items-end shrink-0 pt-7">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-black">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span>{matchScore}% Match</span>
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[50vh] text-xs">
              {/* Key Metrics 4-Column Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{typeof freelancer.rating === 'number' && freelancer.rating > 0 ? freelancer.rating.toFixed(1) : '4.2'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rating</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="font-black text-xs text-slate-900 dark:text-white block">
                    {freelancer.completedProjects || 12}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Completed</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="font-black text-xs text-cyan-600 dark:text-cyan-400 block">
                    ${freelancer.hourlyRate || 55}/hr
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rate</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-center gap-1 font-black text-xs text-slate-900 dark:text-white">
                    <Clock className="w-3 h-3 text-cyan-500" />
                    <span>~{freelancer.typicalDeliveryDays || 5}d</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Speed</span>
                </div>
              </div>

              {/* Professional Bio */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Professional Bio
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {freelancer.bio ||
                    'Senior certified specialist with a proven track record delivering production-grade milestones on budget and on schedule.'}
                </p>
              </div>

              {/* Skills Tags */}
              {freelancer.skills && freelancer.skills.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Verified Core Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {freelancer.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-900/50"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Past Projects / Portfolio */}
              {freelancer.pastProjects && freelancer.pastProjects.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Verified Portfolio Projects ({freelancer.pastProjects.length})
                    </span>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Enterprise Tested</span>
                  </div>

                  <div className="space-y-2">
                    {freelancer.pastProjects.map((p, pIdx) => (
                      <div
                        key={pIdx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 hover:border-cyan-500/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <FolderGit2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span>{p.title}</span>
                          </h5>
                          {p.completionDate && (
                            <span className="text-[10px] text-slate-400 shrink-0">{p.completionDate}</span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                          {p.description}
                        </p>

                        {p.technologies && p.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {p.technologies.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Match Reasons */}
              {freelancer.matchReasons && freelancer.matchReasons.length > 0 && (
                <div className="p-3 rounded-xl bg-cyan-500/5 dark:bg-cyan-950/30 border border-cyan-500/20 space-y-1">
                  <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase block">
                    Why Matched for this Milestone:
                  </span>
                  <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                    {freelancer.matchReasons.map((r, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer with Swap Action */}
            <div className="p-3.5 px-5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
              <span className="text-[11px] text-slate-400">
                {isPinned ? 'Preview pinned' : 'Hover preview active'}
              </span>

              {onSwap && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose({ stopPropagation: () => {} } as any);
                    onSwap();
                  }}
                  disabled={isSwapping}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:border-cyan-400 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isSwapping ? 'animate-spin' : ''}`} />
                  <span>Pick Someone Else</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
