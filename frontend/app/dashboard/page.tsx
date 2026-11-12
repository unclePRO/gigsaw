'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Users,
} from 'lucide-react';
import { ProjectProposal } from '@/types';

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Cancel Project Modal state
  const [cancelModalProject, setCancelModalProject] = useState<ProjectProposal | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard&role=merchant');
    } else if (status === 'authenticated' && (session?.user as any)?.role === 'freelancer') {
      router.push('/freelancer/dashboard');
    }
  }, [status, session, router]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else {
        setProjects([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch projects from MongoDB:', err);
      setError(err.message || 'Failed to connect to MongoDB');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, fetchProjects]);

  const handleConfirmCancelProject = async () => {
    if (!cancelModalProject || cancelling) return;
    const targetId = (cancelModalProject as any)._id || cancelModalProject.id;
    setCancelling(true);
    try {
      const res = await fetch(`/api/projects/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccessMsg(`Project "${cancelModalProject.projectName}" cancelled. Project funds unlocked.`);
        setTimeout(() => setActionSuccessMsg(null), 5000);
        setCancelModalProject(null);
        fetchProjects();
      } else {
        alert(data.error || 'Failed to cancel project');
      }
    } catch (err: any) {
      console.error('Error cancelling project:', err);
      alert(err.message || 'Failed to cancel project');
    } finally {
      setCancelling(false);
    }
  };

  // Metrics
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter(
    (p) => p.status === 'funded' || p.status === 'draft' || !p.status
  ).length;
  const completedProjectsCount = projects.filter((p) => p.status === 'completed').length;
  const totalBudgetSpent = projects.reduce((sum, p) => sum + (p.totalBudget || 0), 0);

  // Filtered projects
  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.merchantPrompt?.toLowerCase().includes(searchQuery.toLowerCase());

    const isProjectActive =
      proj.status === 'funded' ||
      proj.status === 'FUNDED_IN_PROGRESS' ||
      proj.status === 'READY_TO_FUND' ||
      proj.status === 'ON_HOLD' ||
      proj.status === 'draft' ||
      !proj.status;
    const isProjectCompleted = proj.status === 'completed';
    const isProjectCancelled = proj.status === 'cancelled';

    if (statusFilter === 'active') return matchesSearch && isProjectActive;
    if (statusFilter === 'completed') return matchesSearch && isProjectCompleted;
    if (statusFilter === 'cancelled') return matchesSearch && isProjectCancelled;
    return matchesSearch;
  });

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#168C80] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading merchant dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'merchant') {
    return null;
  }



  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">

      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1B3B39] p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search projects by name or requirements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab === 'all' ? `All (${totalProjectsCount})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Synchronizing projects from MongoDB Atlas...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {searchQuery ? 'No matching projects found' : 'No projects launched yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search keywords or filter settings.'
                : 'Use the AI conversational studio to decompose your project and hire specialists in seconds.'}
            </p>
          </div>
          {!searchQuery && (
            <Link
              href="/create"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-xl shadow-glow-cyan transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Launch Your First Project</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProjects.map((proj) => {
            const pId = (proj as any)._id || proj.id;
            const isCancelled = proj.status === 'cancelled';
            const isCompleted = proj.status === 'completed';
            const totalPkgs = proj.workPackages?.length || 0;
            const completedPkgs = proj.workPackages?.filter((w) => w.status === 'Completed').length || 0;
            const progress = totalPkgs > 0 ? Math.round((completedPkgs / totalPkgs) * 100) : 0;

            // Collect unique team members
            const teamMap = new Map<string, { name: string; category: string }>();
            proj.workPackages?.forEach((wp) => {
              if (wp.assignedFreelancerName) {
                teamMap.set(wp.assignedFreelancerName, {
                  name: wp.assignedFreelancerName,
                  category: wp.category || 'Specialist',
                });
              }
            });
            const teamMembers = Array.from(teamMap.values());

            return (
              <div
                key={pId}
                className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
              >
                {/* Project Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isCancelled
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : proj.status === 'READY_TO_FUND'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : proj.status === 'ON_HOLD' || proj.status === 'draft' || !proj.status
                            ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-[#D8E9E4] dark:border-[#345451]'
                            : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                        }`}
                      >
                        {isCancelled
                          ? 'Cancelled'
                          : isCompleted
                          ? 'Completed'
                          : proj.status === 'READY_TO_FUND'
                          ? 'Ready to Fund'
                          : proj.status === 'ON_HOLD' || proj.status === 'draft' || !proj.status
                          ? 'Awaiting Team Acceptance'
                          : 'Funded'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Launched {proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : 'Recently'}
                      </span>
                    </div>

                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {proj.projectName}
                    </h2>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isCancelled && !isCompleted && (
                      <button
                        onClick={() => setCancelModalProject(proj)}
                        className="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Cancel project"
                      >
                        Cancel Project
                      </button>
                    )}
                    {proj.status === 'READY_TO_FUND' ? (
                      <Link
                        href={`/dashboard/${pId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                      >
                        <span>Pay &amp; Start Project</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/${pId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#168C80] hover:bg-[#126B64] dark:bg-[#32B6A5] dark:hover:bg-[#168C80] text-white dark:text-[#102B2B] dark:hover:text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Details */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">
                      Tasks: {completedPkgs} of {totalPkgs} completed
                    </span>
                    <span className="text-cyan-600 dark:text-cyan-400">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCancelled ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer Metrics Row */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {/* Team Avatars */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Team:</span>
                    {teamMembers.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">Assigning freelancers</span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {teamMembers.map((tm, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold"
                          >
                            <span>{tm.name}</span>
                            <span className="text-slate-400 uppercase text-[8px]">({tm.category})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Financials */}
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1.5">
                        Budget:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        ${proj.totalBudget?.toLocaleString()}
                      </strong>
                    </div>
                    {proj.savings ? (
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1.5">
                          Savings:
                        </span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                          +${proj.savings?.toLocaleString()}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Project Confirmation Modal */}
      {cancelModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1B3B39] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Project?
                </h3>
                <p className="text-xs text-slate-400">
                  {cancelModalProject.projectName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              Are you sure you want to cancel this project? All uncompleted tasks will be marked as Cancelled, assigned freelancers will be notified, and remaining project allocations will be refunded. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalProject(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Keep Project
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelProject}
                disabled={cancelling}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                {cancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Cancel Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
