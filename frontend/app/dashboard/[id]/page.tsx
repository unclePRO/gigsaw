'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
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
  ChevronRight,
  XCircle,
  AlertTriangle,
  ChevronDown,
  X,
  Send,
  Users,
  DollarSign,
  UserCheck,
  RotateCcw,
  FileText,
  Receipt,
  LayoutDashboard,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  HelpCircle,
  Briefcase,
  Check,
  Eye,
} from 'lucide-react';
import { WorkPackage, ProjectProposal, IAiProgressSummary, IAiCounterofferAnalysis } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';
import { EmbeddedProjectChat } from '@/components/chat/EmbeddedProjectChat';
import { CheckoutSection } from '@/components/dashboard/CheckoutSection';

export type DashboardTab = 'general' | 'members' | 'chat' | 'money';

export default function MerchantProjectWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const { data: session, status } = useSession();

  const [project, setProject] = useState<ProjectProposal | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab & Retractable Sidebar State
  const [activeTab, setActiveTab] = useState<DashboardTab>('general');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Specialist Swap State
  const [swappingPackageId, setSwappingPackageId] = useState<string | null>(null);
  const [swapFeedbackMsg, setSwapFeedbackMsg] = useState<string | null>(null);

  // AI Progress Summary state (for funded/active stage)
  const [progressSummary, setProgressSummary] = useState<IAiProgressSummary | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Standalone chat modal toggle (if merchant prefers pop-out modal)
  const [chatModalOpen, setChatModalOpen] = useState(false);

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

  // Specialist Deliverable Submission Inspection Modal
  const [selectedSubmissionPackage, setSelectedSubmissionPackage] = useState<WorkPackage | null>(null);

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

  // Official PayPal Invoicing state
  const [loadingInvoice, setLoadingInvoice] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const handleOpenOfficialInvoice = async (packageId?: string) => {
    if (!project) return;
    const key = packageId || 'project';
    setLoadingInvoice(key);
    setInvoiceError(null);
    try {
      const res = await fetch('/api/paypal/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: (project as any)._id || project.id,
          packageId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank', 'noopener,noreferrer');
      } else {
        setInvoiceError(data.error || 'Failed to generate official PayPal invoice.');
      }
    } catch (err: any) {
      setInvoiceError(err.message || 'Error communicating with PayPal Invoicing API.');
    } finally {
      setLoadingInvoice(null);
    }
  };

  const fetchProgressSummary = useCallback(async (proj: ProjectProposal) => {
    if (proj.status !== 'FUNDED_IN_PROGRESS' && proj.status !== 'funded') return;

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

  const initialFetchDone = useRef<string | null>(null);

  const fetchProjectDetails = useCallback(async (isInitial = false) => {
    if (!projectId) return;
    if (isInitial) setLoading(true);
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
        if (
          !progressSummary &&
          (projData.project.status === 'FUNDED_IN_PROGRESS' || projData.project.status === 'funded')
        ) {
          fetchProgressSummary(projData.project);
        }
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
      if (isInitial) setLoading(false);
    }
  }, [projectId, fetchProgressSummary, progressSummary]);

  // Auth & role check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/dashboard/${projectId}`);
    } else if (status === 'authenticated') {
      const user = session?.user as any;
      if (user?.role === 'freelancer') {
        router.push('/freelancer/dashboard');
      }
    }
  }, [status, session?.user, router, projectId]);

  // Initial data load: runs ONLY ONCE per projectId, avoiding periodic flickering/reloads
  useEffect(() => {
    if (status === 'authenticated' && projectId && initialFetchDone.current !== projectId) {
      initialFetchDone.current = projectId;
      fetchProjectDetails(true);
    }
  }, [status, projectId, fetchProjectDetails]);

  // Handler for "Find Someone Else" specialist swap
  const handleSwapSpecialist = async (wp: WorkPackage) => {
    if (!project) return;
    setSwappingPackageId(wp.id);
    setSwapFeedbackMsg(null);

    try {
      // 1. Request replacement specialist from AI matcher or MongoDB talent pool
      const swapRes = await fetch('/api/ai/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_package_id: wp.id,
          service_category: wp.category,
          required_skills: wp.requiredSkills || [],
          brief: wp.description,
          budget: wp.allocatedPrice,
          current_freelancer_id: wp.assignedFreelancerId,
          exclude_freelancer_ids: project.workPackages
            .map((w) => w.assignedFreelancerId)
            .filter(Boolean),
        }),
      });

      const swapData = await swapRes.json();
      if (!swapData.success || !swapData.freelancer) {
        alert(swapData.message || 'No alternative specialists found in this category at this time.');
        setSwappingPackageId(null);
        return;
      }

      // 2. Persist swapped specialist into MongoDB project document
      const updateRes = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'swap_freelancer',
          packageId: wp.id,
          newFreelancer: swapData.freelancer,
        }),
      });

      const updateData = await updateRes.json();
      if (updateData.success && updateData.project) {
        setProject(updateData.project);
        setSwapFeedbackMsg(
          `Replaced ${wp.assignedFreelancerName || 'specialist'} with ${swapData.freelancer.name}. An invitation has been dispatched!`
        );
        setTimeout(() => setSwapFeedbackMsg(null), 6000);
      } else {
        fetchProjectDetails();
      }
    } catch (err: any) {
      console.error('Failed to swap specialist:', err);
      alert(err.message || 'Error finding replacement specialist');
    } finally {
      setSwappingPackageId(null);
    }
  };

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
        setCancelSuccessMsg('Project has been cancelled. Remaining project allocations are refunded.');
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

  // Role badge helper for milestone deliverables table
  const getRoleBadge = (category: string = '', roleName?: string) => {
    const cat = (category || '').toLowerCase();
    let label = 'Specialist';
    let color = 'bg-[#168C80]/15 text-[#168C80] dark:text-[#73D8C7] border-[#168C80]/30';

    if (cat.includes('dev') || cat.includes('code') || cat.includes('eng') || cat.includes('tech') || cat.includes('full-stack') || cat.includes('frontend') || cat.includes('backend')) {
      label = 'Developer';
      color = 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
    } else if (cat.includes('design') || cat.includes('ui') || cat.includes('ux') || cat.includes('art') || cat.includes('brand') || cat.includes('graphic')) {
      label = 'Designer';
      color = 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
    } else if (cat.includes('market') || cat.includes('growth') || cat.includes('seo') || cat.includes('content') || cat.includes('social') || cat.includes('sales')) {
      label = 'Marketer';
      color = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    } else if (roleName) {
      label = roleName;
    } else if (category) {
      label = category.charAt(0).toUpperCase() + category.slice(1);
    }

    return { label, color };
  };

  // Derived state calculations
  const totalTasks = project?.workPackages?.length || 0;
  const completedTasks = project?.workPackages?.filter((w) => w.status === 'Completed').length || 0;
  const acceptedTasks = project?.workPackages?.filter((w) => w.inviteStatus === 'accepted').length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isCancelled = project?.status === 'cancelled';
  const isCompleted = project?.status === 'completed' || (totalTasks > 0 && completedTasks === totalTasks);
  const isFundedOrActive = project?.status === 'FUNDED_IN_PROGRESS' || project?.status === 'funded';
  const isReadyToFund = !isFundedOrActive && !isCancelled && !isCompleted && totalTasks > 0 && acceptedTasks === totalTasks;
  const isOnHold = !isFundedOrActive && !isReadyToFund && !isCancelled && !isCompleted;

  // Counteroffers count
  const pendingCounteroffers = useMemo(() => {
    if (!project?.workPackages) return [];
    return project.workPackages.filter(
      (wp) => wp.quotationStatus === 'pending' || (wp.quotationAmount && wp.quotationAmount !== wp.allocatedPrice)
    );
  }, [project?.workPackages]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 dark:bg-[#1B3B39] rounded-2xl animate-pulse" />
        <div className="h-96 bg-slate-100 dark:bg-[#1B3B39] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Project Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'Unable to locate this project.'}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold rounded-xl"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-900 dark:text-slate-100">
      {/* ============================================================== */}
      {/* RETRACTABLE SIDEBAR (Merchant Workspace Navigation)             */}
      {/* ============================================================== */}
      <aside
        className={`bg-white dark:bg-[#142F2E] border-r border-[#D8E9E4] dark:border-[#345451] transition-all duration-300 flex flex-col shrink-0 z-20 ${
          isSidebarCollapsed ? 'w-16 md:w-20' : 'w-64 md:w-72'
        }`}
      >
        {/* Sidebar Header: Project Brand & Collapse Toggle */}
        <div className="p-4 border-b border-[#D8E9E4] dark:border-[#345451] flex items-center justify-between gap-2">
          {!isSidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#168C80] dark:text-[#73D8C7] block truncate">
                Project Workspace
              </span>
              <h2 className="text-xs font-black text-[#10413E] dark:text-[#F0FAF8] truncate" title={project.projectName}>
                {project.projectName}
              </h2>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg border border-[#D8E9E4] dark:border-[#345451] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-auto cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Retract sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-[#168C80] dark:text-[#73D8C7]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>

        {/* Sidebar Navigation Tabs */}
        <nav className="p-3 space-y-1.5 flex-1">
          {/* TAB 1: GENERAL */}
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'general'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="General Overview & Basic Details"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">General</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/20 text-slate-500 dark:text-slate-400">
                  {progressPercent}%
                </span>
              </div>
            )}
          </button>

          {/* TAB 2: MEMBERS */}
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
              activeTab === 'members'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="Members, Invites & Counteroffers"
          >
            <Users className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Members</span>
                <div className="flex items-center gap-1">
                  {pendingCounteroffers.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white" title="Counteroffers pending review">
                      {pendingCounteroffers.length} Offer
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {acceptedTasks}/{totalTasks}
                  </span>
                </div>
              </div>
            )}
            {isSidebarCollapsed && pendingCounteroffers.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {/* TAB 3: CHAT */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
              activeTab === 'chat'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="Dedicated Team Chat"
          >
            <MessageSquare className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Team Chat</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Live room" />
              </div>
            )}
          </button>

          {/* TAB 4: PAYMENT */}
          <button
            type="button"
            onClick={() => setActiveTab('money')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
              activeTab === 'money'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="Payment, PayPal & Invoices"
          >
            <DollarSign className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Payment</span>
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isFundedOrActive
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : isReadyToFund
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isFundedOrActive ? 'Paid via PayPal' : isReadyToFund ? 'Ready to Fund' : 'Awaiting Acceptance'}
                </span>
              </div>
            )}
          </button>
        </nav>

        {/* Sidebar Footer: Back to Projects List */}
        <div className="p-3 border-t border-[#D8E9E4] dark:border-[#345451] space-y-2">
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to all projects"
          >
            <ChevronLeft className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && <span className="truncate">All Projects</span>}
          </Link>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN WORKSPACE CONTENT AREA                                     */}
      {/* ============================================================== */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
        {/* Workspace Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8E9E4] dark:border-[#345451]">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${
                  isCancelled
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : isCompleted
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : isReadyToFund
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : isOnHold
                    ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-[#D8E9E4] dark:border-[#345451]'
                    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                }`}
              >
                {isCancelled
                  ? 'Cancelled'
                  : isCompleted
                  ? 'Completed'
                  : isReadyToFund
                  ? 'Ready to Fund'
                  : isOnHold
                  ? 'Awaiting Team Acceptance'
                  : 'Funded'}
              </span>

              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isOnHold || isReadyToFund
                  ? `${acceptedTasks}/${totalTasks} Freelancers Accepted`
                  : `${completedTasks}/${totalTasks} Tasks Complete (${progressPercent}%)`}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#10413E] dark:text-[#F0FAF8] tracking-tight truncate">
              {project.projectName}
            </h1>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-xl px-3.5 py-1.5 text-right shadow-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Budget
              </span>
              <span className="text-xs font-black text-[#10413E] dark:text-[#F0FAF8]">
                ${project.totalBudget?.toLocaleString()}
              </span>
            </div>

            {!isCancelled && !isCompleted && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold rounded-xl transition-all cursor-pointer"
                title="Cancel project and close budget"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchProjectDetails(false)}
              className="p-2 border border-[#D8E9E4] dark:border-[#345451] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh from MongoDB"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {swapFeedbackMsg && (
          <div className="p-4 bg-[#E5F5F1] dark:bg-[#254542] border border-[#168C80]/30 rounded-2xl text-xs font-semibold text-[#168C80] dark:text-[#73D8C7] flex items-center gap-2 animate-fadeIn">
            <RotateCcw className="w-4 h-4 text-[#168C80] shrink-0" />
            <span>{swapFeedbackMsg}</span>
          </div>
        )}

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

        {/* ============================================================== */}
        {/* TAB 1: GENERAL OVERVIEW                                        */}
        {/* ============================================================== */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Project State Banner depending on accepted count */}
            {isOnHold && (
              <div className="p-5 bg-gradient-to-r from-[#168C80]/15 via-[#32B6A5]/10 to-[#73D8C7]/10 border border-[#168C80]/30 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5 font-bold text-sm text-[#10413E] dark:text-[#F0FAF8]">
                    <Clock className="w-4 h-4 text-[#168C80] dark:text-[#32B6A5]" />
                    <span>Project On Hold &bull; Awaiting Freelancer Confirmations ({acceptedTasks}/{totalTasks} Accepted)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>View Team & Invites</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                  Your project is on hold until all {totalTasks} assigned freelancers accept their invitations. You can discuss details directly in the <strong>Team Chat</strong> tab. If someone declines or is delayed, visit the <strong>Members</strong> tab to replace them with another talent.
                </p>
              </div>
            )}

            {isReadyToFund && (
              <div className="p-5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>All Freelancers Confirmed &bull; Ready to Fund</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('money')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Proceed to Payment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                  Every freelancer has accepted their quote. Complete payment via PayPal Multi-Seller Checkout in the <strong>Payment</strong> tab to fund the project and begin development.
                </p>
              </div>
            )}

            {isFundedOrActive && (
              <div className="p-5 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-teal-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-between gap-4 flex-wrap shadow-xs">
                <div className="flex items-center gap-2.5 font-bold text-sm text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Project Active &bull; Paid via PayPal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('money')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#168C80] dark:text-[#73D8C7] hover:underline cursor-pointer"
                >
                  <span>View Payment Details & Invoices</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Project Budget</span>
                <div className="text-xl font-black text-[#10413E] dark:text-[#F0FAF8]">
                  ${project.totalBudget?.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400">Total approved investment</span>
              </div>

              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated to Freelancers</span>
                <div className="text-xl font-black text-[#168C80] dark:text-[#73D8C7]">
                  ${project.allocatedTotal?.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400">Across {totalTasks} milestones</span>
              </div>

              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retained Buffer</span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  ${project.savings?.toLocaleString() || 0}
                </div>
                <span className="text-[11px] text-slate-400">Retained reserve buffer</span>
              </div>

              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Protection</span>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{isFundedOrActive ? 'Paid via PayPal' : 'Awaiting Payment'}</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {isFundedOrActive ? 'Paid with PayPal Buyer Protection' : 'Instant multi-seller checkout'}
                </span>
              </div>
            </div>

            {/* AI Dynamic Progress Summary */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#168C80] dark:text-[#32B6A5]" />
                  <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">AI Project Manager Status</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {completedTasks} of {totalTasks} milestones completed ({progressPercent}%)
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isCancelled ? 'bg-rose-500' : 'bg-gradient-to-r from-[#168C80] to-[#73D8C7]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {loadingProgress ? (
                <div className="py-2 text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#168C80]" />
                  <span>Evaluating project progress with Gemini AI...</span>
                </div>
              ) : progressSummary ? (
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-[#F0F8F6] dark:bg-[#102B2B] p-4 rounded-xl border border-[#D8E9E4] dark:border-[#345451] space-y-2">
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
                  {isOnHold
                    ? 'All work packages are pending acceptance from the selected team.'
                    : 'Milestone execution is actively tracked across your assembled team.'}
                </p>
              )}
            </div>

            {/* Milestones & Deliverables Overview */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#10413E] dark:text-[#F0FAF8]">
                    Milestone Deliverables & Scope ({totalTasks})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review assigned tasks, inspect submitted deliverables, and mark complete.
                  </p>
                </div>
              </div>

              {/* Dynamic Responsive Deliverables Table */}
              {project.workPackages && project.workPackages.length > 0 ? (
                <div className="w-full overflow-hidden rounded-xl border border-[#D8E9E4] dark:border-[#345451] bg-white dark:bg-[#1B3B39]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#D8E9E4] dark:border-[#345451] bg-[#F0F8F6] dark:bg-[#142F2E]">
                          <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#10413E] dark:text-[#A3C5BF] w-[30%]">
                            Role
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#10413E] dark:text-[#A3C5BF] w-[20%]">
                            Status
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#10413E] dark:text-[#A3C5BF] w-[22%]">
                            Submission
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#10413E] dark:text-[#A3C5BF] w-[28%]">
                            Merchant Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8E9E4]/60 dark:divide-[#345451]/60">
                        {project.workPackages.map((wp) => {
                          const roleInfo = getRoleBadge(wp.category, wp.roleName);
                          const hasSubmission = Boolean(
                            (wp.deliverableLink && wp.deliverableLink.trim().length > 0) ||
                            (wp.deliverableNotes && wp.deliverableNotes.trim().length > 0) ||
                            wp.closureRequested ||
                            wp.status === 'Completed'
                          );

                          const colorMap: Record<string, { bg: string; dot: string }> = {
                            'Completed': {
                              bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                              dot: 'bg-emerald-500',
                            },
                            'In Review': {
                              bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
                              dot: 'bg-purple-500',
                            },
                            'In Progress': {
                              bg: 'bg-[#168C80]/15 text-[#168C80] dark:text-[#73D8C7] border-[#168C80]/30',
                              dot: 'bg-[#168C80] dark:bg-[#73D8C7]',
                            },
                            'Revision Requested': {
                              bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                              dot: 'bg-amber-500',
                            },
                            'Pending': {
                              bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
                              dot: 'bg-slate-400',
                            },
                          };
                          const currentStatusStyle = colorMap[wp.status] || colorMap['Pending'];

                          return (
                            <tr
                              key={wp.id}
                              className="hover:bg-[#F0F8F6]/40 dark:hover:bg-[#142F2E]/40 transition-colors"
                            >
                              {/* 1. ROLE */}
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#168C80] to-[#32B6A5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    {(wp.assignedFreelancerName || 'S').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${roleInfo.color}`}>
                                        {roleInfo.label}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                                      {wp.assignedFreelancerName || 'Assigned Freelancer'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. STATUS */}
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${currentStatusStyle.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusStyle.dot}`} />
                                  {wp.status}
                                </span>
                              </td>

                              {/* 3. SUBMISSION */}
                              <td className="px-5 py-3.5">
                                {hasSubmission ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSubmissionPackage(wp)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#168C80] dark:text-[#73D8C7] bg-[#E5F5F1] dark:bg-[#254542] hover:bg-[#168C80] hover:text-white dark:hover:bg-[#168C80] dark:hover:text-white border border-[#168C80]/30 transition-all cursor-pointer shadow-2xs group"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#168C80] dark:text-[#73D8C7] group-hover:text-white transition-colors" />
                                    <span>View Submission</span>
                                  </button>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 cursor-not-allowed select-none opacity-80"
                                    title="Freelancer has not submitted deliverables yet"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>No submission</span>
                                  </span>
                                )}
                              </td>

                              {/* 4. MERCHANT ACTIONS */}
                              <td className="px-5 py-3.5">
                                {wp.status === 'Completed' ? (
                                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Approved</span>
                                    {wp.reviewRating && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-black text-[11px] border border-amber-500/20 ml-1">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        {wp.reviewRating}
                                      </span>
                                    )}
                                  </div>
                                ) : !isFundedOrActive ? (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Awaiting payment</span>
                                  </div>
                                ) : hasSubmission ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setReviewModalPackage({ projectId, package: wp })}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Approve &amp; Rate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRevisionModalOpen({ projectId, packageId: wp.id })}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Request Revision</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Awaiting submission</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  No milestones configured for this project.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MEMBERS & INVITATIONS & COUNTEROFFERS                   */}
        {/* ============================================================== */}
        {activeTab === 'members' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[#10413E] dark:text-[#F0FAF8]">
                  Team &amp; Invitation Status
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track confirmation from each freelancer. If someone declines or asks for scope adjustment, review counteroffers or replace them.
                </p>
              </div>
              <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border border-[#D8E9E4] dark:border-[#345451] self-start sm:self-auto">
                {acceptedTasks} of {totalTasks} Confirmed
              </div>
            </div>

            {/* Counteroffers Section (if any specialist proposed adjustments) */}
            {pendingCounteroffers.length > 0 && (
              <div className="p-5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Freelancer Counteroffer Received ({pendingCounteroffers.length})</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  One or more freelancers proposed adjustments to their scope, timeline, or quote. Review AI analysis and decide:
                </p>

                <div className="space-y-2 pt-1">
                  {pendingCounteroffers.map((wp) => (
                    <div
                      key={wp.id}
                      className="p-3 bg-white dark:bg-[#1B3B39] rounded-xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                          {wp.assignedFreelancerName} &bull; {wp.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Proposed quote: <strong className="text-amber-600 dark:text-amber-400">${wp.quotationAmount || wp.allocatedPrice}</strong> (Original: ${wp.allocatedPrice}) &bull; {wp.quotationDeliveryDays || wp.estimatedDays || 7} Days
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReviewCounteroffer(wp)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          Review with AI Analysis
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialists Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {project.workPackages.map((wp) => {
                const isAccepted = wp.inviteStatus === 'accepted';
                const isDeclined = wp.inviteStatus === 'declined';
                const isSwapping = swappingPackageId === wp.id;

                return (
                  <div
                    key={wp.id}
                    className={`p-5 rounded-2xl border transition-all space-y-4 ${
                      isAccepted
                        ? 'bg-white dark:bg-[#1B3B39] border-emerald-500/30 shadow-xs'
                        : isDeclined
                        ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/30'
                        : 'bg-white dark:bg-[#1B3B39] border-[#D8E9E4] dark:border-[#345451] shadow-xs'
                    }`}
                  >
                    {/* Top Row: Milestone Category & Budget */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#168C80]/10 text-[#168C80] dark:text-[#73D8C7] border border-[#168C80]/20">
                          {wp.category}
                        </span>
                        <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8] truncate">
                          {wp.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {wp.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-[#10413E] dark:text-[#F0FAF8]">
                          ${wp.allocatedPrice?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Specialist Profile Details */}
                    <div className="pt-3 border-t border-[#D8E9E4] dark:border-[#345451] flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#168C80] to-[#32B6A5] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                          {(wp.assignedFreelancerName || 'S').charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                            {wp.assignedFreelancerName || 'Assigned Freelancer'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {wp.assignedFreelancerEmail || 'Talent'} &bull; {wp.assignedFreelancerRating ? `★ ${wp.assignedFreelancerRating.toFixed(1)}` : 'Verified Pro'}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold border ${
                          isAccepted
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : isDeclined
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isAccepted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : isDeclined ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span>{isAccepted ? 'Invitation Accepted' : isDeclined ? 'Declined' : 'Invite Pending'}</span>
                      </span>
                    </div>

                    {/* Action Bar: Swap Specialist & Chat */}
                    <div className="pt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('chat')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D8E9E4] dark:border-[#345451] text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#168C80] dark:text-[#73D8C7]" />
                        <span>Chat with Freelancer</span>
                      </button>

                      {/* Find Someone Else Button */}
                      <button
                        type="button"
                        disabled={isSwapping}
                        onClick={() => handleSwapSpecialist(wp)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isDeclined
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                        title="Replace this freelancer with another talent"
                      >
                        {isSwapping ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#168C80]" />
                            <span>Swapping...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isDeclined ? 'Find Alternative' : 'Find Someone Else'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DEDICATED TEAM CHAT                                     */}
        {/* ============================================================== */}
        {activeTab === 'chat' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[#10413E] dark:text-[#F0FAF8]">
                  Team Project Chat
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Collaborate in real time with all team members and Gigsaw AI Assistant.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Live Team Room</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] overflow-hidden shadow-xs">
              <EmbeddedProjectChat
                projectId={projectId}
                projectName={project.projectName}
                className="h-[620px] border-none"
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: PAYMENT, PAYPAL & INVOICES                              */}
        {/* ============================================================== */}
        {activeTab === 'money' && (
          <div className="space-y-6 animate-fadeIn">
            {/* If ready to fund: show single checkout */}
            {isReadyToFund && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>All {totalTasks} freelancers have accepted their quotes. Complete payment to start!</span>
                  </div>
                </div>

                <CheckoutSection
                  project={project}
                  onPaymentSuccess={() => {
                    fetchProjectDetails();
                  }}
                />
              </div>
            )}

            {/* If on hold: explain funding unlocks when all accept */}
            {isOnHold && (
              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 text-sm font-black text-[#10413E] dark:text-[#F0FAF8]">
                  <CreditCard className="w-4 h-4 text-[#168C80] dark:text-[#32B6A5]" />
                  <span>PayPal Multi-Seller Checkout &bull; Awaiting Acceptance</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  To protect your budget, Gigsaw does not initiate payment until every freelancer on your team accepts their invitation. Once {totalTasks} of {totalTasks} accept, you will complete checkout for ${project.totalBudget?.toLocaleString()}.
                </p>

                {/* Shopping Cart Summary */}
                <div className="p-4 rounded-xl bg-[#F0F8F6] dark:bg-[#102B2B] border border-[#D8E9E4] dark:border-[#345451] space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#10413E] dark:text-[#F0FAF8]">
                    Budget Distribution
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {project.workPackages.map((wp, i) => (
                      <div key={wp.id || i} className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>{wp.title} ({wp.assignedFreelancerName || 'Freelancer'})</span>
                        <span className="font-bold text-[#10413E] dark:text-[#F0FAF8]">${wp.allocatedPrice}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-[#D8E9E4] dark:border-[#345451] flex justify-between items-center font-black text-sm text-[#10413E] dark:text-[#F0FAF8]">
                      <span>Total Project Budget</span>
                      <span>${project.totalBudget?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <span>Review Team Invitations</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Official PayPal Invoicing Banner (when funded / active) */}
            {(isFundedOrActive || isCompleted) && (
              <div className="bg-gradient-to-r from-[#168C80]/15 via-[#32B6A5]/10 to-[#73D8C7]/10 border border-[#168C80]/30 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#168C80]/20 text-[#168C80] dark:text-[#73D8C7] border border-[#168C80]/30 rounded-full flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-[#168C80] dark:text-[#73D8C7]" />
                        Official PayPal Invoicing REST API v2
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full">
                        Status: PAID
                      </span>
                    </div>
                    <h3 className="text-base font-black text-[#10413E] dark:text-[#F0FAF8]">
                      PayPal Multi-Seller Payment &amp; Invoices
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      Captured via PayPal Orders v2. Payments are disbursed directly to each freelancer upon deliverable completion and approval. View the official PayPal-hosted invoice with itemized line items below.
                    </p>
                    {project.paypalOrderId && (
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                        PayPal Order ID: <span className="font-bold text-[#168C80] dark:text-[#73D8C7]">{project.paypalOrderId}</span>
                      </div>
                    )}
                    {invoiceError && (
                      <div className="text-xs text-rose-500 font-medium pt-1">
                        {invoiceError}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenOfficialInvoice()}
                      disabled={loadingInvoice === 'project'}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#168C80] hover:bg-[#10766D] transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {loadingInvoice === 'project' ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating Invoice...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          <span>View Official PayPal Invoice</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Itemized Milestones Payment Breakdown */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                Itemized Milestone Payment Breakdown
              </h3>

              <div className="divide-y divide-[#D8E9E4] dark:divide-[#345451]">
                {project.workPackages.map((wp) => (
                  <div key={wp.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#168C80]/10 text-[#168C80] dark:text-[#73D8C7]">
                          {wp.category}
                        </span>
                        <span className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8] truncate">{wp.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Freelancer: <strong>{wp.assignedFreelancerName || 'Freelancer'}</strong> ({wp.assignedFreelancerEmail})
                      </p>
                      {wp.paypalCaptureId && (
                        <p className="text-[10px] font-mono text-slate-400">
                          PayPal Capture Ref: {wp.paypalCaptureId}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-black text-[#10413E] dark:text-[#F0FAF8]">
                          ${wp.allocatedPrice?.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {isFundedOrActive ? 'Paid' : 'Pending'}
                        </span>
                      </div>

                      {isFundedOrActive && (
                        <button
                          type="button"
                          onClick={() => handleOpenOfficialInvoice(wp.id)}
                          disabled={loadingInvoice === wp.id}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#E5F5F1] dark:bg-[#254542] hover:bg-[#D8E9E4] dark:hover:bg-[#1B3B39] text-[#168C80] dark:text-[#73D8C7] border border-[#D8E9E4] dark:border-[#345451] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Generate individual milestone invoice"
                        >
                          {loadingInvoice === wp.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-[#168C80]" />
                          ) : (
                            <FileText className="w-3 h-3 text-[#168C80]" />
                          )}
                          <span>Invoice</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODALS                                                         */}
      {/* ============================================================== */}

      {/* 1. Revision Notes Modal */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1B3B39] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Request Deliverable Revision</span>
              </div>
              <button
                onClick={() => {
                  setRevisionModalOpen(null);
                  setRevisionNotes('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Provide constructive feedback to the freelancer. The milestone will be marked as <strong>Revision Requested</strong> for the freelancer to address.
            </p>

            <textarea
              rows={4}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Detail the specific corrections, missing components, or adjustments required..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRevisionModalOpen(null);
                  setRevisionNotes('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!revisionNotes.trim()}
                onClick={() => {
                  handleUpdateStatus(
                    revisionModalOpen.projectId,
                    revisionModalOpen.packageId,
                    'Revision Requested',
                    revisionNotes.trim()
                  );
                  setRevisionModalOpen(null);
                  setRevisionNotes('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Review Counteroffer Modal */}
      {counterofferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D8E9E4] dark:border-[#345451] pb-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Specialist Counteroffer &bull; AI Analysis</span>
              </div>
              <button
                onClick={() => setCounterofferModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Milestone</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {counterofferModal.pkg.title} ({counterofferModal.pkg.assignedFreelancerName})
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Original Quote</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${counterofferModal.pkg.allocatedPrice} &bull; {counterofferModal.pkg.estimatedDays || 7} days
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Specialist Counteroffer</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">
                    ${counterofferModal.pkg.quotationAmount || counterofferModal.pkg.allocatedPrice} &bull; {counterofferModal.pkg.quotationDeliveryDays || 7} days
                  </span>
                </div>
              </div>

              {counterofferModal.loading ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
                  <span>Evaluating quotation with Gemini AI...</span>
                </div>
              ) : counterofferModal.analysis ? (
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs space-y-2 text-cyan-900 dark:text-cyan-200">
                  <div className="font-bold flex items-center justify-between">
                    <span>AI Recommendation: {counterofferModal.analysis.recommendation?.toUpperCase()}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20">
                      Budget Impact: {counterofferModal.analysis.budget_impact || 'Moderate'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {counterofferModal.analysis.recommendation} (Budget Delta: ${counterofferModal.analysis.amount_delta > 0 ? '+' : ''}${counterofferModal.analysis.amount_delta} USD, ${counterofferModal.analysis.delivery_days_delta > 0 ? '+' : ''}${counterofferModal.analysis.delivery_days_delta} days)
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D8E9E4] dark:border-[#345451]">
              <button
                type="button"
                disabled={isDecidingCounter}
                onClick={() => handleCounterofferDecision(counterofferModal.pkg.id, 'decline')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors"
              >
                Decline Counteroffer
              </button>
              <button
                type="button"
                disabled={isDecidingCounter}
                onClick={() => handleCounterofferDecision(counterofferModal.pkg.id, 'accept')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
              >
                Accept & Adjust Scope
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cancel Project Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Cancel Project Confirmation</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to cancel <strong>&ldquo;{project.projectName}&rdquo;</strong>? This will cancel any remaining active tasks and mark the project as cancelled.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={cancellingProject}
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Keep Project
              </button>
              <button
                type="button"
                disabled={cancellingProject}
                onClick={handleCancelProject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {cancellingProject ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Review & Rating Modal */}
      {reviewModalPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D8E9E4] dark:border-[#345451] pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <Award className="w-5 h-5" />
                <span>Approve Milestone & Leave Review</span>
              </div>
              <button
                onClick={() => setReviewModalPackage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                {reviewModalPackage.package.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specialist: {reviewModalPackage.package.assignedFreelancerName}
              </p>
            </div>

            {/* Star Rating Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Specialist Rating:
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= (hoverRating || reviewRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Review feedback textarea */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Review & Milestone Feedback:
              </label>
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience working with this specialist on this milestone..."
                className="w-full text-xs p-3 rounded-xl border border-[#D8E9E4] dark:border-[#345451] bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalPackage(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReview || !reviewText.trim()}
                onClick={handleSubmitReview}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submittingReview ? 'Submitting...' : 'Approve Milestone & Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Specialist Submission Inspection Modal */}
      {selectedSubmissionPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#D8E9E4] dark:border-[#345451] pb-3">
              <div className="flex items-center gap-2.5 text-[#10413E] dark:text-[#F0FAF8] font-bold text-sm">
                <div className="w-8 h-8 rounded-lg bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Deliverable Submission</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Inspect submitted output from specialist
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmissionPackage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#142F2E] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Specialist & Role Badge */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F0F8F6] dark:bg-[#102B2B] border border-[#D8E9E4] dark:border-[#345451]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#168C80] to-[#32B6A5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {(selectedSubmissionPackage.assignedFreelancerName || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                    {selectedSubmissionPackage.assignedFreelancerName || 'Specialist'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedSubmissionPackage.assignedFreelancerEmail || 'Talent'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  {selectedSubmissionPackage.category || selectedSubmissionPackage.roleName || 'Specialist'}
                </span>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Fee: ${selectedSubmissionPackage.allocatedPrice?.toLocaleString()} USD
                </div>
              </div>
            </div>

            {/* Deliverable URL Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8] flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-[#168C80] dark:text-[#73D8C7]" />
                <span>Deliverable Link / Repository:</span>
              </label>
              {selectedSubmissionPackage.deliverableLink ? (
                <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#D8E9E4] dark:border-[#345451]">
                  <a
                    href={selectedSubmissionPackage.deliverableLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#168C80] dark:text-[#73D8C7] hover:underline truncate max-w-[320px]"
                  >
                    {selectedSubmissionPackage.deliverableLink}
                  </a>
                  <a
                    href={selectedSubmissionPackage.deliverableLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#168C80] hover:bg-[#10766D] transition-colors shrink-0"
                  >
                    <span>Open</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  No external link provided with this submission.
                </p>
              )}
            </div>

            {/* Deliverable Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                Specialist Submission Notes:
              </label>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#D8E9E4] dark:border-[#345451] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {selectedSubmissionPackage.deliverableNotes ? (
                  selectedSubmissionPackage.deliverableNotes
                ) : (
                  <span className="text-slate-400 italic">No additional notes provided by specialist.</span>
                )}
              </div>
            </div>

            {/* Expected Deliverables Checklist (if present) */}
            {selectedSubmissionPackage.deliverables && selectedSubmissionPackage.deliverables.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Agreed Milestone Deliverables:
                </label>
                <div className="space-y-1">
                  {selectedSubmissionPackage.deliverables.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#D8E9E4] dark:border-[#345451]">
              <button
                type="button"
                onClick={() => setSelectedSubmissionPackage(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>

              {selectedSubmissionPackage.status !== 'Completed' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pkg = selectedSubmissionPackage;
                      setSelectedSubmissionPackage(null);
                      setRevisionModalOpen({ projectId, packageId: pkg.id });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Request Revision</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pkg = selectedSubmissionPackage;
                      setSelectedSubmissionPackage(null);
                      setReviewModalPackage({ projectId, package: pkg });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve &amp; Rate</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Approved &amp; Completed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Standalone ProjectChatModal shortcut */}
      {chatModalOpen && (
        <ProjectChatModal
          projectId={projectId}
          projectName={project.projectName}
          isOpen={chatModalOpen}
          onClose={() => setChatModalOpen(false)}
        />
      )}
    </div>
  );
}
