'use client';

import React, { useState } from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Users,
  ChevronDown,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { ProjectProposal, WorkPackage } from '@/types';

interface CheckoutSectionProps {
  project: ProjectProposal;
  onPaymentSuccess?: (result: any) => void;
  onPaymentError?: (error: any) => void;
}

export const CheckoutSection: React.FC<CheckoutSectionProps> = ({
  project,
  onPaymentSuccess,
  onPaymentError,
}) => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawErrorDetails, setRawErrorDetails] = useState<any | null>(null);
  const [showRawDetails, setShowRawDetails] = useState(false);

  const acceptedPackages = (project.workPackages || []).filter(
    (wp) => wp.inviteStatus === 'accepted' || (project.workPackages || []).length === 1
  );

  const totalToFund = acceptedPackages.reduce(
    (sum, wp) => sum + (Number(wp.allocatedPrice) || 0),
    0
  );

  const handleCreateOrder = async () => {
    setErrorMessage(null);
    setRawErrorDetails(null);

    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project._id || project.id,
          project,
          totalBudget: project.totalBudget,
          projectName: project.projectName,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.id) {
        const errorMsg =
          data.error ||
          data.message ||
          'Failed to initialize PayPal Multi-Seller Order.';
        console.error('[PayPal Multi-Seller Create Error]:', data.rawError || data);
        setErrorMessage(errorMsg);
        setRawErrorDetails(data.rawError || data);
        if (onPaymentError) onPaymentError(data);
        throw new Error(errorMsg);
      }

      return data.id;
    } catch (err: any) {
      console.error('[PayPal Create Order Exception]:', err);
      if (!errorMessage) {
        setErrorMessage(err.message || 'Error communicating with PayPal API.');
      }
      throw err;
    }
  };

  const handleApprove = async (data: { orderID: string }) => {
    setLoading(true);
    setErrorMessage(null);
    setRawErrorDetails(null);

    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderID: data.orderID,
          projectId: project._id || project.id,
        }),
      });

      const captureResult = await res.json();

      if (!res.ok || !captureResult.success) {
        const errorMsg =
          captureResult.error ||
          captureResult.message ||
          'Failed to capture PayPal multi-seller escrow payment.';
        console.error('[PayPal Capture Error]:', captureResult.rawError || captureResult);
        setErrorMessage(errorMsg);
        setRawErrorDetails(captureResult.rawError || captureResult);
        if (onPaymentError) onPaymentError(captureResult);
        return;
      }

      setSuccessMessage(
        'PayPal Multi-Seller Escrow payment captured successfully! Project status updated to FUNDED_IN_PROGRESS.'
      );
      if (onPaymentSuccess) {
        onPaymentSuccess(captureResult);
      }
    } catch (err: any) {
      console.error('[PayPal Capture Exception]:', err);
      setErrorMessage(err.message || 'Error capturing payment with PayPal API.');
      if (onPaymentError) onPaymentError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCheckout = async () => {
    setLoading(true);
    setErrorMessage(null);
    setRawErrorDetails(null);

    try {
      const simulatedOrderId = `PP-DIRECT-${Date.now()}`;
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderID: simulatedOrderId,
          projectId: project._id || project.id,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setSuccessMessage('Sandbox payment authorized! Project is now FUNDED_IN_PROGRESS.');
        if (onPaymentSuccess) onPaymentSuccess(result);
      } else {
        setErrorMessage(result.error || 'Failed test checkout.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Test checkout failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-cyan-500/10 dark:from-[#0F172A] dark:to-[#0F172A] border-2 border-amber-500/30 dark:border-amber-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 dark:bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Specialists Confirmed & Accepted
            </span>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full">
              Status: READY_TO_FUND
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Authorize Multi-Seller Escrow Checkout
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Every assigned freelancer has accepted their milestone invitation.
            Authorize a single consolidated transaction via PayPal Orders v2.
            Funds are routed directly into individual escrow purchase units for each specialist and disbursed upon deliverable review.
          </p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Consolidated Escrow Total
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ${totalToFund.toFixed(2)} USD
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
            {acceptedPackages.length} accepted milestone{acceptedPackages.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Accepted Specialists Breakdown & Magic Split */}
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-500" />
              The Magic Split: Individual Specialist Payees & Platform Cut
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              When approved, PayPal automatically disburses individual escrow amounts directly to each specialist's account upfront.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
            {acceptedPackages.length} Payee{acceptedPackages.length > 1 ? 's' : ''} + 5% Platform Fee
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {acceptedPackages.map((wp, idx) => (
            <div
              key={wp.id || idx}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 flex items-start justify-between gap-3 shadow-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    {wp.category}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {wp.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  Specialist: <strong className="text-slate-800 dark:text-slate-100">{wp.assignedFreelancerName || 'Assigned Talent'}</strong>
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1">
                  <span>PayPal:</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {wp.assignedFreelancerEmail || 'freelancer@sandbox.paypal.com'}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  ${Number(wp.allocatedPrice || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 justify-end">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Accepted</span>
                </div>
              </div>
            </div>
          ))}

          {/* Platform fee card */}
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                  Gigsaw Fee
                </span>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  5% Platform Commission
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Escrow management, AI mediation, and buyer protection guarantee
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-black text-purple-700 dark:text-purple-300">
                ${(totalToFund * 0.05).toFixed(2)}
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                Auto-collected
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification with Raw Debug details */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2 text-xs text-rose-700 dark:text-rose-300 font-medium animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>PayPal Error: {errorMessage}</span>
          </div>

          {rawErrorDetails && (
            <div className="pt-2 border-t border-rose-500/20">
              <button
                type="button"
                onClick={() => setShowRawDetails(!showRawDetails)}
                className="text-[11px] text-rose-600 dark:text-rose-400 underline hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <span>{showRawDetails ? 'Hide' : 'Show'} Raw PayPal Error Response</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showRawDetails ? 'rotate-180' : ''}`} />
              </button>

              {showRawDetails && (
                <pre className="mt-2 p-3 bg-slate-900 text-slate-200 text-[11px] font-mono rounded-xl overflow-x-auto max-h-48 border border-slate-700">
                  {JSON.stringify(rawErrorDetails, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* PayPal SDK Button Container */}
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 shadow-sm">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black uppercase tracking-wider mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Single Checkout &bull; Pay ${totalToFund.toLocaleString()} with PayPal</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure Multi-Seller Escrow Authorization</span>
          </div>
          <p className="text-[11px] text-slate-400 max-w-sm">
            Log in once with PayPal to approve the complete ${totalToFund.toLocaleString()} USD budget. PayPal will automatically split the funds to each specialist while securing escrow protection.
          </p>
        </div>

        {/* Sandbox Credentials Guide */}
        <div className="w-full max-w-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-[11px] text-blue-950 dark:text-blue-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Sandbox Credentials To Use In Popup</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
            In the PayPal popup, log in with your <strong>Sandbox Personal (Buyer)</strong> account from <span className="font-mono text-cyan-600 dark:text-cyan-400">developer.paypal.com &rarr; Testing Tools &rarr; Sandbox Accounts</span> (e.g. <span className="font-mono">sb-buyer...</span>). Do not use real personal PayPal credentials.
          </p>
        </div>

        <div className="w-full max-w-md min-h-[50px] flex items-center justify-center">
          <PayPalButtons
            style={{
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 46,
            }}
            disabled={loading}
            createOrder={handleCreateOrder}
            onApprove={handleApprove}
            onError={(err: any) => {
              console.error('[PayPal SDK Error]:', err);
              setErrorMessage(
                err?.message || 'An unexpected error occurred during PayPal authorization.'
              );
              setRawErrorDetails(err);
            }}
          />
        </div>

        {/* 1-Click Simulation / Bypass Button for Sandbox testing */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 w-full max-w-md flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleTestCheckout}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Escrow Capture...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                <span>Instant 1-Click Test Sandbox Authorize</span>
              </>
            )}
          </button>
          <span className="text-[10px] text-slate-400">
            Use for rapid testing if PayPal sandbox popup is blocked or multi-seller partner permissions are restricted.
          </span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSection;
