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
          setSuccessActionMsg('Invitation accepted! This gig is now active in your workspace.');
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
      <div className="p-12 text-center text-xs text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-600" />
        <span>Loading invitations from MongoDB...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Invitations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Milestones matched by our AI talent selection engine for your category (
            <strong className="uppercase">{userCategory}</strong>).
          </p>
        </div>

        <button
          onClick={fetchInvitations}
          className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {successActionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successActionMsg}</span>
          </div>
          <Link
            href="/freelancer/dashboard"
            className="text-cyan-700 underline font-bold hover:text-cyan-900"
          >
            Go to Active Gigs &rarr;
          </Link>
        </div>
      )}

      {pendingInvites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <FolderOpen className="w-9 h-9 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Pending Invitations</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You currently have no pending invites. When a merchant launches a project that matches your skills, AI invitations will arrive here.
          </p>
          <div className="pt-2">
            <Link
              href="/freelancer/profile"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
            >
              <span>Update Skills & Portfolio to Increase Matches</span>
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
                className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                        Category: {pkg.category} {pkg.roleName ? `• ${pkg.roleName}` : ''}
                      </span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                        Pending Your Acceptance
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">{project.projectName}</h2>
                    <p className="text-xs text-slate-500">
                      Merchant: <strong className="text-slate-700">{project.merchantName}</strong> ({project.merchantEmail})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Offered Payout</span>
                    <span className="text-2xl font-black text-slate-900">${pkg.allocatedPrice}</span>
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{pkg.title}</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{pkg.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Payment authorized by merchant in escrow</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRespond(projId, pkg.id, 'decline')}
                      className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRespond(projId, pkg.id, 'accept')}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      {isProcessing ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept & Start Gig</span>
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
