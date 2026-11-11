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
} from 'lucide-react';
import { WorkPackage, ProjectProposal, IAiInvoiceDraft } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';

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

  // Chat modal state
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
        setTimeout(() => setSubmittedMessage(false), 4000);
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
        setEndProjectMessage('Project end requested! The merchant has been prompted on their dashboard to submit your rating and review.');
        setTimeout(() => setEndProjectMessage(null), 6000);
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
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
          <span>Loading gig workspace from MongoDB Atlas...</span>
        </div>
      </div>
    );
  }

  if (error || !project || !matchingPkg) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Gig Not Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {error || 'Could not find this project or milestone assignment.'}
          </p>
          <Link
            href="/freelancer/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to My Gigs</span>
          </Link>
        </div>
      </div>
    );
  }

  const isProjectCancelled = project.status === 'cancelled';
  const isCompleted = matchingPkg.status === 'Completed';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs">
        <Link
          href="/freelancer/dashboard"
          className="text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>My Gigs</span>
        </Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="text-slate-500 dark:text-slate-400 truncate max-w-xs">{project.projectName}</span>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{matchingPkg.title}</span>
      </div>

      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isProjectCancelled
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : isCompleted
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
              }`}
            >
              {isProjectCancelled ? 'Project Cancelled' : isCompleted ? 'Milestone Completed' : 'In Execution'}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Client: {project.merchantName}
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {matchingPkg.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
            Project: {project.projectName} &bull; {project.merchantPrompt}
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

          <button
            onClick={handleOpenPayPalInvoice}
            disabled={generatingInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Open official PayPal hosted invoice"
          >
            {generatingInvoice ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Receipt className="w-4 h-4 text-blue-500" />
            )}
            <span>Official PayPal Invoice</span>
          </button>

          <button
            onClick={() => fetchProject(false)}
            className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isProjectCancelled && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-xs text-rose-900 dark:text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <strong className="font-bold">Project Cancelled by Merchant:</strong> The merchant has cancelled this project. Further milestone deliveries are suspended and remaining escrow has been closed.
          </div>
        </div>
      )}

      {/* Escrow & Contract Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Milestone Escrow Value</span>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${matchingPkg.allocatedPrice?.toLocaleString()} USD
          </div>
          <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">
            {isCompleted ? 'Escrow Released' : isProjectCancelled ? 'Escrow Cancelled' : 'Guaranteed in PayPal Escrow'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Turnaround</span>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {matchingPkg.estimatedDays ? `${matchingPkg.estimatedDays} Days` : '7 Days'}
          </div>
          <span className="text-[11px] text-slate-400">Delivery schedule agreed</span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Specialty Domain</span>
          <div className="text-xl font-black text-slate-900 dark:text-white uppercase">
            {matchingPkg.category}
          </div>
          <span className="text-[11px] text-slate-400">Verified specialist contract</span>
        </div>
      </div>

      {/* Official PayPal Escrow & Invoice Details */}
      {(project.status === 'FUNDED_IN_PROGRESS' || project.status === 'funded' || isCompleted) && (
        <div className="bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-emerald-500/10 border border-blue-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                <Receipt className="w-3 h-3 text-blue-500" />
                PayPal Multi-Seller Escrow Active
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full">
                Status: {matchingPkg.paypalInvoiceStatus || 'PAID'}
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Direct Payout Guaranteed by PayPal Orders v2
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Your <strong>${matchingPkg.allocatedPrice?.toLocaleString()} USD</strong> milestone fee is funded upfront and routed into your PayPal Business Sandbox account upon deliverable approval.
            </p>
            {matchingPkg.paypalCaptureId && (
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                PayPal Capture Reference: <span className="font-bold text-cyan-600 dark:text-cyan-400">{matchingPkg.paypalCaptureId}</span>
              </div>
            )}
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleOpenPayPalInvoice}
              disabled={generatingInvoice}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {generatingInvoice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading PayPal Invoice...</span>
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
      )}

      {/* Scope & Deliverables Required */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-3 transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contract Scope & Deliverables</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {matchingPkg.description}
        </p>

        {matchingPkg.deliverables && matchingPkg.deliverables.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Deliverables Required:
            </span>
            <div className="flex flex-wrap gap-2">
              {matchingPkg.deliverables.map((deliv, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg font-medium border border-slate-200 dark:border-slate-700"
                >
                  &bull; {deliv}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deliverable Approved & Review Status Card */}
      {isCompleted && (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border-2 border-emerald-500/30 p-6 space-y-4 shadow-sm transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Milestone Deliverable Approved
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The merchant has verified and accepted your deliverable for this milestone.
                </p>
              </div>
            </div>

            {matchingPkg.deliverableLink && (
              <a
                href={matchingPkg.deliverableLink}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 hover:underline text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Accepted Deliverable</span>
              </a>
            )}
          </div>

          {endProjectMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{endProjectMessage}</span>
            </div>
          )}

          {matchingPkg.reviewSubmitted ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Client Testimonial & Rating Received</span>
                </span>
                <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 text-amber-500 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{matchingPkg.reviewRating}.0 / 5.0</span>
                </div>
              </div>
              {matchingPkg.reviewText && (
                <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/80 dark:border-slate-850">
                  &ldquo;{matchingPkg.reviewText}&rdquo;
                </p>
              )}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Reviewed by {project.merchantName}</span>
                <Link
                  href="/freelancer/profile"
                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold inline-flex items-center gap-1"
                >
                  <span>View on your public profile</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : matchingPkg.closureRequested ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  <strong className="font-bold">Project Closure Requested:</strong> You have initiated closure for this milestone. The merchant has been prompted on their dashboard to provide a 5-star rating and written review.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
                Awaiting Review
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Conclude Milestone & Request Review</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ready to finalize? Click End Project to request your official rating and testimonial from the merchant.
                </p>
              </div>
              <button
                onClick={handleEndProject}
                disabled={endingProject}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center gap-2 cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>{endingProject ? 'Concluding...' : 'End Project & Request Review'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit Deliverable Form */}
      {!isProjectCancelled && (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm transition-colors">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isCompleted ? 'Milestone Deliverable Link' : 'Submit Deliverable for Review'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isCompleted
                ? 'Your accepted deliverable link on record for this milestone.'
                : 'When ready, provide your deliverable link (GitHub repo, Figma prototype, staging URL). The merchant can review and approve it.'}
            </p>
          </div>

          {submittedMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Deliverable submitted successfully! The merchant has been notified to inspect and approve.</span>
            </div>
          )}

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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Delivery Notes & Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Describe setup instructions, credentials, test accounts, or revision responses..."
                value={deliverableNotes}
                onChange={(e) => setDeliverableNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !deliverableUrl.trim()}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-glow-cyan flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Deliverable...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isCompleted ? 'Update Deliverable Link' : 'Submit Deliverable'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Progress Log Section */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm transition-colors">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Post Milestone Progress Update</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Share quick daily status notes directly into the project channel so the merchant stays updated.
        </p>

        <form onSubmit={handlePostProgress} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Completed initial UI components, connecting API endpoints today..."
            value={progressText}
            onChange={(e) => setProgressText(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={postingProgress || !progressText.trim()}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {postingProgress ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Post Update</span>
          </button>
        </form>
      </div>

      {/* Team Chat Modal */}
      {chatOpen && (
        <ProjectChatModal
          projectId={projectId}
          projectName={project.projectName}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Official PayPal Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] border border-blue-500/30 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Official PayPal Invoice (REST API v2)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {generatingInvoice ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
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
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
                >
                  Retry Request
                </button>
              </div>
            ) : officialInvoiceUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-emerald-500/10 border border-blue-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      INVOICE #{officialInvoiceNumber || officialInvoiceId}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {invoiceStatus || 'PAID'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-500/10">
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

                  <div className="border-t border-blue-500/10 pt-2 space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{matchingPkg.title} ({matchingPkg.category})</span>
                      <span>${matchingPkg.allocatedPrice?.toFixed(2)} USD</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Authorized & funded via PayPal Multi-Seller Escrow on GigSaw.
                    </p>
                  </div>

                  {matchingPkg.paypalCaptureId && (
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 border-t border-blue-500/10 pt-1.5 flex justify-between">
                      <span>PayPal Capture Ref:</span>
                      <span className="text-cyan-600 dark:text-cyan-400">{matchingPkg.paypalCaptureId}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={officialInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in PayPal</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(officialInvoiceUrl);
                      setCopiedInvoice(true);
                      setTimeout(() => setCopiedInvoice(false), 2000);
                    }}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
