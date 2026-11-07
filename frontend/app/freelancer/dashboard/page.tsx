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
} from 'lucide-react';
import { WorkPackage, ProjectProposal } from '@/types';
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

  // Progress update state
  const [progressText, setProgressText] = useState('');
  const [postingProgress, setPostingProgress] = useState(false);

  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatProject, setActiveChatProject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/freelancer/dashboard');
    } else if (status === 'authenticated' && (session?.user as any)?.role === 'merchant') {
      router.push('/dashboard');
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

  if (loading || status === 'loading') {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-600" />
        <span>Loading active gigs from MongoDB...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Active Gigs & Workspace</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <strong className="text-slate-800">{user?.name}</strong> &bull; Category:{' '}
            <strong className="text-cyan-700 uppercase">{userCategory}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/freelancer/profile"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            My Profile & Skills
          </Link>
          <button
            onClick={fetchProjects}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pending Invitations Banner Alert */}
      {pendingInvitesCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <MailCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>You have {pendingInvitesCount} new project milestone invitation(s) waiting for your response!</span>
          </div>
          <Link
            href="/freelancer/invitations"
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold self-start sm:self-auto shadow-sm"
          >
            Review & Accept Invitations &rarr;
          </Link>
        </div>
      )}

      {/* If No Active Accepted Gigs */}
      {!currentGig ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Active Accepted Gigs</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You do not have any active gigs right now. Check your invitations to accept tasks, or update your skills profile so our AI selects you for upcoming merchant projects.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/freelancer/invitations"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              Check Invitations
            </Link>
            <Link
              href="/freelancer/profile"
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold"
            >
              Update Skills Profile
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Gig Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                    {currentGig.pkg.category} {currentGig.pkg.roleName ? `• ${currentGig.pkg.roleName}` : ''}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Active & Accepted
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{currentGig.project.projectName}</h2>
                <p className="text-xs text-slate-500">Merchant: {currentGig.project.merchantName}</p>
              </div>

              {/* Chat Button & Payout */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveChatProject({
                      id: currentProjectId,
                      name: currentGig.project.projectName,
                    });
                    setChatOpen(true);
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Project Group Chat</span>
                </button>

                <div className="text-right border-l pl-3 border-slate-200">
                  <span className="text-xs text-slate-400 block font-medium">Milestone Payout</span>
                  <span className="text-xl font-black text-slate-900">${currentGig.pkg.allocatedPrice}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700">Task Scope</span>
              <p className="text-sm font-semibold text-slate-900">{currentGig.pkg.title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{currentGig.pkg.description}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-bold text-slate-600">Milestone Status:</span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  currentGig.pkg.status === 'Completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentGig.pkg.status === 'In Progress'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {currentGig.pkg.status}
              </span>
            </div>
          </div>

          {/* Share Progress & Progress Feed */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Share Progress & Updates</h3>
            <p className="text-xs text-slate-500">
              Post milestone notes, completed checklists, or blocker updates visible to the merchant.
            </p>

            <form onSubmit={handlePostProgress} className="space-y-2">
              <textarea
                rows={2}
                placeholder="Share milestone progress (e.g. Setup database schema and drafted API endpoints)..."
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!progressText.trim() || postingProgress}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:bg-slate-300"
                >
                  {postingProgress ? 'Posting...' : 'Post Progress Update'}
                </button>
              </div>
            </form>

            {/* Progress Updates Feed */}
            {currentGig.pkg.progressUpdates && currentGig.pkg.progressUpdates.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block">Progress Log:</span>
                {currentGig.pkg.progressUpdates.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="font-bold text-slate-700">
                        {item.authorName} ({item.authorRole})
                      </span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Deliverable Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Submit Deliverable for Merchant Approval</h3>
            <p className="text-xs text-slate-500">
              When ready, enter your live deliverable URL (Figma prototype, GitHub repository, or live staging URL). The merchant can review and approve it on their dashboard.
            </p>

            {submittedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Deliverable updated! The merchant has been notified for review.</span>
              </div>
            )}

            <form onSubmit={handleSubmitDeliverable} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Deliverable URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/... or https://figma.com/..."
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Deliverable Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Briefly summarize what was completed in this deliverable..."
                  value={deliverableNotes}
                  onChange={(e) => setDeliverableNotes(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Submitting Deliverable...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Deliverable</span>
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
    </div>
  );
}
