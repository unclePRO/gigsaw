'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

interface CardPosition {
  top: number;
  left: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
  cardWidth: number;
}

export const FreelancerProfileHoverCard: React.FC<FreelancerProfileHoverCardProps> = ({
  freelancer,
  children,
  onSwap,
  isSwapping = false,
  align = 'left',
}) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState<CardPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePosRef = useRef<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Compute position relative to viewport and cursor position
  const updatePosition = useCallback((cursorY?: number, cursorX?: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const cardWidth = Math.min(420, vw - 24);
    const padding = 12;

    // Use current cursor coordinates if provided, else cached cursor or trigger center
    const activeY =
      typeof cursorY === 'number'
        ? cursorY
        : lastMousePosRef.current?.clientY ?? (rect.top + rect.height / 2);
    const activeX =
      typeof cursorX === 'number'
        ? cursorX
        : lastMousePosRef.current?.clientX ?? (rect.left + rect.width / 2);

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    // Decide vertical placement:
    // If the cursor is in the lower half of the screen (activeY > vh * 0.5)
    // OR if available space below is insufficient (< 440px) while there is more space above -> pop up on TOP
    // Else -> pop down on BOTTOM
    const isTop = activeY > vh * 0.5 || (spaceBelow < 440 && spaceAbove > spaceBelow);

    let top: number;
    let maxHeight: number;

    if (isTop) {
      // Pop up ON TOP of cursor/trigger
      const targetBottom = Math.min(rect.top - 8, activeY - 8);
      const maxAvailable = Math.max(260, targetBottom - padding);
      maxHeight = Math.min(540, maxAvailable);
      top = Math.max(padding, targetBottom - maxHeight);
    } else {
      // Pop down ON BOTTOM of cursor/trigger
      const targetTop = Math.max(rect.bottom + 8, activeY + 12);
      const maxAvailable = Math.max(260, vh - targetTop - padding);
      maxHeight = Math.min(540, maxAvailable);
      top = targetTop;
    }

    // Horizontal placement:
    let left: number;
    if (align === 'right') {
      left = rect.right - cardWidth;
    } else if (align === 'center') {
      left = rect.left + rect.width / 2 - cardWidth / 2;
    } else {
      left = rect.left;
    }

    // If trigger element is wide (> 260px), align closer to cursor X
    if (rect.width > 260 && typeof activeX === 'number') {
      left = activeX - cardWidth / 2;
    }

    // Clamp horizontally to always stay fully within viewport
    left = Math.max(padding, Math.min(left, vw - cardWidth - padding));

    setPosition({
      top,
      left,
      maxHeight,
      placement: isTop ? 'top' : 'bottom',
      cardWidth,
    });
  }, [align]);

  // Close when clicking outside (checked against both trigger and portal card)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideTrigger = containerRef.current?.contains(target);
      const isInsideCard = cardRef.current?.contains(target);
      if (!isInsideTrigger && !isInsideCard) {
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

  // Window scroll and resize handling
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      if (isPinned) {
        updatePosition();
      } else {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, isPinned, updatePosition]);

  const handleTriggerMouseEnter = (e: React.MouseEvent) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    updatePosition(e.clientY, e.clientX);

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!isOpen && !isPinned) {
      openTimerRef.current = setTimeout(() => {
        setIsOpen(true);
      }, 70);
    }
  };

  const handleTriggerMouseMove = (e: React.MouseEvent) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (!isOpen) {
      updatePosition(e.clientY, e.clientX);
    }
  };

  const handleTriggerMouseLeave = () => {
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

  const handleCardMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
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
      if (next) updatePosition();
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

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleTriggerMouseEnter}
      onMouseMove={handleTriggerMouseMove}
      onMouseLeave={handleTriggerMouseLeave}
    >
      {/* Trigger element (Avatar, Name, or Card trigger) */}
      <div onClick={handleTogglePin} className="cursor-pointer">
        {children}
      </div>

      {/* Rich Profile Hover Card via Portal (Full screen coverage, auto on top or bottom) */}
      {isOpen && mounted && position && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={cardRef}
            role="dialog"
            aria-label={`${freelancer.name} full profile preview`}
            className="fixed z-[99999] animate-fadeIn transition-opacity duration-150 select-none"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.cardWidth}px`,
              maxHeight: `${position.maxHeight}px`,
              filter: 'drop-shadow(0 20px 35px rgba(0, 0, 0, 0.35))',
            }}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
          >
            {/* Invisible hover bridge to prevent mouse cursor drops between trigger and card */}
            {position.placement === 'top' ? (
              <div className="absolute -bottom-3 inset-x-0 h-4 pointer-events-auto" />
            ) : (
              <div className="absolute -top-3 inset-x-0 h-4 pointer-events-auto" />
            )}

            <div className="bg-white dark:bg-[#102B2B] border border-slate-200 dark:border-[#168C80]/50 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col text-left h-full max-h-full">
              {/* Top Gradient Banner (shrink-0) */}
              <div className={`relative px-5 pt-3.5 pb-10 bg-gradient-to-r ${gradientHeader} text-white shrink-0`}>
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

              {/* Main Header Overlap Section with Avatar (shrink-0) */}
              <div className="relative px-5 pb-3 -mt-8 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0 bg-white dark:bg-[#102B2B]">
                <div className="flex items-end gap-3.5 min-w-0">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#168C80] to-[#32B6A5] text-white font-black text-xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white dark:border-[#102B2B]">
                      {freelancer.name.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm"
                      title="Verified Specialist"
                    >
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
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
                        <span className="truncate max-w-[140px]">{freelancer.location || 'Remote (Global)'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Match Score Badge */}
                <div className="flex flex-col items-end shrink-0 pt-6">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-black">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    <span>{matchScore}% Match</span>
                  </div>
                </div>
              </div>

              {/* Scrollable Body (flex-1 min-h-0: scrolls within card without screen overflow) */}
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0 text-xs">
                {/* Key Metrics 4-Column Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{typeof freelancer.rating === 'number' && freelancer.rating > 0 ? freelancer.rating.toFixed(1) : '4.2'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rating</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-black text-xs text-slate-900 dark:text-white block">
                      {freelancer.completedProjects || 12}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Completed</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="font-black text-xs text-cyan-600 dark:text-cyan-400 block">
                      ${freelancer.hourlyRate || 55}/hr
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rate</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
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
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50/70 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
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
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1 hover:border-cyan-500/40 transition-colors"
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
                  <div className="p-2.5 rounded-xl bg-cyan-500/5 dark:bg-cyan-950/30 border border-cyan-500/20 space-y-1">
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

              {/* Footer with Swap Action (shrink-0) */}
              <div className="p-3 px-5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0">
                <span className="text-[11px] text-slate-400">
                  {isPinned ? 'Preview pinned (Click outside to close)' : 'Hover preview active'}
                </span>

                {onSwap && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose({ stopPropagation: () => {} } as any);
                      onSwap();
                    }}
                    disabled={isSwapping}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:border-cyan-400 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isSwapping ? 'animate-spin' : ''}`} />
                    <span>Pick Someone Else</span>
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
