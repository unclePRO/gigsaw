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
} from 'lucide-react';
import { WorkPackage, ProjectProposal } from '@/types';
import { ProjectChatModal } from '@/components/chat/ProjectChatModal';

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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
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
      headerName: 'Role Category',
      width: 130,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const cat = params.data?.category || 'dev';
        const role = params.data?.roleName;
        return (
          <div className="py-2">
            <span className="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 inline-block">
              {cat}
            </span>
            {role && <div className="text-[10px] text-slate-400 truncate">{role}</div>}
          </div>
        );
      },
    },
    {
      field: 'title',
      headerName: 'Milestone / Task',
      flex: 1.6,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        if (!params.data) return null;
        return (
          <div className="py-2">
            <div className="font-bold text-slate-900 leading-snug">{params.data.title}</div>
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
          return <span className="text-slate-400 text-xs py-3 block">Pending Talent Match</span>;
        }
        return (
          <div className="py-2">
            <div className="font-bold text-xs text-slate-900">{name}</div>
            <div className="text-[11px] text-slate-400 truncate">{email}</div>
          </div>
        );
      },
    },
    {
      field: 'inviteStatus',
      headerName: 'Invite Status',
      width: 130,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const inv = params.data?.inviteStatus || 'invited';
        if (inv === 'accepted') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 my-3">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Accepted</span>
            </span>
          );
        }
        if (inv === 'declined') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 my-3">
              <span>Declined</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 my-3">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Invite Sent</span>
          </span>
        );
      },
    },
    {
      field: 'allocatedPrice',
      headerName: 'Price ($)',
      width: 100,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => (
        <span className="font-bold text-slate-900 py-3 block">${params.data?.allocatedPrice}</span>
      ),
    },
    {
      field: 'status',
      headerName: 'Milestone State',
      width: 130,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const status = params.data?.status || 'Pending';
        if (status === 'Completed') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Completed</span>
            </span>
          );
        }
        if (status === 'In Progress') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>In Progress</span>
            </span>
          );
        }
        if (status === 'Revision Requested') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>Revision</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
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
        if (!link) return <span className="text-slate-400 text-xs py-3 block">None</span>;
        return (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:underline py-3"
          >
            <span>Review</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      },
    },
    {
      headerName: 'Actions',
      width: 170,
      cellRenderer: (params: ICellRendererParams<WorkPackage>) => {
        const wp = params.data;
        if (!wp || !currentProjectId) return null;
        const isCompleted = wp.status === 'Completed';

        return (
          <div className="flex items-center gap-1.5 py-2">
            <button
              onClick={() => handleUpdateStatus(currentProjectId, wp.id, 'Completed')}
              disabled={isCompleted}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                isCompleted
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {isCompleted ? 'Approved' : 'Approve'}
            </button>

            <button
              onClick={() =>
                setRevisionModalOpen({ projectId: currentProjectId, packageId: wp.id })
              }
              className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Revision
            </button>
          </div>
        );
      },
    },
  ], [currentProjectId]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor dynamic roles, milestone invitation states, and chat with your assigned team.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProjects}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            title="Refresh from MongoDB"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Project</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-600" />
          <span>Fetching projects from MongoDB Atlas...</span>
        </div>
      ) : !currentProject ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No projects found in MongoDB</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven&apos;t launched any projects yet. Use the project creator to decompose your project and send invitations to freelancers.
            </p>
          </div>
          <Link
            href="/create"
            className="inline-block px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg shadow-sm"
          >
            Create Your First Project
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Project Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Active Project</span>
              <h2 className="text-lg font-bold text-slate-900">{currentProject.projectName}</h2>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{currentProject.merchantPrompt}</p>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setActiveChatProject({
                    id: currentProjectId,
                    name: currentProject.projectName,
                  });
                  setChatOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Team Chat</span>
              </button>

              <div className="text-right border-l pl-4 border-slate-200">
                <span className="text-xs text-slate-400 font-medium block">Total Budget</span>
                <span className="text-lg font-bold text-slate-900">${currentProject.totalBudget}</span>
              </div>
            </div>
          </div>

          {/* AG Grid Work Packages Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Project Milestones ({currentProject.workPackages.length} Dynamic Roles)
              </h3>
              <span className="text-xs text-slate-400">
                {currentProject.workPackages.filter((w) => w.status === 'Completed').length} of{' '}
                {currentProject.workPackages.length} Completed
              </span>
            </div>

            <div className="ag-theme-alpine w-full h-[320px]">
              <AgGridReact<WorkPackage>
                rowData={currentProject.workPackages}
                columnDefs={columnDefs}
                rowHeight={60}
                animateRows={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <h4 className="font-bold text-slate-900 text-base">Request Revision</h4>
            <p className="text-xs text-slate-500">
              Enter specific revision notes for this milestone:
            </p>

            <textarea
              rows={4}
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="e.g. Please update the hero font and add mobile breakpoints..."
              className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevisionModalOpen(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
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
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700"
              >
                Send Request
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
    </div>
  );
}
