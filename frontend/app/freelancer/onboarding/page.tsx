'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { CreditCard, CheckCircle2 } from 'lucide-react';

export default function FreelancerOnboardingPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment Settings & Payouts</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your PayPal account connection to receive automated milestone payouts.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700">
              <CreditCard className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Connected Payout Account</h3>
              <p className="text-xs text-slate-500">{user?.email || 'Your account email'}</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active</span>
          </span>
        </div>

        <div className="pt-2 text-xs text-slate-500 leading-relaxed">
          When a merchant approves your milestone deliverable, funds held in escrow are released to your connected payout account.
        </div>
      </div>
    </div>
  );
}
