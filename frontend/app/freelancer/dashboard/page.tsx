'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Send,
  RefreshCw,
  MessageSquare,
  PlusCircle,
  FileText,
  MailCheck,
  Star,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Printer,
  Copy,
  Check,
  Award,
  Flag,
  ArrowRight,
} from 'lucide-react';
import { WorkPackage, ProjectProposal, IAiInvoiceDraft } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';

export default function FreelancerDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [activeChatProject, setActiveChatProject] = useState<{ id: string; name: string } | null>(null);

  // AI Invoice draft state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState<boolean>(false);
  const [invoiceDraft, setInvoiceDraft] = useState<IAiInvoiceDraft | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<boolean>(false);
  const [copiedInvoice, setCopiedInvoice] = useState<boolean>(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/freelancer/dashboard');
    } else if (status === 'authenticated') {
      const u = session?.user as any;
      if (u?.role === 'merchant') {
        router.push('/dashboard');
        return;
      }
      // Re-verify against MongoDB profile (source of truth)
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

  // Find accepted gigs for this freelancer
  const activeGigs: { project: ProjectProposal; pkg: WorkPackage }[] = [];
  let pendingInvitesCount = 0;

  projects.forEach((proj) => {
    proj.workPackages.forEach((wp) => {
      const matchesUser =
        wp.assignedFreelancerEmail?.toLowerCase() === userEmail ||
        (!wp.assignedFreelancerEmail && wp.category === userCategory);

      if (matchesUser) {
        if (wp.inviteStatus === 'accepted') {
          activeGigs.push({ project: proj, pkg: wp });
        } else if (wp.inviteStatus === 'invited' || !wp.inviteStatus) {
          pendingInvitesCount++;
        }
      }
    });
  });

  const currentGig = activeGigs[0] || null;
  const currentProjectId = currentGig ? (currentGig.project as any)._id || currentGig.project.id : '';

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId || !currentGig || !deliverableUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: currentGig.pkg.id,
          deliverableLink: deliverableUrl.trim(),
          deliverableNotes: deliverableNotes.trim(),
          status: 'In Progress',
        }),
      });

      if (res.ok) {
        setSubmittedMessage(true);
        setTimeout(() => setSubmittedMessage(false), 3500);
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to submit deliverable to MongoDB:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndProject = async () => {
    if (!currentProjectId || !currentGig || endingProject) return;
    setEndingProject(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: currentGig.pkg.id,
          closureRequested: true,
          status: 'Completed',
        }),
      });

      if (res.ok) {
        setEndProjectMessage('Project end requested! The merchant has been prompted on their dashboard to submit your rating and review.');
        setTimeout(() => setEndProjectMessage(null), 6000);
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to end project:', err);
    } finally {
      setEndingProject(false);
    }
  };

  const handlePostProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId || !currentGig || !progressText.trim() || postingProgress) return;

    setPostingProgress(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: currentGig.pkg.id,
          message: progressText.trim(),
        }),
      });

      if (res.ok) {
        setProgressText('');
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to post progress:', err);
    } finally {
      setPostingProgress(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!currentGig) return;
    setGeneratingInvoice(true);
    setInvoiceModalOpen(true);
    try {
      const res = await fetch('/api/ai/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation: {
            quotation_id: `q-${currentGig.pkg.id}`,
            freelancer_id: (session?.user as any)?.id || 'fl-1',
            work_package_id: currentGig.pkg.id,
            amount: currentGig.pkg.allocatedPrice,
            delivery_days: currentGig.pkg.estimatedDays || 7,
            scope: `${currentGig.pkg.title} - ${currentGig.pkg.description}`,
            status: currentGig.pkg.status.toLowerCase(),
          },
          client_name: currentGig.project.merchantName,
          freelancer_name: session?.user?.name || 'Freelancer',
          invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          tax_rate_percent: 0,
        }),
      });
      const data = await res.json();
      if (data.success && data.invoice) {
        setInvoiceDraft(data.invoice);
      }
    } catch (err) {
      console.error('Invoice error:', err);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleCopyInvoice = () => {
    if (!invoiceDraft) return;
    const text = `INVOICE: ${invoiceDraft.invoice_number}
Client: ${invoiceDraft.client_name}
Specialist: ${invoiceDraft.freelancer_name}
Total Amount: $${invoiceDraft.total} ${invoiceDraft.currency}
Note: ${invoiceDraft.payment_note}`;
    navigator.clipboard.writeText(text);
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2500);
  };

  if (loading || status === 'loading') {
    return (
      <div className="p-16 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-500" />
        <span>Loading active gigs from MongoDB Atlas...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              Specialist Portal
            </span>
            <span className="text-xs font-semibold text-slate-400">
              MongoDB Live Synced
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Active Gigs & Workspace
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Signed in as <strong className="text-slate-800 dark:text-slate-200">{user?.name}</strong> &bull; Specialty:{' '}
            <span className="text-cyan-600 dark:text-cyan-400 font-bold uppercase">{userCategory}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/freelancer/invitations"
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <MailCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Invitations {pendingInvitesCount > 0 && `(${pendingInvitesCount})`}</span>
          </Link>
          <Link
            href="/freelancer/profile"
            className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Profile
          </Link>
          <button
            onClick={fetchProjects}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pending Invitations Banner Alert */}
      {pendingInvitesCount > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
            <MailCheck className="w-4 h-4 text-amber-500 shrink-0" />
            <span>You have {pendingInvitesCount} pending project invitation(s) matched by AI!</span>
          </div>
          <Link
            href="/freelancer/invitations"
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold self-start sm:self-auto shadow-sm transition-all"
          >
            Review Invitations &rarr;
          </Link>
        </div>
      )}

      {/* If No Active Accepted Gigs */}
      {!currentGig ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-10 text-center space-y-4 shadow-sm transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Active Accepted Milestones</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              You are currently available for new merchant projects. Review your invitations tab or update your portfolio skills so our AI ranks you higher.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/freelancer/invitations"
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-glow-cyan transition-all"
            >
              Check Invitations
            </Link>
            <Link
              href="/freelancer/profile"
              className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              Update Portfolio & Rates
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Gig Card */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 shadow-sm transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                    {currentGig.pkg.category} {currentGig.pkg.roleName ? `• ${currentGig.pkg.roleName}` : ''}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Active & Funded
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {currentGig.project.projectName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Merchant: <strong className="text-slate-700 dark:text-slate-300">{currentGig.project.merchantName}</strong>
                </p>
              </div>

              {/* Chat Button & Payout */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGenerateInvoice}
                  className="px-3.5 py-2.5 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                  title="Generate itemized PayPal invoice draft with AI assistant"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Draft Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveChatProject({
                      id: currentProjectId,
                      name: currentGig.project.projectName,
                    });
                    setChatOpen(true);
                  }}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Team Chat</span>
                </button>

                <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Milestone Payout</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">${currentGig.pkg.allocatedPrice}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Scope of Milestone</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{currentGig.pkg.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">{currentGig.pkg.description}</p>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Current Status:</span>
              <span
                className={`text-xs font-bold px-3 py-0.5 rounded-full ${
                  currentGig.pkg.status === 'Completed'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : currentGig.pkg.status === 'In Progress'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {currentGig.pkg.status}
              </span>
            </div>
          </div>

          {/* Share Progress & Progress Feed */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm transition-colors">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Post Progress Update</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Share milestone notes, checklist completions, or blocker updates visible to the merchant.
              </p>
            </div>

            <form onSubmit={handlePostProgress} className="space-y-2.5">
              <textarea
                rows={2}
                placeholder="Share milestone progress (e.g. Created initial typography guidelines, responsive layout drafted)..."
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!progressText.trim() || postingProgress}
                  className="px-4 py-2 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                >
                  {postingProgress ? 'Posting...' : 'Post Progress Update'}
                </button>
              </div>
            </form>

            {/* Progress Updates Feed */}
            {currentGig.pkg.progressUpdates && currentGig.pkg.progressUpdates.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Progress Log:</span>
                {currentGig.pkg.progressUpdates.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {item.authorName} ({item.authorRole})
                      </span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End Project & Review Status Card */}
          {currentGig.pkg.status === 'Completed' && (
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

                <div className="flex items-center gap-2">
                  {currentGig.pkg.deliverableLink && (
                    <a
                      href={currentGig.pkg.deliverableLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 hover:underline text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Accepted Deliverable</span>
                    </a>
                  )}
                </div>
              </div>

              {endProjectMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{endProjectMessage}</span>
                </div>
              )}

              {/* Review Submitted State */}
              {currentGig.pkg.reviewSubmitted ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-500" />
                      <span>Project Concluded & Review Received</span>
                    </span>
                    <div className="flex items-center gap-1 text-amber-500 font-extrabold text-sm">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>{currentGig.pkg.reviewRating}.0 / 5.0</span>
                    </div>
                  </div>
                  {currentGig.pkg.reviewText && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/80 dark:border-slate-850">
                      "{currentGig.pkg.reviewText}"
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Reviewed by {currentGig.project.merchantName}</span>
                    <Link
                      href="/freelancer/profile"
                      className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      <span>View on your public profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ) : currentGig.pkg.closureRequested ? (
                /* Closure Requested - Awaiting Merchant Review */
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      <strong className="font-bold">Project Closure Requested:</strong> You have initiated closure for this project. The merchant has been prompted on their dashboard to provide a 5-star rating and written review.
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
                    Awaiting Review
                  </span>
                </div>
              ) : (
                /* Ready to End Project Action Button */
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
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    <span>{endingProject ? 'Concluding...' : 'End Project & Request Review'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Submit Deliverable Form */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm transition-colors">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {currentGig.pkg.status === 'Completed' ? 'Milestone Deliverable Link' : 'Submit Deliverable for Review'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentGig.pkg.status === 'Completed'
                  ? 'Your accepted deliverable link on record for this milestone.'
                  : 'When ready, provide your deliverable link (GitHub repo, Figma prototype, staging URL). The merchant can review and approve it.'}
              </p>
            </div>

            {submittedMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Deliverable updated! The merchant has been notified for review.</span>
              </div>
            )}

            <form onSubmit={handleSubmitDeliverable} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Deliverable URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/... or https://figma.com/..."
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Deliverable Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Summary of completed milestones and deliverables..."
                  value={deliverableNotes}
                  onChange={(e) => setDeliverableNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-glow-cyan flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Submitting Deliverable...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{currentGig.pkg.status === 'Completed' ? 'Update Deliverable Link' : 'Submit Deliverable'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Secured Project Chat Modal */}
      {activeChatProject && (
        <ProjectChatModal
          projectId={activeChatProject.id}
          projectName={activeChatProject.name}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* AI Invoice Draft Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-500" />
                  <span>GigSaw AI Freelancer Assistant</span>
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Itemized PayPal Invoice Draft
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {generatingInvoice ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500" />
                <span>Assembling verified milestone line items & tax calculations...</span>
              </div>
            ) : invoiceDraft ? (
              <div className="space-y-4">
                {/* Formal Invoice Preview Card */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between items-start pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="font-extrabold text-cyan-600 dark:text-cyan-400 text-sm">
                        GigSaw Invoice
                      </span>
                      <div className="text-[10px] text-slate-400">{invoiceDraft.invoice_number}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        Escrow Backed
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Client</span>
                      <span className="font-bold text-slate-900 dark:text-white">{invoiceDraft.client_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Issued By</span>
                      <span className="font-bold text-slate-900 dark:text-white">{invoiceDraft.freelancer_name}</span>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Milestone Scope:</span>
                    {invoiceDraft.line_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-800/60"
                      >
                        <span className="text-slate-700 dark:text-slate-300 pr-2">{item.description}</span>
                        <span className="font-bold text-slate-900 dark:text-white shrink-0">${item.amount}</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary Totals */}
                  <div className="space-y-1 pt-1 text-right text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Subtotal:</span>
                      <span>${invoiceDraft.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Estimated Tax:</span>
                      <span>${invoiceDraft.tax}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span>Total Due:</span>
                      <span className="text-cyan-600 dark:text-cyan-400">
                        ${invoiceDraft.total} {invoiceDraft.currency}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 pt-1 italic">
                    {invoiceDraft.payment_note}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    Draft complies with PayPal billing itemization rules.
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyInvoice}
                      className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedInvoice ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Summary</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
