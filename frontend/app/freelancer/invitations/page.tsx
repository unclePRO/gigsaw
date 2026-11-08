'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  MailCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ProjectProposal } from '@/types';

export default function FreelancerInvitationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successActionMsg, setSuccessActionMsg] = useState<string | null>(null);

  const user = session?.user as any;
  const userEmail = user?.email?.toLowerCase();
  const userCategory = user?.category || 'dev';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/freelancer/invitations');
    }
  }, [status, router]);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchInvitations();
    }
  }, [status, fetchInvitations]);

  const handleRespond = async (projectId: string, packageId: string, action: 'accept' | 'decline') => {
    setProcessingId(`${projectId}-${packageId}`);
    try {
      const res = await fetch(`/api/invitations/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, packageId }),
      });

      const data = await res.json();
      if (data.success) {
        if (action === 'accept') {
          setSuccessActionMsg('Invitation accepted! This milestone is now active in your workspace.');
        } else {
          setSuccessActionMsg('Invitation declined.');
        }
        setTimeout(() => setSuccessActionMsg(null), 4000);
        fetchInvitations();
      }
    } catch (err) {
      console.error('Error responding to invitation:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter projects with pending invites for this freelancer
  const pendingInvites: { project: ProjectProposal; pkg: any }[] = [];

  projects.forEach((proj) => {
    proj.workPackages.forEach((wp) => {
      const isInvited = wp.inviteStatus === 'invited' || !wp.inviteStatus;
      const matchesMe =
        wp.assignedFreelancerEmail?.toLowerCase() === userEmail ||
        (!wp.assignedFreelancerEmail && wp.category === userCategory);

      if (isInvited && matchesMe) {
        pendingInvites.push({ project: proj, pkg: wp });
      }
    });
  });

  if (loading || status === 'loading') {
    return (
      <div className="p-16 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-500" />
        <span>Loading invitations from MongoDB...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              Matched Opportunities
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {pendingInvites.length} Pending
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Task Invitations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Milestones matched by our AI talent selection engine for your specialty (
            <strong className="uppercase text-cyan-600 dark:text-cyan-400">{userCategory}</strong>).
          </p>
        </div>

        <button
          onClick={fetchInvitations}
          className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto"
          title="Refresh Invitations"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {successActionMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successActionMsg}</span>
          </div>
          <Link
            href="/freelancer/dashboard"
            className="text-cyan-600 dark:text-cyan-400 underline font-bold hover:text-cyan-700 dark:hover:text-cyan-300 shrink-0"
          >
            Go to Active Gigs &rarr;
          </Link>
        </div>
      )}

      {pendingInvites.length === 0 ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Pending Invitations</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              You are all caught up! When a merchant launches a project that matches your skills, AI invitations with guaranteed PayPal escrow will arrive here.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/freelancer/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <span>Update Skills & Portfolio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingInvites.map(({ project, pkg }) => {
            const projId = (project as any)._id || project.id;
            const isProcessing = processingId === `${projId}-${pkg.id}`;

            return (
              <div
                key={`${projId}-${pkg.id}`}
                className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                        Specialty: {pkg.category} {pkg.roleName ? `• ${pkg.roleName}` : ''}
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                        Action Required
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">{project.projectName}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Merchant: <strong className="text-slate-700 dark:text-slate-300">{project.merchantName}</strong> ({project.merchantEmail})
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Milestone Offer</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">${pkg.allocatedPrice} <span className="text-xs font-semibold text-slate-400">USD</span></span>
                  </div>
                </div>

                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{pkg.title}</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{pkg.description}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Funds authorized in PayPal Escrow &bull; Released on milestone approval</span>
                  </span>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRespond(projId, pkg.id, 'decline')}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRespond(projId, pkg.id, 'accept')}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      {isProcessing ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept Milestone</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
