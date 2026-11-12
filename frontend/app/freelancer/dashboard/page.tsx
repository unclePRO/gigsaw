'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Briefcase,
  Layers,
  ArrowRight,
  TrendingUp,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  Star,
  Award,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { WorkPackage, ProjectProposal } from '@/types';

export default function FreelancerDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/freelancer/dashboard&role=freelancer');
    } else if (status === 'authenticated') {
      const u = session?.user as any;
      if (u?.role === 'merchant') {
        router.push('/dashboard');
        return;
      }
      // Re-verify against MongoDB profile
      fetch('/api/freelancer/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile && !data.profile.isProfileComplete) {
            router.push('/freelancer/profile?setup=required');
          }
        })
        .catch(() => {});
    }
  }, [status, session, router]);

  const user = session?.user as any;
  const userEmail = user?.email?.toLowerCase();
  const userCategory = user?.category || 'dev';

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, fetchProjects]);

  // Aggregate all matching gigs across all projects
  const allAcceptedGigs: { project: ProjectProposal; pkg: WorkPackage }[] = [];
  let pendingInvitesCount = 0;

  projects.forEach((proj) => {
    proj.workPackages?.forEach((wp) => {
      const matchesUser =
        wp.assignedFreelancerEmail?.toLowerCase() === userEmail ||
        (!wp.assignedFreelancerEmail && wp.category === userCategory);

      if (matchesUser) {
        if (wp.inviteStatus === 'accepted') {
          allAcceptedGigs.push({ project: proj, pkg: wp });
        } else if (wp.inviteStatus === 'invited' || !wp.inviteStatus) {
          pendingInvitesCount++;
        }
      }
    });
  });

  // Metrics
  const totalGigsCount = allAcceptedGigs.length;
  const activeGigsCount = allAcceptedGigs.filter(
    (g) => g.pkg.status !== 'Completed' && g.pkg.status !== 'Cancelled' && g.project.status !== 'cancelled'
  ).length;
  const completedGigsCount = allAcceptedGigs.filter((g) => g.pkg.status === 'Completed').length;
  const totalContractEarnings = allAcceptedGigs.reduce((acc, g) => acc + (g.pkg.allocatedPrice || 0), 0);

  // Filtered Gigs
  const filteredGigs = allAcceptedGigs.filter((gig) => {
    const isCompleted = gig.pkg.status === 'Completed';
    const isActive =
      gig.pkg.status !== 'Completed' &&
      gig.pkg.status !== 'Cancelled' &&
      gig.project.status !== 'cancelled';

    if (statusFilter === 'active') return isActive;
    if (statusFilter === 'completed') return isCompleted;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              Freelancer Gigs Hub
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {totalGigsCount} Total Contract{totalGigsCount !== 1 ? 's' : ''}
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            My Client Projects & Gigs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select any project workspace to submit deliverables, track milestone progress, and collaborate with clients.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {pendingInvitesCount > 0 && (
            <Link
              href="/freelancer/invitations"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <span>Invitations</span>
              <span className="px-1.5 py-0.2 bg-white text-amber-600 rounded-full text-[10px] font-bold">
                {pendingInvitesCount}
              </span>
            </Link>
          )}

          <button
            onClick={fetchProjects}
            className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Workspaces</span>
          <div className="text-xl font-black text-cyan-600 dark:text-cyan-400">
            {activeGigsCount}
          </div>
          <span className="text-[11px] text-slate-400">In execution</span>
        </div>

        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Milestones</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {completedGigsCount}
          </div>
          <span className="text-[11px] text-slate-400">Accepted by clients</span>
        </div>

        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Contract Value</span>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${totalContractEarnings.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">Total Allocated Budget</span>
        </div>

        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Invites</span>
          <div className="text-xl font-black text-amber-500">
            {pendingInvitesCount}
          </div>
          <Link
            href="/freelancer/invitations"
            className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-bold inline-flex items-center gap-1"
          >
            <span>Review offers</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['all', 'active', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              statusFilter === tab
                ? 'bg-slate-900 dark:bg-[#32B6A5] text-white dark:text-[#102B2B] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#142F2E]'
            }`}
          >
            {tab === 'all' ? `All Gigs (${totalGigsCount})` : tab === 'active' ? `Active (${activeGigsCount})` : `Completed (${completedGigsCount})`}
          </button>
        ))}
      </div>

      {/* Gigs List */}
      {loading ? (
        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Synchronizing your client gigs from MongoDB Atlas...</span>
        </div>
      ) : filteredGigs.length === 0 ? (
        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No gigs match this filter
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {pendingInvitesCount > 0
                ? `You have ${pendingInvitesCount} pending client invitation(s) waiting for your review!`
                : 'Check back when clients select your profile for milestones.'}
            </p>
          </div>
          {pendingInvitesCount > 0 && (
            <Link
              href="/freelancer/invitations"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <span>View Client Invitations ({pendingInvitesCount})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredGigs.map(({ project: proj, pkg }) => {
            const pId = (proj as any)._id || proj.id;
            const isCompleted = pkg.status === 'Completed';
            const isProjectCancelled = proj.status === 'cancelled';
            const isRevision = pkg.status === 'Revision Requested';
            const hasDeliverable = Boolean(pkg.deliverableLink);

            return (
              <div
                key={`${pId}-${pkg.id}`}
                className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isProjectCancelled
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isRevision
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                        }`}
                      >
                        {isProjectCancelled
                          ? 'Project Cancelled'
                          : isCompleted
                          ? 'Completed'
                          : isRevision
                          ? 'Revision Requested'
                          : 'In Execution'}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {pkg.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Client: <strong className="text-slate-700 dark:text-slate-300">{proj.merchantName}</strong>
                      </span>
                    </div>

                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {pkg.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-2xl">
                      Project: {proj.projectName} &bull; {pkg.description}
                    </p>
                  </div>

                  {/* Open Workspace Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/freelancer/dashboard/${pId}?pkg=${pkg.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#168C80] hover:bg-[#126B64] dark:bg-[#32B6A5] dark:hover:bg-[#168C80] text-white dark:text-[#102B2B] dark:hover:text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Milestone Deliverables & Fee Bar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1.5">
                        Fee:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        ${pkg.allocatedPrice?.toLocaleString()}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1.5">
                        Turnaround:
                      </span>
                      <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                        {pkg.estimatedDays ? `~${pkg.estimatedDays} days` : 'Standard'}
                      </strong>
                    </div>

                    {hasDeliverable && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Deliverable submitted</span>
                      </span>
                    )}

                    {pkg.reviewSubmitted && (
                      <span className="text-amber-500 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{pkg.reviewRating}.0 / 5.0 Reviewed</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    {isCompleted
                      ? 'Milestone Completed & Verified'
                      : isProjectCancelled
                      ? 'Milestone Closed'
                      : 'Direct PayPal Milestone Payment'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
