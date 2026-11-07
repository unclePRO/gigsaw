'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ArrowRight, AlertCircle, CheckCircle2, Lock, Mail } from 'lucide-react';
import { FreelancerCategory, UserRole } from '@/types';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const initialRole = searchParams.get('role') === 'freelancer' ? 'freelancer' : 'merchant';

  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [category, setCategory] = useState<FreelancerCategory>('dev');
  const [hourlyRate, setHourlyRate] = useState<number>(50);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email.trim().toLowerCase(),
          password,
          role,
          category: role === 'freelancer' ? category : undefined,
          hourlyRate: role === 'freelancer' ? hourlyRate : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Account created successfully! Signing in...');

      const loginRes = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!loginRes?.error) {
        if (role === 'freelancer') {
          router.push('/freelancer/dashboard');
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      } else {
        setTab('login');
      }
    } catch (err: any) {
      setError(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-1.5">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/logo.jpg"
            alt="GigSaw"
            width={34}
            height={34}
            className="rounded-lg object-contain"
          />
          <span className="font-extrabold text-2xl text-slate-900 tracking-tight">GigSaw</span>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          {tab === 'login' ? 'Sign In' : 'Create an Account'}
        </h1>
        <p className="text-xs text-slate-500">
          {tab === 'login'
            ? 'Access your merchant projects or freelancer workspace.'
            : 'Register as a Merchant or as a Specialist (Dev, Designer, Marketer).'}
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setError(null);
          }}
          className={`flex-1 py-2 rounded-lg transition-all ${
            tab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register');
            setError(null);
          }}
          className={`flex-1 py-2 rounded-lg transition-all ${
            tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* LOGIN FORM */}
      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      ) : (
        /* REGISTRATION FORM */
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Miller"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Password</label>
            <input
              type="password"
              required
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">I am joining as a:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('merchant')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  role === 'merchant'
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Merchant (Hire)
              </button>
              <button
                type="button"
                onClick={() => setRole('freelancer')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  role === 'freelancer'
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Freelancer (Work)
              </button>
            </div>
          </div>

          {role === 'freelancer' && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700">Freelance Category:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dev', label: 'Developer' },
                  { id: 'designer', label: 'Designer' },
                  { id: 'marketer', label: 'Marketer' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id as FreelancerCategory)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                      category === cat.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700">Hourly Rate (USD)</label>
                <input
                  type="number"
                  min={15}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading sign in...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
