'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  ChevronLeft,
  Calendar,
  DollarSign,
  FileText,
  Printer,
  Copy,
  Check,
  Award,
  Flag,
  XCircle,
  AlertTriangle,
  Star,
  Receipt,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  CreditCard,
  ArrowUpRight,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';
import { WorkPackage, ProjectProposal } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';
import { EmbeddedProjectChat } from '@/components/chat/EmbeddedProjectChat';

export type FreelancerWorkspaceTab = 'general' | 'submissions' | 'chat' | 'payment';

export default function FreelancerGigWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;
  const targetPkgId = searchParams.get('pkg');
  const { data: session, status } = useSession();

  const [project, setProject] = useState<ProjectProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab & Retractable Sidebar State
  const [activeTab, setActiveTab] = useState<FreelancerWorkspaceTab>('general');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Deliverable submission state
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // End Project & Closure state
  const [endingProject, setEndingProject] = useState(false);
  const [endProjectMessage, setEndProjectMessage] = useState<string | null>(null);

  // Progress update state
  const [progressText, setProgressText] = useState('');
  const [postingProgress, setPostingProgress] = useState(false);
  const [progressSuccessMsg, setProgressSuccessMsg] = useState(false);

  // Chat modal state (standalone fallback modal)
  const [chatOpen, setChatOpen] = useState(false);

  // Official PayPal Invoice state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);
  const [officialInvoiceUrl, setOfficialInvoiceUrl] = useState<string | null>(null);
  const [officialInvoiceId, setOfficialInvoiceId] = useState<string | null>(null);
  const [officialInvoiceNumber, setOfficialInvoiceNumber] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<boolean>(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState<boolean>(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/freelancer/dashboard/${projectId}`);
    } else if (status === 'authenticated') {
      const u = session?.user as any;
      if (u?.role === 'merchant') {
        router.push('/dashboard');
        return;
      }
    }
  }, [status, session, router, projectId]);

  const initialFetchDone = useRef<string | null>(null);

  const fetchProject = useCallback(async (isInitial = false) => {
    if (!projectId) return;
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success && data.project) {
        setProject(data.project);
      } else {
        setError(data.error || 'Project not found');
      }
    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err.message || 'Failed to load project details');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (status === 'authenticated' && projectId && initialFetchDone.current !== projectId) {
      initialFetchDone.current = projectId;
      fetchProject(true);
    }
  }, [status, projectId, fetchProject]);

  const user = session?.user as any;
  const userEmail = user?.email?.toLowerCase();
  const userCategory = user?.category || 'dev';

  // Identify the specific work package for this freelancer
  const matchingPkg: WorkPackage | null = React.useMemo(() => {
    if (!project || !project.workPackages) return null;
    if (targetPkgId) {
      const found = project.workPackages.find((w) => w.id === targetPkgId);
      if (found) return found;
    }
    // Fallback: match by email or category
    return (
      project.workPackages.find(
        (w) =>
          w.assignedFreelancerEmail?.toLowerCase() === userEmail ||
          (!w.assignedFreelancerEmail && w.category === userCategory)
      ) || project.workPackages[0] || null
    );
  }, [project, targetPkgId, userEmail, userCategory]);

  // Sync existing deliverable link if present
  useEffect(() => {
    if (matchingPkg?.deliverableLink) {
      setDeliverableUrl(matchingPkg.deliverableLink);
    }
    if (matchingPkg?.deliverableNotes) {
      setDeliverableNotes(matchingPkg.deliverableNotes);
    }
  }, [matchingPkg]);

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !matchingPkg || !deliverableUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: matchingPkg.id,
          deliverableLink: deliverableUrl.trim(),
          deliverableNotes: deliverableNotes.trim(),
          status: 'In Progress',
        }),
      });

      if (res.ok) {
        setSubmittedMessage(true);
        setTimeout(() => setSubmittedMessage(false), 5000);
        fetchProject();
      }
    } catch (err) {
      console.error('Failed to submit deliverable:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndProject = async () => {
    if (!projectId || !matchingPkg || endingProject) return;
    setEndingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: matchingPkg.id,
          closureRequested: true,
          status: 'Completed',
        }),
      });

      if (res.ok) {
        setEndProjectMessage(
          'Project conclusion requested! The merchant has been prompted on their dashboard to approve and submit your review.'
        );
        setTimeout(() => setEndProjectMessage(null), 7000);
        fetchProject();
      }
    } catch (err) {
      console.error('Failed to end project:', err);
    } finally {
      setEndingProject(false);
    }
  };

  const handlePostProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !progressText.trim() || postingProgress) return;
    setPostingProgress(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[Progress Update]: ${progressText.trim()}`,
        }),
      });
      if (res.ok) {
        setProgressText('');
        setProgressSuccessMsg(true);
        setTimeout(() => setProgressSuccessMsg(false), 4000);
        fetchProject();
      }
    } catch (err) {
      console.error('Failed to post progress message:', err);
    } finally {
      setPostingProgress(false);
    }
  };

  const handleOpenPayPalInvoice = async () => {
    if (!project || !matchingPkg || generatingInvoice) return;
    setGeneratingInvoice(true);
    setInvoiceError(null);
    setInvoiceModalOpen(true);
    try {
      const res = await fetch('/api/paypal/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: (project as any)._id || project.id,
          packageId: matchingPkg.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.invoiceUrl) {
        setOfficialInvoiceUrl(data.invoiceUrl);
        setOfficialInvoiceId(data.invoiceId);
        setOfficialInvoiceNumber(data.invoiceNumber);
        setInvoiceStatus(data.status || 'PAID');
        window.open(data.invoiceUrl, '_blank', 'noopener,noreferrer');
      } else {
        setInvoiceError(data.error || 'Failed to retrieve official PayPal invoice.');
      }
    } catch (err: any) {
      console.error('Failed to generate official PayPal invoice:', err);
      setInvoiceError(err.message || 'Error communicating with PayPal Invoicing API.');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 dark:bg-[#1B3B39] rounded-2xl animate-pulse" />
        <div className="h-96 bg-slate-100 dark:bg-[#1B3B39] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !project || !matchingPkg) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gig Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {error || 'Could not find this project or milestone assignment.'}
        </p>
        <Link
          href="/freelancer/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Return to My Gigs</span>
        </Link>
      </div>
    );
  }

  const isProjectCancelled = project.status === 'cancelled';
  const isCompleted = matchingPkg.status === 'Completed';
  const isRevisionRequested = matchingPkg.status === 'Revision Requested';
  const hasSubmitted = Boolean(matchingPkg.deliverableLink || matchingPkg.deliverableNotes);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-800 dark:text-slate-100 transition-colors">
      {/* ============================================================== */}
      {/* RETRACTABLE SIDEBAR                                            */}
      {/* ============================================================== */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'
        } shrink-0 bg-white dark:bg-[#142F2E] border-r border-[#D8E9E4] dark:border-[#345451] flex flex-col transition-all duration-200 z-10`}
      >
        {/* Sidebar Header & Toggle */}
        <div className="p-4 border-b border-[#D8E9E4] dark:border-[#345451] flex items-center justify-between gap-2">
          {!isSidebarCollapsed ? (
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#168C80] dark:text-[#73D8C7] block truncate">
                Freelancer Workspace
              </span>
              <h2 className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8] truncate">
                {project.projectName}
              </h2>
            </div>
          ) : (
            <div className="mx-auto">
              <div className="w-8 h-8 rounded-xl bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] flex items-center justify-center font-bold text-xs">
                {(matchingPkg.category || 'G').charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:flex items-center justify-center cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-[#168C80] dark:text-[#73D8C7]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Sidebar Navigation */}
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
            title="General Overview & Project Details"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">General</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/20 text-slate-500 dark:text-slate-400">
                  {isCompleted ? 'Done' : 'Active'}
                </span>
              </div>
            )}
          </button>

          {/* TAB 2: SUBMISSIONS */}
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
              activeTab === 'submissions'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="Deliverables & Submissions"
          >
            <Send className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Submissions</span>
                {isRevisionRequested ? (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                    Revision
                  </span>
                ) : isCompleted ? (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Approved
                  </span>
                ) : hasSubmitted ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                    Submitted
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Pending
                  </span>
                )}
              </div>
            )}
            {isSidebarCollapsed && isRevisionRequested && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* TAB 3: TEAM CHAT */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
              activeTab === 'chat'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="Team & Merchant Chat"
          >
            <MessageSquare className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Team Chat</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live room" />
              </div>
            )}
          </button>

          {/* TAB 4: PAYMENT / MONEY */}
          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
              activeTab === 'payment'
                ? 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-l-4 border-[#168C80] dark:border-[#32B6A5] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`}
            title="PayPal Escrow, Invoices & Payout"
          >
            <DollarSign className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">Payment</span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  ${matchingPkg.allocatedPrice}
                </span>
              </div>
            )}
          </button>
        </nav>

        {/* Sidebar Footer: Back to My Gigs */}
        <div className="p-3 border-t border-[#D8E9E4] dark:border-[#345451] space-y-2">
          <Link
            href="/freelancer/dashboard"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to all gigs"
          >
            <ChevronLeft className="w-4 h-4 shrink-0 text-[#168C80] dark:text-[#32B6A5]" />
            {!isSidebarCollapsed && <span className="truncate">My Gigs</span>}
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
                className={`px-3 py-1 rounded-full text-xs font-black tracking-wide border ${
                  isProjectCancelled
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : isCompleted
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : isRevisionRequested
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                    : 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] border-[#D8E9E4] dark:border-[#345451]'
                }`}
              >
                {isProjectCancelled
                  ? 'Project Cancelled'
                  : isCompleted
                  ? 'Milestone Completed'
                  : isRevisionRequested
                  ? 'Revision Requested by Merchant'
                  : 'In Execution'}
              </span>

              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Client: <strong>{project.merchantName}</strong>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#10413E] dark:text-[#F0FAF8] tracking-tight truncate">
              {matchingPkg.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              Project: {project.projectName}
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-xl px-3.5 py-1.5 text-right shadow-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                Milestone Fee
              </span>
              <span className="text-xs font-black text-[#10413E] dark:text-[#F0FAF8]">
                ${matchingPkg.allocatedPrice?.toLocaleString()} USD
              </span>
            </div>

            <button
              type="button"
              onClick={() => fetchProject(false)}
              className="p-2 border border-[#D8E9E4] dark:border-[#345451] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh from MongoDB"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {submittedMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Deliverable submitted successfully! The merchant has been notified on their dashboard to inspect and approve.</span>
          </div>
        )}

        {endProjectMessage && (
          <div className="p-4 bg-[#E5F5F1] dark:bg-[#254542] border border-[#168C80]/30 rounded-2xl text-xs font-semibold text-[#168C80] dark:text-[#73D8C7] flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#168C80] shrink-0" />
            <span>{endProjectMessage}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: GENERAL OVERVIEW                                        */}
        {/* ============================================================== */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Merchant Revision Request Alert */}
            {isRevisionRequested && (
              <div className="p-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <span>Merchant Requested Deliverable Revision</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('submissions')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Go to Submissions &rarr;
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-white/70 dark:bg-black/30 border border-amber-500/20 text-xs">
                  <span className="font-bold block text-amber-800 dark:text-amber-300 mb-1">
                    Merchant Feedback / Revision Notes:
                  </span>
                  <p className="leading-relaxed">
                    {matchingPkg.deliverableNotes ||
                      'The client reviewed your submission and requested adjustments before escrow can be released. Please check the Submissions tab to update your work.'}
                  </p>
                </div>
              </div>
            )}

            {/* Completed & Approved Banner */}
            {isCompleted && (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Milestone Deliverable Approved</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      The merchant has verified your deliverable and released payment.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {matchingPkg.reviewRating && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>{matchingPkg.reviewRating}.0 / 5.0</span>
                    </div>
                  )}
                  {matchingPkg.deliverableLink && (
                    <a
                      href={matchingPkg.deliverableLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Accepted Deliverable</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Cancelled Banner */}
            {isProjectCancelled && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-xs text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <div>
                  <strong className="font-bold">Project Cancelled by Merchant:</strong> The merchant has cancelled this project. Deliveries are paused and remaining escrow funds have been closed.
                </div>
              </div>
            )}

            {/* Basic Info & Project Details Card */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#D8E9E4] dark:border-[#345451] pb-3">
                <div className="flex items-center gap-2 text-[#10413E] dark:text-[#F0FAF8] font-bold text-sm">
                  <FolderOpen className="w-4 h-4 text-[#168C80] dark:text-[#73D8C7]" />
                  <span>Project Details &amp; Merchant Specifications</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#168C80]/10 text-[#168C80] dark:text-[#73D8C7] border border-[#168C80]/20">
                  {matchingPkg.category?.toUpperCase() || 'SPECIALIST'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                    Project Name
                  </span>
                  <p className="font-bold text-[#10413E] dark:text-[#F0FAF8] text-sm">
                    {project.projectName}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                    Client &amp; Contact
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {project.merchantName}{' '}
                    <span className="text-slate-400 font-normal">({project.merchantEmail})</span>
                  </p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                  Client Brief &amp; Prompt
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-[#F0F8F6] dark:bg-[#102B2B] p-3.5 rounded-xl border border-[#D8E9E4] dark:border-[#345451]">
                  {project.merchantPrompt || 'No detailed prompt provided.'}
                </p>
              </div>
            </div>

            {/* Budget & Contract Metrics 3-Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Milestone Escrow Value
                </span>
                <div className="text-xl font-black text-[#10413E] dark:text-[#F0FAF8]">
                  ${matchingPkg.allocatedPrice?.toLocaleString()} USD
                </div>
                <span className="text-[11px] text-[#168C80] dark:text-[#73D8C7] font-bold">
                  {isCompleted
                    ? 'Escrow Disbursed'
                    : isProjectCancelled
                    ? 'Escrow Cancelled'
                    : 'Guaranteed in PayPal Escrow'}
                </span>
              </div>

              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Agreed Delivery Window
                </span>
                <div className="text-xl font-black text-[#10413E] dark:text-[#F0FAF8]">
                  {matchingPkg.estimatedDays ? `${matchingPkg.estimatedDays} Days` : '7 Days'}
                </div>
                <span className="text-[11px] text-slate-400">Turnaround schedule</span>
              </div>

              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-5 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Specialty Role
                </span>
                <div className="text-xl font-black text-[#10413E] dark:text-[#F0FAF8] uppercase">
                  {matchingPkg.category}
                </div>
                <span className="text-[11px] text-slate-400">Verified milestone talent</span>
              </div>
            </div>

            {/* Contract Scope & Required Deliverables */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-3 shadow-xs">
              <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                Assigned Scope &amp; Deliverables
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {matchingPkg.description}
              </p>

              {matchingPkg.deliverables && matchingPkg.deliverables.length > 0 && (
                <div className="pt-2 border-t border-[#D8E9E4] dark:border-[#345451]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Agreed Deliverables Checklist:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {matchingPkg.deliverables.map((deliv, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-700 dark:text-slate-300 text-xs rounded-lg font-medium border border-[#D8E9E4] dark:border-[#345451] flex items-center gap-1.5"
                      >
                        <Check className="w-3 h-3 text-[#168C80] dark:text-[#73D8C7]" />
                        <span>{deliv}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Milestone Progress Poster */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                  Post Milestone Progress Update
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Share quick status notes directly into the project channel so the merchant stays informed.
                </p>
              </div>

              {progressSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Progress update broadcasted to team channel!</span>
                </div>
              )}

              <form onSubmit={handlePostProgress} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Completed initial design mockups, connecting backend endpoints..."
                  value={progressText}
                  onChange={(e) => setProgressText(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#D8E9E4] dark:border-[#345451] bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#168C80]"
                />
                <button
                  type="submit"
                  disabled={postingProgress || !progressText.trim()}
                  className="px-5 py-2.5 bg-[#168C80] hover:bg-[#10766D] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  {postingProgress ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Post Update</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SUBMISSIONS & DELIVERABLES                              */}
        {/* ============================================================== */}
        {activeTab === 'submissions' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Revision Callout if active */}
            {isRevisionRequested && (
              <div className="p-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 shadow-xs">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Merchant Revision Instructions</span>
                </div>
                <p className="text-xs leading-relaxed bg-white/70 dark:bg-black/30 p-3 rounded-xl border border-amber-500/20">
                  {matchingPkg.deliverableNotes ||
                    'Please make the adjustments requested by the merchant and provide an updated deliverable link below.'}
                </p>
              </div>
            )}

            {/* Current Deliverable Status Card */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E9E4] dark:border-[#345451] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                    Current Deliverable On Record
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Output submitted for client inspection and escrow disbursement.
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                    isCompleted
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : isRevisionRequested
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : hasSubmitted
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isCompleted
                    ? 'Approved & Escrow Released'
                    : isRevisionRequested
                    ? 'Revision Requested'
                    : hasSubmitted
                    ? 'Under Review by Merchant'
                    : 'Awaiting Submission'}
                </span>
              </div>

              {matchingPkg.deliverableLink ? (
                <div className="p-3.5 rounded-xl bg-[#F0F8F6] dark:bg-[#102B2B] border border-[#D8E9E4] dark:border-[#345451] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Repository / Preview URL
                    </span>
                    <a
                      href={matchingPkg.deliverableLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#168C80] dark:text-[#73D8C7] hover:underline truncate block max-w-lg"
                    >
                      {matchingPkg.deliverableLink}
                    </a>
                  </div>
                  <a
                    href={matchingPkg.deliverableLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold transition-all shrink-0 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Deliverable</span>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No deliverable link has been submitted yet. Use the form below to submit your repository or prototype.
                </p>
              )}

              {/* Client Review & Testimonial if completed */}
              {isCompleted && matchingPkg.reviewSubmitted && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Client Testimonial &amp; Rating</span>
                    </span>
                    <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 text-amber-500 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{matchingPkg.reviewRating}.0 / 5.0</span>
                    </div>
                  </div>
                  {matchingPkg.reviewText && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      &ldquo;{matchingPkg.reviewText}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* End Project / Request Review Action Button */}
              {isCompleted && !matchingPkg.reviewSubmitted && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[#D8E9E4] dark:border-[#345451] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                      Request Client Review &amp; Rating
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Prompt the client to submit your official testimonial and 5-star rating for this milestone.
                    </p>
                  </div>
                  <button
                    onClick={handleEndProject}
                    disabled={endingProject || matchingPkg.closureRequested}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Flag className="w-4 h-4" />
                    <span>
                      {matchingPkg.closureRequested
                        ? 'Review Requested'
                        : endingProject
                        ? 'Requesting...'
                        : 'Prompt Client for Review'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Submit / Update Deliverable Form */}
            {!isProjectCancelled && (
              <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                    {hasSubmitted ? 'Update Deliverable Submission' : 'Submit Deliverable for Review'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Provide your repository, Figma prototype, or live deployment URL. The merchant will inspect and disburse milestone funds.
                  </p>
                </div>

                <form onSubmit={handleSubmitDeliverable} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Deliverable URL <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://github.com/your-org/repo or https://www.figma.com/file/..."
                      value={deliverableUrl}
                      onChange={(e) => setDeliverableUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8E9E4] dark:border-[#345451] bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#168C80] font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Delivery Notes &amp; Setup Instructions
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Detail environment setup, access credentials, staging links, or your response to revision feedback..."
                      value={deliverableNotes}
                      onChange={(e) => setDeliverableNotes(e.target.value)}
                      className="w-full p-3 rounded-xl border border-[#D8E9E4] dark:border-[#345451] bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#168C80]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !deliverableUrl.trim()}
                    className="px-5 py-2.5 bg-[#168C80] hover:bg-[#10766D] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting Deliverable...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{hasSubmitted ? 'Update Submission' : 'Submit Deliverable'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TEAM CHAT                                               */}
        {/* ============================================================== */}
        {activeTab === 'chat' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                  Project Team Chat Room
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time messaging with client <strong>{project.merchantName}</strong> and assembled team members.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Channel
              </span>
            </div>

            {/* Embedded Real-time Chat */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] overflow-hidden shadow-xs">
              <EmbeddedProjectChat projectId={projectId} projectName={project.projectName} />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: PAYMENT, PAYPAL ESCROW & INVOICES                       */}
        {/* ============================================================== */}
        {activeTab === 'payment' && (
          <div className="space-y-6 animate-fadeIn">
            {/* PayPal Escrow Status Card */}
            <div className="bg-gradient-to-r from-[#168C80]/15 via-[#32B6A5]/10 to-[#73D8C7]/10 border border-[#168C80]/30 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#168C80]/20 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#168C80]/20 text-[#168C80] dark:text-[#73D8C7] border border-[#168C80]/30 rounded-full flex items-center gap-1">
                      <Receipt className="w-3 h-3" />
                      PayPal Multi-Seller Escrow Active
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full">
                      Status: {matchingPkg.paypalInvoiceStatus || 'PAID'}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-[#10413E] dark:text-[#F0FAF8]">
                    Direct Payout Guaranteed by PayPal Orders v2
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Secured Amount
                  </span>
                  <span className="text-xl font-black text-[#10413E] dark:text-[#F0FAF8]">
                    ${matchingPkg.allocatedPrice?.toLocaleString()} USD
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                Your <strong>${matchingPkg.allocatedPrice?.toLocaleString()} USD</strong> milestone fee is funded upfront by the merchant and held safely in PayPal Escrow. Funds are routed directly into your PayPal account upon deliverable approval.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-white/70 dark:bg-black/30 border border-[#168C80]/20 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Billed Merchant</span>
                  <div className="font-bold text-slate-900 dark:text-white">{project.merchantName}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">{project.merchantEmail}</div>
                </div>

                <div className="p-3 rounded-xl bg-white/70 dark:bg-black/30 border border-[#168C80]/20 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Payable Specialist</span>
                  <div className="font-bold text-slate-900 dark:text-white">{matchingPkg.assignedFreelancerName}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                    {matchingPkg.assignedFreelancerEmail || userEmail}
                  </div>
                </div>
              </div>

              {matchingPkg.paypalCaptureId && (
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between border-t border-[#168C80]/20">
                  <span>PayPal Capture Reference:</span>
                  <span className="font-bold text-[#168C80] dark:text-[#73D8C7]">{matchingPkg.paypalCaptureId}</span>
                </div>
              )}
            </div>

            {/* Official PayPal Invoicing Section */}
            <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-[#D8E9E4] dark:border-[#345451] p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E9E4] dark:border-[#345451] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#10413E] dark:text-[#F0FAF8]">
                    Official PayPal Invoicing (REST API v2)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Access your official client-billed PayPal invoice and payment receipt.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenPayPalInvoice}
                  disabled={generatingInvoice}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {generatingInvoice ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Loading Invoice...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>View Official PayPal Invoice</span>
                    </>
                  )}
                </button>
              </div>

              {officialInvoiceUrl ? (
                <div className="p-4 rounded-xl bg-[#F0F8F6] dark:bg-[#102B2B] border border-[#D8E9E4] dark:border-[#345451] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                      INVOICE #{officialInvoiceNumber || officialInvoiceId}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Status: <strong className="text-emerald-600">{invoiceStatus || 'PAID'}</strong> &bull; Amount: <strong>${matchingPkg.allocatedPrice} USD</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={officialInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#168C80] hover:bg-[#10766D] text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in PayPal</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(officialInvoiceUrl!);
                        setCopiedInvoice(true);
                        setTimeout(() => setCopiedInvoice(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-[#D8E9E4] dark:border-[#345451] text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedInvoice ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Click the button above to generate or open your hosted PayPal invoice with full merchant tax details, itemized milestone line items, and payment status.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Standalone ProjectChatModal shortcut if toggled */}
      {chatOpen && (
        <ProjectChatModal
          projectId={projectId}
          projectName={project.projectName}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Official PayPal Invoice Modal Fallback */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#1B3B39] border border-[#D8E9E4] dark:border-[#345451] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E9E4] dark:border-[#345451]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#168C80] dark:text-[#73D8C7]" />
                <h3 className="text-base font-bold text-[#10413E] dark:text-[#F0FAF8]">
                  Official PayPal Invoice (REST API v2)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatingInvoice ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#168C80] dark:text-[#73D8C7]" />
                <span className="text-xs">Fetching official hosted invoice from PayPal API...</span>
              </div>
            ) : invoiceError ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-700 dark:text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span>Invoice Generation Notice</span>
                </div>
                <p>{invoiceError}</p>
                <button
                  type="button"
                  onClick={handleOpenPayPalInvoice}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Retry Request
                </button>
              </div>
            ) : officialInvoiceUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F0F8F6] dark:bg-[#102B2B] border border-[#D8E9E4] dark:border-[#345451] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#10413E] dark:text-[#F0FAF8]">
                      INVOICE #{officialInvoiceNumber || officialInvoiceId}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {invoiceStatus || 'PAID'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#D8E9E4] dark:border-[#345451]">
                    <div>
                      <span className="text-slate-400 block font-sans">Billed Client:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{project.merchantName}</strong>
                      <span className="text-[10px] text-slate-400 block truncate">{project.merchantEmail}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block font-sans">Payable Specialist:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{matchingPkg.assignedFreelancerName}</strong>
                      <span className="text-[10px] text-slate-400 block truncate">{matchingPkg.assignedFreelancerEmail}</span>
                    </div>
                  </div>

                  <div className="border-t border-[#D8E9E4] dark:border-[#345451] pt-2 space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{matchingPkg.title} ({matchingPkg.category})</span>
                      <span>${matchingPkg.allocatedPrice?.toFixed(2)} USD</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Authorized &amp; funded via PayPal Multi-Seller Escrow on Gigsaw.
                    </p>
                  </div>

                  {matchingPkg.paypalCaptureId && (
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 border-t border-[#D8E9E4] dark:border-[#345451] pt-1.5 flex justify-between">
                      <span>PayPal Capture Ref:</span>
                      <span className="text-[#168C80] dark:text-[#73D8C7]">{matchingPkg.paypalCaptureId}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={officialInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#168C80] hover:bg-[#10766D] transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in PayPal</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(officialInvoiceUrl!);
                      setCopiedInvoice(true);
                      setTimeout(() => setCopiedInvoice(false), 2000);
                    }}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedInvoice ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8E9E4] dark:border-[#345451]">
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
