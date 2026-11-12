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
  const { data: session, status } = useSession();
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
    <header className="sticky top-0 z-50 bg-[#D6ECE5]/95 dark:bg-[#0B1E1E]/95 backdrop-blur-md border-b border-[#B4D5CD] dark:border-[#1F4240] transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="h-9 flex items-center">
            {/* Light mode: logo with dark text */}
            <Image
              src="/logo-light.png"
              alt="Gigsaw"
              width={140}
              height={36}
              className="h-8 w-auto dark:hidden object-contain"
              priority
            />
            {/* Dark mode: logo with white text */}
            <Image
              src="/logo-dark.png"
              alt="Gigsaw"
              width={140}
              height={36}
              className="h-8 w-auto hidden dark:block object-contain"
              priority
            />
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
                      ? 'bg-white/85 dark:bg-[#1B3B39] text-[#10413E] dark:text-[#73D8C7] border border-[#B4D5CD] dark:border-[#2A524F] font-bold shadow-xs'
                      : 'text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Launch Project</span>
                </Link>
                <Link
                  href="/dashboard"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                    pathname === '/dashboard'
                      ? 'bg-white/85 dark:bg-[#1B3B39] text-[#10413E] dark:text-[#73D8C7] border border-[#B4D5CD] dark:border-[#2A524F] font-bold shadow-xs'
                      : 'text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
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
                      ? 'bg-white/85 dark:bg-[#1B3B39] text-[#10413E] dark:text-[#73D8C7] border border-[#B4D5CD] dark:border-[#2A524F] font-bold shadow-xs'
                      : 'text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>My Gigs</span>
                </Link>
                <Link
                  href="/freelancer/invitations"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 relative ${
                    pathname === '/freelancer/invitations'
                      ? 'bg-white/85 dark:bg-[#1B3B39] text-[#10413E] dark:text-[#73D8C7] border border-[#B4D5CD] dark:border-[#2A524F] font-bold shadow-xs'
                      : 'text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Invites</span>
                  {pendingInviteCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs">
                      {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/freelancer/profile"
                  className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                    pathname === '/freelancer/profile'
                      ? 'bg-white/85 dark:bg-[#1B3B39] text-[#10413E] dark:text-[#73D8C7] border border-[#B4D5CD] dark:border-[#2A524F] font-bold shadow-xs'
                      : 'text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Portfolio</span>
                </Link>
              </>
            )
          ) : (
            /* Clean action links when NOT authenticated */
            <div className="flex items-center gap-2">
              <Link
                href="/login?tab=register&role=merchant"
                className="px-3.5 py-2 rounded-lg font-bold text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-[#168C80] dark:text-[#32B6A5]" />
                <span>Hire Freelancers</span>
              </Link>
              <Link
                href="/login?tab=register&role=freelancer"
                className="px-3.5 py-2 rounded-lg font-bold text-[#244340] dark:text-[#A3C5BF] hover:text-[#10413E] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#168C80] dark:text-[#32B6A5]" />
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
            className="p-2 rounded-xl text-[#244340] hover:text-[#10413E] dark:text-[#A3C5BF] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all border border-[#B4D5CD] dark:border-[#1F4240]"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
            ) : (
              <Moon className="w-4 h-4 text-[#244340] transition-transform rotate-0 scale-100" />
            )}
          </button>

          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1 pl-2.5 rounded-full border border-[#B4D5CD] dark:border-[#1F4240] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8] max-w-[110px] truncate">
                  {user.name}
                </span>
                <div className="w-6 h-6 rounded-full bg-[#168C80] text-white font-bold flex items-center justify-center text-xs">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#527773] dark:text-[#A3C5BF] mr-1" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#F0F8F6] dark:bg-[#0D2423] rounded-xl shadow-xl border border-[#B4D5CD] dark:border-[#1F4240] py-1.5 text-xs z-50">
                  <div className="px-3.5 py-2.5 border-b border-[#D8E9E4] dark:border-[#1F4240]">
                    <p className="font-bold text-[#10413E] dark:text-white">{user.name}</p>
                    <p className="text-[#527773] dark:text-[#A3C5BF] text-[11px] truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#E5F5F1] dark:bg-[#1B3B39] text-[#168C80] dark:text-[#73D8C7] border border-[#D8E9E4] dark:border-[#2A524F]">
                      {user.role} {user.category ? `(${user.category})` : ''}
                    </span>
                  </div>

                  <div className="py-1">
                    {isMerchant ? (
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-[#244340] dark:text-[#A3C5BF] font-medium"
                      >
                        Merchant Dashboard
                      </Link>
                    ) : (
                      <>
                        <Link
                          href="/freelancer/dashboard"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-[#244340] dark:text-[#A3C5BF] font-medium"
                        >
                          My Gigs
                        </Link>
                        <Link
                          href="/freelancer/profile"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3.5 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-[#244340] dark:text-[#A3C5BF] font-medium"
                        >
                          Portfolio & Profile
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="border-t border-[#D8E9E4] dark:border-[#1F4240] pt-1">
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
              className="px-4 py-2 bg-[#168C80] hover:bg-[#10766D] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
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
