'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  PlusCircle,
  FolderOpen,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  UserX,
  Sparkles,
  TrendingUp,
  Activity,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import { WorkPackage, ProjectProposal, IAiProgressSummary, IAiCounterofferAnalysis } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';

function isWaitingForTeam(project: any): boolean {
  if (!project.workPackages || project.workPackages.length === 0) return false;
  const hasInvited = project.workPackages.some(
    (wp: any) => wp.inviteStatus === 'invited' || !wp.inviteStatus
  );
  const hasAccepted = project.workPackages.some((wp: any) => wp.inviteStatus === 'accepted');
  return hasInvited && !hasAccepted;
}

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revisionModalOpen, setRevisionModalOpen] = useState<{
    projectId: string;
    packageId: string;
  } | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatProject, setActiveChatProject] = useState<{ id: string; name: string } | null>(null);

  // AI Project Intelligence & Counteroffer state
  const [progressSummary, setProgressSummary] = useState<IAiProgressSummary | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [counterofferModal, setCounterofferModal] = useState<{
    pkg: WorkPackage;
    analysis: IAiCounterofferAnalysis | null;
    loading: boolean;
  } | null>(null);
  const [isDecidingCounter, setIsDecidingCounter] = useState<boolean>(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
    } else if (status === 'authenticated' && (session?.user as any)?.role === 'freelancer') {
      router.push('/freelancer/dashboard');
    }
  }, [status, session, router]);

  const fetchProgressSummary = useCallback(async (project: ProjectProposal) => {
    setLoadingProgress(true);
    try {
      const res = await fetch('/api/ai/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: project.projectName,
          tasks: project.workPackages.map((wp) => ({
            work_package_id: wp.id,
            name: wp.title,
            status:
              wp.status === 'Completed'
                ? 'completed'
                : wp.status === 'In Progress'
                ? 'in_progress'
                : wp.status === 'Revision Requested'
                ? 'blocked'
                : 'not_started',
            blocker: wp.status === 'Revision Requested' ? 'Revision requested by merchant' : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.success && data.progress) {
        setProgressSummary(data.progress);
      }
    } catch (err) {
      console.warn('Failed to load AI progress summary:', err);
    } finally {
      setLoadingProgress(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
        if (data.projects.length > 0) {
          fetchProgressSummary(data.projects[0]);
        }
      } else {
        setProjects([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch projects from MongoDB:', err);
      setError(err.message || 'Failed to connect to MongoDB');
    } finally {
      setLoading(false);
    }
  }, [fetchProgressSummary]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, fetchProjects]);

  const handleReviewCounteroffer = async (wp: WorkPackage) => {
    setCounterofferModal({ pkg: wp, analysis: null, loading: true });
    try {
      const res = await fetch('/api/ai/counteroffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_quotation: {
            quotation_id: `quote-${wp.id}`,
            freelancer_id: wp.assignedFreelancerId || 'fl-1',
            work_package_id: wp.id,
            amount: wp.allocatedPrice,
            delivery_days: wp.estimatedDays || 7,
            scope: wp.description,
            status: 'pending',
          },
          proposed_amount: wp.quotationAmount || wp.allocatedPrice,
          proposed_delivery_days: wp.quotationDeliveryDays || wp.estimatedDays || 7,
          message: wp.quotationScope || 'Scope and deliverable schedule adjustments',
          project_budget_remaining: projects[0]?.savings || 0,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setCounterofferModal({ pkg: wp, analysis: data.analysis, loading: false });
      } else {
        setCounterofferModal({ pkg: wp, analysis: null, loading: false });
      }
    } catch (err) {
      console.error('Counteroffer analysis error:', err);
      setCounterofferModal({ pkg: wp, analysis: null, loading: false });
    }
  };

  const handleCounterofferDecision = async (packageId: string, decision: 'accept' | 'decline') => {
    const currentProj = projects[0];
    const projId = currentProj ? (currentProj as any)._id || currentProj.id : '';
    if (!projId) return;
    setIsDecidingCounter(true);
    try {
      const res = await fetch(`/api/invitations/${projId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: decision === 'accept' ? 'accept_counteroffer' : 'decline_counteroffer',
          packageId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCounterofferModal(null);
        fetchProjects();
      }
    } catch (err) {
      console.error('Decision error:', err);
    } finally {
      setIsDecidingCounter(false);
    }
  };

  const handleUpdateStatus = async (
    projectId: string,
    packageId: string,
    status: 'Completed' | 'Revision Requested'
  ) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, status }),
      });

      if (res.ok) {
        setProjects((prev) =>
          prev.map((proj) => {
            const id = (proj as any)._id || proj.id;
            if (id === projectId) {
              return {
                ...proj,
                workPackages: proj.workPackages.map((wp) =>
                  wp.id === packageId ? { ...wp, status } : wp
                ),
              };
            }
            return proj;
          })
        );
      }
    } catch (err) {
      console.error('Error updating milestone status in MongoDB:', err);
    }
  };

  const currentProject = projects[0] || null;
  const currentProjectId = currentProject ? (currentProject as any)._id || currentProject.id : '';

  const columnDefs = useMemo<ColDef<WorkPackage>[]>(() => [
    {
      field: 'category',
      headerName: 'Specialty',
      width: 140,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const cat = params.data?.category || 'dev';
        const role = params.data?.roleName;
        return (
          <div className="py-2.5">
            <span className="font-extrabold uppercase text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 inline-block">
              {cat}
            </span>
            {role && <div className="text-[10px] text-slate-400 truncate mt-0.5">{role}</div>}
          </div>
        );
      },
    },
    {
      field: 'title',
      headerName: 'Milestone Task',
      flex: 1.6,
      minWidth: 220,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        if (!params.data) return null;
        return (
          <div className="py-2.5">
            <div className="font-bold text-slate-900 dark:text-white leading-snug">{params.data.title}</div>
            <div className="text-[11px] text-slate-400 truncate">{params.data.description}</div>
          </div>
        );
      },
    },
    {
      field: 'assignedFreelancerName',
      headerName: 'Assigned Specialist',
      flex: 1.4,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const name = params.data?.assignedFreelancerName;
        const email = params.data?.assignedFreelancerEmail;
        if (!name) {
          return <span className="text-slate-400 text-xs py-3 block italic">Open Milestone</span>;
        }
        return (
          <div className="py-2.5">
            <div className="font-bold text-xs text-slate-900 dark:text-white">{name}</div>
            <div className="text-[11px] text-slate-400 truncate">{email}</div>
          </div>
        );
      },
    },
    {
      field: 'inviteStatus',
      headerName: 'Invite Status',
      width: 160,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (wp?.quotationStatus === 'counteroffer') {
          return (
            <button
              type="button"
              onClick={() => handleReviewCounteroffer(wp)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 my-2.5 hover:scale-105 transition-transform"
              title="Click to view AI Counteroffer Impact Analysis"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Counter: ${wp.quotationAmount}</span>
            </button>
          );
        }
        const inv = params.data?.inviteStatus || 'invited';
        if (inv === 'accepted') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 my-3">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Accepted</span>
            </span>
          );
        }
        if (inv === 'declined') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 my-3">
              <span>Declined</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 my-3">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Invite Sent</span>
          </span>
        );
      },
    },
    {
      field: 'allocatedPrice',
      headerName: 'Price ($)',
      width: 110,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => (
        <span className="font-bold text-slate-900 dark:text-white py-3 block">
          ${params.data?.allocatedPrice}
        </span>
      ),
    },
    {
      field: 'status',
      headerName: 'Milestone State',
      width: 140,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const status = params.data?.status || 'Pending';
        if (status === 'Completed') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Completed</span>
            </span>
          );
        }
        if (status === 'In Progress') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>In Progress</span>
            </span>
          );
        }
        if (status === 'Revision Requested') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Revision</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <span>Pending</span>
          </span>
        );
      },
    },
    {
      field: 'deliverableLink',
      headerName: 'Deliverable',
      width: 120,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const link = params.data?.deliverableLink;
        if (!link) return <span className="text-slate-400 text-xs py-3 block italic">None yet</span>;
        return (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline py-3"
          >
            <span>Review</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      },
    },
    {
      headerName: 'Actions',
      width: 180,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp || !currentProjectId) return null;
        const isCompleted = wp.status === 'Completed';

        return (
          <div className="flex items-center gap-1.5 py-2.5">
            <button
              onClick={() => handleUpdateStatus(currentProjectId, wp.id, 'Completed')}
              disabled={isCompleted}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                isCompleted
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {isCompleted ? 'Approved' : 'Approve'}
            </button>

            <button
              onClick={() =>
                setRevisionModalOpen({ projectId: currentProjectId, packageId: wp.id })
              }
              className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Revision
            </button>
          </div>
        );
      },
    },
  ], [currentProjectId]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              Merchant Management
            </span>
            <span className="text-xs font-semibold text-slate-400">
              AG Grid Powered
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Project Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track milestone delivery, inspect submitted links, communicate via team chat, and release escrow payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProjects}
            className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh from MongoDB"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-xl shadow-glow-cyan transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Launch New Project</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Synchronizing with MongoDB Atlas...</span>
        </div>
      ) : !currentProject ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No projects found in MongoDB Atlas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              You haven&apos;t launched any projects yet. Use the project studio to decompose your project and coordinate your specialist team.
            </p>
          </div>
          <Link
            href="/create"
            className="inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-xl shadow-glow-cyan transition-all"
          >
            Launch Your First Project
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Active Project Banner Card */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full">
                  Active Project
                </span>
                <span className="text-xs text-slate-400">Escrow Funded</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {currentProject.projectName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 max-w-xl">
                {currentProject.merchantPrompt}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={isWaitingForTeam(currentProject)}
                title={isWaitingForTeam(currentProject) ? 'Chat unlocks when a specialist accepts' : undefined}
                onClick={() => {
                  if (isWaitingForTeam(currentProject)) return;
                  setActiveChatProject({
                    id: currentProjectId,
                    name: currentProject.projectName,
                  });
                  setChatOpen(true);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all ${
                  isWaitingForTeam(currentProject)
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Team Chat Room</span>
              </button>

              <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Budget</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">${currentProject.totalBudget}</span>
              </div>
            </div>
          </div>

          {/* Specialist Counteroffer Alert Banner */}
          {currentProject.workPackages.some((w) => w.quotationStatus === 'counteroffer') && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <div className="font-bold text-amber-800 dark:text-amber-300">
                    Specialist Counteroffer Awaiting Review
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                    One or more specialists submitted revised pricing or turnaround estimates. Review AI budget impact analysis.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {currentProject.workPackages
                  .filter((w) => w.quotationStatus === 'counteroffer')
                  .map((wp) => (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => handleReviewCounteroffer(wp)}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>Analyze {wp.roleName || wp.title} (${wp.quotationAmount})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Executive AI Progress Monitor Card */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm transition-colors space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-500" />
                  <span>Executive AI Project Monitor</span>
                </span>
                {loadingProgress && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-500" />
                    <span>Evaluating tasks...</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Completion Rate:{' '}
                  <strong className="text-slate-900 dark:text-white font-black">
                    {progressSummary?.completion_percentage ??
                      Math.round(
                        (currentProject.workPackages.filter((w) => w.status === 'Completed').length /
                          currentProject.workPackages.length) *
                          100
                      )}
                    %
                  </strong>
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${
                    progressSummary?.completion_percentage ??
                    Math.round(
                      (currentProject.workPackages.filter((w) => w.status === 'Completed').length /
                        currentProject.workPackages.length) *
                        100
                    )
                  }%`,
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Summary */}
              <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AI Health Summary
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {progressSummary?.summary || 'All project tasks synchronized with live escrow milestones.'}
                </p>
              </div>

              {/* Recommended Actions */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recommended Next Step
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {progressSummary?.recommended_actions && progressSummary.recommended_actions.length > 0 ? (
                    <span className="flex items-start gap-1">
                      <span className="text-cyan-500 font-bold">•</span>
                      <span>{progressSummary.recommended_actions[0]}</span>
                    </span>
                  ) : (
                    <span>Awaiting deliverable submissions from active team members.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AG Grid Work Packages Table */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Project Milestones & Deliverable Tracking
                </h3>
                <p className="text-xs text-slate-400">
                  {currentProject.workPackages.length} Assembled Milestones
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {currentProject.workPackages.filter((w) => w.status === 'Completed').length} of{' '}
                {currentProject.workPackages.length} Completed
              </span>
            </div>

            <div className="ag-theme-alpine w-full h-[340px]">
              <AgGridReact<WorkPackage>
                rowData={currentProject.workPackages}
                columnDefs={columnDefs}
                rowHeight={64}
                animateRows={true}
              />
            </div>
          </div>

          {/* Waiting Room Banner */}
          {isWaitingForTeam(currentProject) && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">Waiting for Your Team to Accept</h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">Invitations have been sent. Specialists will respond shortly.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(currentProject as any).workPackages?.map((wp: any) => (
                  <div
                    key={wp.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${
                      wp.inviteStatus === 'accepted'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                        : wp.inviteStatus === 'declined'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      wp.inviteStatus === 'accepted' ? 'bg-emerald-500' :
                      wp.inviteStatus === 'declined' ? 'bg-rose-500' :
                      'bg-amber-400 animate-pulse'
                    }`} />
                    <span className="uppercase">{wp.category}</span>
                    <span className="font-normal opacity-70">
                      {wp.inviteStatus === 'accepted' ? '✓ Accepted' :
                       wp.inviteStatus === 'declined' ? '✗ Declined' :
                       '• Awaiting'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revision Modal */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-base">Request Revision from Specialist</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide feedback or specify required adjustments before approving this milestone:
            </p>

            <textarea
              rows={4}
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="e.g. Please update the color contrast on the mobile view and adjust typography..."
              className="w-full p-3.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevisionModalOpen(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleUpdateStatus(
                    revisionModalOpen.projectId,
                    revisionModalOpen.packageId,
                    'Revision Requested'
                  );
                  setRevisionModalOpen(null);
                  setRevisionFeedback('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm"
              >
                Send Revision Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Group Chat Modal */}
      {activeChatProject && (
        <ProjectChatModal
          projectId={activeChatProject.id}
          projectName={activeChatProject.name}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Counteroffer AI Impact Review Modal */}
      {counterofferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-500" />
                  <span>AI Negotiation Intelligence</span>
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Milestone Counteroffer Variance Analysis
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCounterofferModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                Milestone: {counterofferModal.pkg.title}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Specialist: {counterofferModal.pkg.assignedFreelancerName || 'Assigned Specialist'}
              </div>
            </div>

            {/* Comparison Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Original Offer</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  ${counterofferModal.pkg.allocatedPrice}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {counterofferModal.pkg.estimatedDays || 7} Days
                </span>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400 block">Proposed Counter</span>
                <span className="text-base font-black text-cyan-700 dark:text-cyan-300">
                  ${counterofferModal.pkg.quotationAmount || counterofferModal.pkg.allocatedPrice}
                </span>
                <span className="text-[10px] text-cyan-600/80 dark:text-cyan-400/80 block">
                  {counterofferModal.pkg.quotationDeliveryDays || counterofferModal.pkg.estimatedDays || 7} Days
                </span>
              </div>
            </div>

            {/* AI Analysis Details */}
            {counterofferModal.loading ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-500" />
                <span>Running algorithmic variance analysis...</span>
              </div>
            ) : counterofferModal.analysis ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Budget Impact:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      {counterofferModal.analysis.percentage_delta > 0 ? '+' : ''}
                      {counterofferModal.analysis.percentage_delta}% ({counterofferModal.analysis.amount_delta >= 0 ? '+' : ''}${counterofferModal.analysis.amount_delta})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {counterofferModal.analysis.budget_impact}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-xs">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>AI Recommendation</span>
                  </div>
                  <p className="text-[11px] text-emerald-900/90 dark:text-emerald-300/90 leading-relaxed">
                    {counterofferModal.analysis.recommendation}
                  </p>
                </div>

                {counterofferModal.pkg.quotationScope && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <strong className="text-slate-700 dark:text-slate-300">Specialist Note:</strong> {counterofferModal.pkg.quotationScope}
                  </div>
                )}
              </div>
            ) : null}

            {/* Decision Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDecidingCounter}
                onClick={() => handleCounterofferDecision(counterofferModal.pkg.id, 'decline')}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Decline Counteroffer
              </button>
              <button
                type="button"
                disabled={isDecidingCounter}
                onClick={() => handleCounterofferDecision(counterofferModal.pkg.id, 'accept')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isDecidingCounter ? (
                  <span>Updating Escrow...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept & Update Milestone</span>
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
