'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Star,
  Award,
  ChevronLeft,
  XCircle,
  AlertTriangle,
  ChevronDown,
  X,
  Send,
} from 'lucide-react';
import { WorkPackage, ProjectProposal, IAiProgressSummary, IAiCounterofferAnalysis } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';

export default function MerchantProjectWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const { data: session, status } = useSession();

  const [project, setProject] = useState<ProjectProposal | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Progress Summary state
  const [progressSummary, setProgressSummary] = useState<IAiProgressSummary | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);

  // Revision modal state
  const [revisionModalOpen, setRevisionModalOpen] = useState<{
    projectId: string;
    packageId: string;
  } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');

  // Counteroffer review modal
  const [counterofferModal, setCounterofferModal] = useState<{
    pkg: WorkPackage;
    analysis: IAiCounterofferAnalysis | null;
    loading: boolean;
  } | null>(null);
  const [isDecidingCounter, setIsDecidingCounter] = useState<boolean>(false);

  // Review & Rating Modal state
  const [reviewModalPackage, setReviewModalPackage] = useState<{
    projectId: string;
    package: WorkPackage;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  // Cancel Project Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingProject, setCancellingProject] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  const fetchProgressSummary = useCallback(async (proj: ProjectProposal) => {
    setLoadingProgress(true);
    try {
      const res = await fetch('/api/ai/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: proj.projectName,
          tasks: proj.workPackages.map((wp) => ({
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

  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [projRes, allRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch('/api/projects'),
      ]);

      const projData = await projRes.json();
      const allData = await allRes.json();

      if (projData.success && projData.project) {
        setProject(projData.project);
        fetchProgressSummary(projData.project);
      } else {
        setError(projData.error || 'Project not found in database');
      }

      if (allData.success && Array.isArray(allData.projects)) {
        setAllProjects(allData.projects);
      }
    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchProgressSummary]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/dashboard/${projectId}`);
    } else if (status === 'authenticated') {
      const user = session?.user as any;
      if (user?.role === 'freelancer') {
        router.push('/freelancer/dashboard');
        return;
      }
      fetchProjectDetails();
    }
  }, [status, session, router, projectId, fetchProjectDetails]);

  const handleUpdateStatus = async (
    targetProjectId: string,
    packageId: string,
    newStatus: string,
    notes?: string
  ) => {
    try {
      const res = await fetch(`/api/projects/${targetProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          status: newStatus,
          deliverableNotes: notes,
        }),
      });
      if (res.ok) {
        fetchProjectDetails();
      }
    } catch (err) {
      console.error('Failed to update package status:', err);
    }
  };

  const handleCancelProject = async () => {
    if (!projectId || cancellingProject) return;
    setCancellingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCancelSuccessMsg('Project has been cancelled. Remaining escrow funds are released.');
        setCancelModalOpen(false);
        fetchProjectDetails();
      } else {
        alert(data.error || 'Failed to cancel project');
      }
    } catch (err: any) {
      console.error('Error cancelling project:', err);
      alert(err.message || 'Failed to cancel project');
    } finally {
      setCancellingProject(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalPackage || !reviewText.trim()) return;

    setSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: reviewModalPackage.projectId,
          packageId: reviewModalPackage.package.id,
          rating: reviewRating,
          reviewText: reviewText.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReviewSuccessMsg(`Review and ${reviewRating}-star rating saved to MongoDB! Milestone completed.`);
        setTimeout(() => setReviewSuccessMsg(null), 5000);
        setReviewModalPackage(null);
        setReviewText('');
        setReviewRating(5);
        fetchProjectDetails();
      } else {
        alert(data.error || 'Failed to submit review');
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      alert(err.message || 'Error submitting review');
    } finally {
      setSubmittingReview(false);
    }
  };

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
          project_budget_remaining: project?.savings || 0,
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
    if (!project || isDecidingCounter) return;
    setIsDecidingCounter(true);
    try {
      const res = await fetch('/api/quotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: (project as any)._id || project.id,
          packageId,
          decision,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCounterofferModal(null);
        fetchProjectDetails();
      } else {
        alert(data.error || 'Failed to process decision');
      }
    } catch (err) {
      console.error('Error deciding counteroffer:', err);
    } finally {
      setIsDecidingCounter(false);
    }
  };

  // AG Grid column definitions
  const columnDefs = useMemo<ColDef<WorkPackage>[]>(() => [
    {
      headerName: 'Milestone Title & Scope',
      field: 'title',
      width: 240,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp) return null;
        return (
          <div className="py-2">
            <div className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
              {wp.title}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {wp.description}
            </div>
            {wp.category && (
              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {wp.category}
              </span>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Assigned Specialist',
      field: 'assignedFreelancerName',
      width: 200,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp) return null;
        const name = wp.assignedFreelancerName || 'Specialist';
        const rating = wp.assignedFreelancerRating || 5.0;
        const count = wp.assignedFreelancerCompletedProjects || 0;
        const yrs = wp.assignedFreelancerYearsOfExperience || 3;
        const loc = wp.assignedFreelancerLocation || 'Remote';

        return (
          <div className="flex items-center gap-2 py-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {name}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="text-amber-500 font-semibold flex items-center">
                  ★ {rating.toFixed(1)} ({count})
                </span>
                <span>&bull;</span>
                <span>{yrs}y exp</span>
                <span>&bull;</span>
                <span className="truncate max-w-[50px]">{loc}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      headerName: 'Escrow Price',
      field: 'allocatedPrice',
      width: 120,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp) return null;
        return (
          <div className="py-2.5">
            <div className="font-bold text-xs text-slate-900 dark:text-white">
              ${wp.allocatedPrice?.toLocaleString()} USD
            </div>
            <div className="text-[10px] text-slate-400">
              {wp.estimatedDays ? `~${wp.estimatedDays} days` : 'Standard'}
            </div>
          </div>
        );
      },
    },
    {
      headerName: 'Status & Deliverable',
      field: 'status',
      width: 210,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp) return null;

        const isCompleted = wp.status === 'Completed';
        const isRevision = wp.status === 'Revision Requested';
        const isCancelled = wp.status === 'Cancelled' || project?.status === 'cancelled';
        const hasDeliverable = Boolean(wp.deliverableLink);
        const hasCounteroffer = wp.quotationStatus === 'counteroffer';

        return (
          <div className="py-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isCompleted
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : isRevision
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : isCancelled
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : isCancelled ? (
                  <XCircle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span>{isCancelled ? 'Cancelled' : wp.status}</span>
              </span>
            </div>

            {hasCounteroffer && (
              <button
                onClick={() => handleReviewCounteroffer(wp)}
                className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                ⚡ Counteroffer: ${wp.quotationAmount} USD ({wp.quotationDeliveryDays}d) &rarr; Review
              </button>
            )}

            {hasDeliverable && (
              <a
                href={wp.deliverableLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Inspect Deliverable</span>
              </a>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Actions',
      width: 220,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp || !projectId) return null;

        const isCompleted = wp.status === 'Completed';
        const isProjectCancelled = project?.status === 'cancelled';

        if (isProjectCancelled) {
          return (
            <div className="py-3 text-[11px] text-slate-400 italic">
              Project Cancelled
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1.5 py-2.5">
            {!isCompleted ? (
              <button
                onClick={async () => {
                  await handleUpdateStatus(projectId, wp.id, 'Completed');
                  setReviewModalPackage({ projectId, package: wp });
                }}
                className="px-3 py-1 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1"
                title="Approve deliverable and rate specialist"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Approve & Review</span>
              </button>
            ) : wp.reviewSubmitted ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-xl border border-amber-200 dark:border-amber-900/40">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{wp.reviewRating}/5 Reviewed</span>
              </span>
            ) : (
              <button
                onClick={() => setReviewModalPackage({ projectId, package: wp })}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-1 transition-all animate-pulse"
                title="Rate specialist and submit review"
              >
                <Star className="w-3 h-3 fill-white" />
                <span>Rate & Review</span>
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={() =>
                  setRevisionModalOpen({ projectId, packageId: wp.id })
                }
                className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Revision
              </button>
            )}
          </div>
        );
      },
    },
  ], [projectId, project?.status]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Loading project workspace from MongoDB Atlas...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Project Not Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {error || "Could not find the requested project. It may have been removed or you do not have permission to view it."}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to All Projects</span>
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = project.status === 'cancelled';
  const isCompleted = project.status === 'completed';
  const totalTasks = project.workPackages.length;
  const completedTasks = project.workPackages.filter((w) => w.status === 'Completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb Navigation & Project Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/dashboard"
            className="text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>All Projects</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
            {project.projectName}
          </span>
        </div>

        {/* Quick project switcher dropdown if merchant has multiple projects */}
        {allProjects.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Switch Project:</span>
            <select
              value={projectId}
              onChange={(e) => router.push(`/dashboard/${e.target.value}`)}
              className="text-xs font-semibold bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              {allProjects.map((p) => {
                const pid = (p as any)._id || p.id;
                return (
                  <option key={pid} value={pid}>
                    {p.projectName} {p.status === 'cancelled' ? '(Cancelled)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isCancelled
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : isCompleted
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
              }`}
            >
              {isCancelled ? 'Project Cancelled' : isCompleted ? 'Completed' : 'Funded & Active'}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {completedTasks}/{totalTasks} Milestones Complete ({progressPercent}%)
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {project.projectName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {project.merchantPrompt}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setChatOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Team Chat</span>
          </button>

          {!isCancelled && !isCompleted && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Cancel project and release escrow"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel Project</span>
            </button>
          )}

          <button
            onClick={fetchProjectDetails}
            className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh from MongoDB"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {cancelSuccessMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{cancelSuccessMsg}</span>
        </div>
      )}

      {reviewSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{reviewSuccessMsg}</span>
        </div>
      )}

      {isCancelled && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-xs text-rose-900 dark:text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <strong className="font-bold">Project Cancelled:</strong> This project was cancelled by the merchant. Milestones have been closed and remaining escrow funds released.
          </div>
        </div>
      )}

      {/* Escrow & Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Project Budget</span>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${project.totalBudget?.toLocaleString()} USD
          </div>
          <span className="text-[11px] text-slate-400">Initial client investment</span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated to Specialists</span>
          <div className="text-xl font-black text-cyan-600 dark:text-cyan-400">
            ${project.allocatedTotal?.toLocaleString()} USD
          </div>
          <span className="text-[11px] text-slate-400">Across {totalTasks} work packages</span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remaining Budget</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            ${project.savings?.toLocaleString() || 0} USD
          </div>
          <span className="text-[11px] text-slate-400">Retained reserve buffer</span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Escrow Security</span>
          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{isCancelled ? 'Escrow Released' : 'PayPal Escrow Active'}</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {isCancelled ? 'Project closed' : 'Funds release only upon your approval'}
          </span>
        </div>
      </div>

      {/* AI Dynamic Progress Summary */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Project Manager Status</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Progress: {completedTasks} of {totalTasks} milestones completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isCancelled ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {loadingProgress ? (
          <div className="py-2 text-xs text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" />
            <span>Evaluating project progress with Gemini AI...</span>
          </div>
        ) : progressSummary ? (
          <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
            <p className="leading-relaxed">{progressSummary.summary}</p>
            {progressSummary.blocked_tasks && progressSummary.blocked_tasks.length > 0 && (
              <div className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Attention: {progressSummary.blocked_tasks.join(', ')}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All milestones are actively coordinated across your specialist team.
          </p>
        )}
      </div>

      {/* AG Grid Milestones Table */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Milestone Work Packages & Specialist Contracts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect submitted deliverables, review work packages, and trigger escrow approval.
            </p>
          </div>
        </div>

        <div className="ag-theme-alpine w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <AgGridReact
            rowData={project.workPackages}
            columnDefs={columnDefs}
            rowHeight={70}
            headerHeight={44}
            defaultColDef={{
              sortable: true,
              resizable: true,
            }}
          />
        </div>
      </div>

      {/* Cancel Project Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Project?
                </h3>
                <p className="text-xs text-slate-400">
                  {project.projectName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              Are you sure you want to cancel this project? All active milestones will be marked as cancelled, hired specialists will be notified, and remaining escrow funds will be unlocked. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Keep Project
              </button>
              <button
                type="button"
                onClick={handleCancelProject}
                disabled={cancellingProject}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md"
              >
                {cancellingProject ? (
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

      {/* Review & Rating Modal */}
      {reviewModalPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Rate Specialist & Leave Review
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {reviewModalPackage.package.assignedFreelancerName || 'Specialist'} &bull; {reviewModalPackage.package.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalPackage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star Rating Picker */}
              <div className="space-y-1.5 text-center py-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Overall Rating (out of 5 stars)
                </label>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          star <= (hoverRating ?? reviewRating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 pt-0.5">
                  {reviewRating === 5 && 'Outstanding Delivery (5 / 5)'}
                  {reviewRating === 4 && 'Great Work (4 / 5)'}
                  {reviewRating === 3 && 'Good Delivery (3 / 5)'}
                  {reviewRating === 2 && 'Fair / Below Expectations (2 / 5)'}
                  {reviewRating === 1 && 'Needs Improvement (1 / 5)'}
                </div>
              </div>

              {/* Written Review */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Written Review (Will appear on specialist profile)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Share feedback on communication, quality of deliverables, technical execution, and speed..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full p-3.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewModalPackage(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview || !reviewText.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 shadow-md transition-all flex items-center gap-1.5"
                >
                  {submittingReview ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Review...</span>
                    </>
                  ) : (
                    <>
                      <Star className="w-3.5 h-3.5 fill-white" />
                      <span>Submit Review & Complete Milestone</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deliverable Revision Modal */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Request Deliverable Revision
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide actionable guidance for the specialist on changes required before final escrow approval.
            </p>
            <textarea
              rows={4}
              placeholder="e.g. Please update button hover states and ensure mobile breakpoint responsiveness..."
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                    'Revision Requested',
                    revisionNotes
                  );
                  setRevisionModalOpen(null);
                  setRevisionNotes('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md"
              >
                Send Revision Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Counteroffer Decision Modal */}
      {counterofferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  AI Counteroffer Evaluation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCounterofferModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 dark:text-white">
                  {counterofferModal.pkg.title}
                </span>
                <p className="text-slate-500 dark:text-slate-400">
                  Specialist requested: ${counterofferModal.pkg.quotationAmount} USD in {counterofferModal.pkg.quotationDeliveryDays} days.
                </p>
                {counterofferModal.pkg.quotationScope && (
                  <p className="italic text-slate-600 dark:text-slate-300">
                    &ldquo;{counterofferModal.pkg.quotationScope}&rdquo;
                  </p>
                )}
              </div>

              {counterofferModal.loading ? (
                <div className="py-6 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
                  <span>Evaluating impact with Gemini AI...</span>
                </div>
              ) : counterofferModal.analysis ? (
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded-xl space-y-2 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex justify-between font-bold text-cyan-900 dark:text-cyan-200">
                    <span>Budget Impact:</span>
                    <span>{counterofferModal.analysis.budget_impact}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {counterofferModal.analysis.recommendation}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDecidingCounter}
                onClick={() => handleCounterofferDecision(counterofferModal.pkg.id, 'decline')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                Decline Counteroffer
              </button>
              <button
                type="button"
                disabled={isDecidingCounter}
                onClick={() => handleCounterofferDecision(counterofferModal.pkg.id, 'accept')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors"
              >
                {isDecidingCounter ? 'Updating...' : 'Accept Counteroffer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Chat Modal */}
      {chatOpen && (
        <ProjectChatModal
          projectId={projectId}
          projectName={project.projectName}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
