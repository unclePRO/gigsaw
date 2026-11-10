'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  ChevronDown,
  LogOut,
  User,
  Users,
  Briefcase,
  Layers,
  Sparkles,
  LogIn,
  Sun,
  Moon,
  PlusCircle,
  BarChart3,
  CheckSquare,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const user = session?.user as any;
  const isMerchant = user?.role === 'merchant';
  const isFreelancer = user?.role === 'freelancer';

  // Fetch pending invite count for freelancers
  const fetchInviteCount = useCallback(async () => {
    if (!isFreelancer || !user?.email) return;
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        const userEmail = user.email.toLowerCase();
        const userCategory = user.category || 'dev';
        let count = 0;
        data.projects.forEach((proj: any) => {
          proj.workPackages?.forEach((wp: any) => {
            const isInvited = wp.inviteStatus === 'invited' || !wp.inviteStatus;
            const matchesMe =
              wp.assignedFreelancerEmail?.toLowerCase() === userEmail ||
              (!wp.assignedFreelancerEmail && wp.category === userCategory);
            if (isInvited && matchesMe) count++;
          });
        });
        setPendingInviteCount(count);
      }
    } catch {}
  }, [isFreelancer, user?.email, user?.category]);

  useEffect(() => {
    if (isFreelancer) {
      fetchInviteCount();
      // Poll every 30 seconds
      const interval = setInterval(fetchInviteCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isFreelancer, fetchInviteCount]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm transition-transform group-hover:scale-105">
            <Image
              src="/logo.jpg"
              alt="GigSaw"
              width={32}
              height={32}
              className="object-contain w-full h-full"
              priority
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">GigSaw</span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              AI
            </span>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="flex items-center justify-center gap-1.5 text-xs font-semibold">
          {session ? (
            /* Navigation links when authenticated */
            isMerchant ? (
              <>
                <Link
                  href="/create"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                    pathname === '/create'
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Launch Project</span>
                </Link>
                <Link
                  href="/dashboard"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                    pathname === '/dashboard'
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Project Dashboard</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/freelancer/dashboard"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                    pathname === '/freelancer/dashboard'
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>My Gigs</span>
                </Link>
                <Link
                  href="/freelancer/invitations"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 relative ${
                    pathname === '/freelancer/invitations'
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Invites</span>
                  {pendingInviteCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-sm animate-pulse">
                      {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/freelancer/profile"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 relative ${
                    pathname === '/freelancer/profile'
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Portfolio</span>
                  {user?.isProfileComplete === false && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Profile Setup Required" />
                  )}
                </Link>
              </>
            )
          ) : (
            /* Clean action links when NOT authenticated */
            <div className="flex items-center gap-2">
              <Link
                href="/login?tab=register&role=merchant"
                className="px-3.5 py-2 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Hire Freelancers</span>
              </Link>
              <Link
                href="/login?tab=register&role=freelancer"
                className="px-3.5 py-2 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Find Work</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Right: Theme Toggle & Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all border border-slate-200 dark:border-slate-800"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 transition-transform rotate-0 scale-100" />
            )}
          </button>

          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1 pl-2.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[110px] truncate">
                  {user.name}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {user.role === 'freelancer' && user.category ? user.category : user.role}
                </span>
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-white font-bold flex items-center justify-center text-xs">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0F172A] rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 text-xs z-50">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                    <p className="text-slate-400 text-[11px] truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400">
                      {user.role} {user.category ? `(${user.category})` : ''}
                    </span>
                  </div>

                  <div className="py-1">
                    {isMerchant ? (
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                      >
                        Merchant Dashboard
                      </Link>
                    ) : (
                      <>
                        <Link
                          href="/freelancer/dashboard"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                        >
                          My Gigs
                        </Link>
                        <Link
                          href="/freelancer/profile"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                        >
                          Portfolio & Profile
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut({ callbackUrl: '/login' });
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Sign In button with Cyan highlight */
            <Link
              href="/login"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
