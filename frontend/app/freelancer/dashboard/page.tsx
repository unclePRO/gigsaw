'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowRight,
  Star,
  Award,
  Search,
} from 'lucide-react';
import { WorkPackage, ProjectProposal } from '@/types';

export default function FreelancerDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filtered Gigs with search support
  const filteredGigs = allAcceptedGigs.filter((gig) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      gig.project.projectName?.toLowerCase().includes(query) ||
      gig.pkg.title?.toLowerCase().includes(query) ||
      gig.pkg.description?.toLowerCase().includes(query) ||
      gig.project.merchantName?.toLowerCase().includes(query) ||
      gig.pkg.category?.toLowerCase().includes(query);

    const isCompleted = gig.pkg.status === 'Completed';
    const isActive =
      gig.pkg.status !== 'Completed' &&
      gig.pkg.status !== 'Cancelled' &&
      gig.project.status !== 'cancelled';

    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'completed') return matchesSearch && isCompleted;
    return matchesSearch;
  });

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#168C80] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading freelancer dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'freelancer') {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Filter and Search Bar (matching merchant dashboard layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1B3B39] p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search gigs by project, task, or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab === 'all'
                ? `All (${totalGigsCount})`
                : tab === 'active'
                ? `Active (${activeGigsCount})`
                : `Completed (${completedGigsCount})`}
            </button>
          ))}

          {pendingInvitesCount > 0 && (
            <Link
              href="/freelancer/invitations"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Invites ({pendingInvitesCount})</span>
            </Link>
          )}

          <button
            onClick={fetchProjects}
            className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Gigs List & Dynamic Tiles */}
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
              {searchQuery ? 'No matching gigs found' : 'No active gigs yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search query or filter settings.'
                : pendingInvitesCount > 0
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {filteredGigs.map(({ project: proj, pkg }) => {
            const pId = (proj as any)._id || proj.id;
            const isCompleted = pkg.status === 'Completed';
            const isProjectCancelled = proj.status === 'cancelled';
            const isRevision = pkg.status === 'Revision Requested';
            const hasDeliverable = Boolean(pkg.deliverableLink);

            return (
              <div
                key={`${pId}-${pkg.id}`}
                onClick={() => router.push(`/freelancer/dashboard/${pId}?pkg=${pkg.id}`)}
                className="group bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 space-y-3 hover:border-[#168C80] dark:hover:border-[#32B6A5] hover:shadow-lg transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between"
              >
                {/* Top Meta Row: Status Pill, Category Badge & Allocated Fee */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                        ? 'Cancelled'
                        : isCompleted
                        ? 'Completed'
                        : isRevision
                        ? 'Revision'
                        : 'In Execution'}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {pkg.category}
                    </span>
                  </div>

                  {/* Milestone Fee */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-[#10413E] dark:text-[#F0FAF8]">
                      ${pkg.allocatedPrice?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Main Title Area: Project Title is Prominent (Interchanged!) */}
                <div className="space-y-1">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight line-clamp-1 group-hover:line-clamp-2 transition-all">
                    {proj.projectName}
                  </h2>

                  {/* Freelancer's Role / Task (Interchanged!) */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#168C80] dark:text-[#32B6A5] truncate">
                    <Briefcase className="w-3.5 h-3.5 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
                    <span className="truncate">{pkg.title}</span>
                  </div>

                  {/* Client Name */}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Client: <strong className="text-slate-700 dark:text-slate-300 font-medium">{proj.merchantName}</strong>
                  </p>
                </div>

                {/* Always-visible Compact Indicators */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-cyan-500" />
                    <span>{pkg.estimatedDays ? `~${pkg.estimatedDays} days` : 'Standard'}</span>
                  </span>

                  {hasDeliverable ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Deliverable submitted</span>
                    </span>
                  ) : pkg.reviewSubmitted ? (
                    <span className="text-amber-500 font-bold flex items-center gap-1 text-[10px]">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{pkg.reviewRating}.0 / 5.0</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Direct Escrow</span>
                  )}

                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#168C80] dark:group-hover:text-[#32B6A5] group-hover:translate-x-1 transition-all" />
                </div>

                {/* Dynamic Hover-Growing Drawer: Max Size on Hover */}
                <div className="max-h-0 opacity-0 group-hover:max-h-56 group-hover:opacity-100 transition-all duration-300 ease-out overflow-hidden">
                  <div className="pt-2.5 mt-1 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-2.5">
                    {pkg.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                        {pkg.description}
                      </p>
                    )}

                    {pkg.deliverables && pkg.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pkg.deliverables.slice(0, 2).map((del, dIdx) => (
                          <span
                            key={dIdx}
                            className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[220px]"
                          >
                            &bull; {del}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-1">
                      <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#168C80] hover:bg-[#126B64] dark:bg-[#32B6A5] dark:hover:bg-[#168C80] text-white dark:text-[#102B2B] dark:hover:text-white text-xs font-bold rounded-xl transition-all shadow-sm">
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
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
