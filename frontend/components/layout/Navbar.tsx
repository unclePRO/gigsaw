'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);

  const user = session?.user as any;
  const isMerchant = user?.role === 'merchant';
  const isFreelancer = user?.role === 'freelancer';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.jpg"
            alt="GigSaw"
            width={32}
            height={32}
            className="rounded-lg object-contain"
            priority
          />
          <span className="font-extrabold text-xl text-slate-900 tracking-tight">GigSaw</span>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="flex items-center justify-center gap-2 text-sm font-semibold">
          {session ? (
            /* Center links when logged in */
            isMerchant ? (
              <>
                <Link
                  href="/create"
                  className={`px-3.5 py-2 rounded-lg transition-colors ${
                    pathname === '/create'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Create Project
                </Link>
                <Link
                  href="/dashboard"
                  className={`px-3.5 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Project Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/freelancer/dashboard"
                  className={`px-3.5 py-2 rounded-lg transition-colors ${
                    pathname === '/freelancer/dashboard'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My Gigs
                </Link>
                <Link
                  href="/freelancer/profile"
                  className={`px-3.5 py-2 rounded-lg transition-colors ${
                    pathname === '/freelancer/profile'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Skills & Portfolio
                </Link>
                <Link
                  href="/freelancer/invitations"
                  className={`px-3.5 py-2 rounded-lg transition-colors ${
                    pathname === '/freelancer/invitations'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Invitations
                </Link>
              </>
            )
          ) : (
            /* Center links when NOT logged in: 'Hire Freelancers' and 'Find Work' */
            <div className="flex items-center gap-3">
              <Link
                href="/login?tab=register&role=merchant"
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-cyan-600" />
                <span>Hire Freelancers</span>
              </Link>
              <Link
                href="/login?tab=register&role=freelancer"
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5 text-cyan-600" />
                <span>Find Work</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Right Auth: Sign In button has the blue/cyan styling */}
        <div className="flex items-center gap-3 shrink-0">
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 pl-2.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs font-bold text-slate-800 max-w-[120px] truncate">
                  {user.name}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {user.role === 'freelancer' && user.category ? user.category : user.role}
                </span>
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 text-xs z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-900">{user.name}</p>
                    <p className="text-slate-400 text-[11px] truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                      {user.role} {user.category ? `(${user.category})` : ''}
                    </span>
                  </div>

                  <div className="py-1">
                    {isMerchant ? (
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="block px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                      >
                        Merchant Dashboard
                      </Link>
                    ) : (
                      <>
                        <Link
                          href="/freelancer/dashboard"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                        >
                          My Gigs
                        </Link>
                        <Link
                          href="/freelancer/profile"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                        >
                          Skills & Portfolio
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut({ callbackUrl: '/login' });
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Sign In button with the Cyan/Blue highlight on the right */
            <Link
              href="/login"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
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
