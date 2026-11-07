'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User,
  Star,
  CheckCircle2,
  Briefcase,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  RefreshCw,
  AlertCircle,
  Tag,
  DollarSign,
  Mail,
} from 'lucide-react';
import { IPastProject, FreelancerCategory } from '@/types';

export default function FreelancerProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(50);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [category, setCategory] = useState<FreelancerCategory>('dev');
  const [rating, setRating] = useState<number>(5.0);
  const [completedProjects, setCompletedProjects] = useState<number>(0);
  const [availability, setAvailability] = useState<'available' | 'busy'>('available');

  // Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');

  // Past Projects
  const [pastProjects, setPastProjects] = useState<IPastProject[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjUrl, setNewProjUrl] = useState('');
  const [newProjTech, setNewProjTech] = useState('');
  const [newProjDate, setNewProjDate] = useState('');

  // Authentication check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/freelancer/profile');
    }
  }, [status, router]);

  // Fetch current profile from MongoDB
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/freelancer/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            const p = data.profile;
            setTitle(p.title || '');
            setBio(p.bio || '');
            setHourlyRate(p.hourlyRate || 50);
            setPaypalEmail(p.paypalEmail || p.email || '');
            setCategory(p.category || 'dev');
            setRating(p.rating || 5.0);
            setCompletedProjects(p.completedProjects || 0);
            setSkills(Array.isArray(p.skills) ? p.skills : []);
            setPastProjects(Array.isArray(p.pastProjects) ? p.pastProjects : []);
            setAvailability(p.availability || 'available');
          }
        })
        .catch((err) => setError('Failed to load profile from MongoDB'))
        .finally(() => setLoading(false));
    }
  }, [status]);

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleAddPastProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim() || !newProjDesc.trim()) return;

    const techArray = newProjTech
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newProject: IPastProject = {
      title: newProjTitle.trim(),
      description: newProjDesc.trim(),
      projectUrl: newProjUrl.trim() || undefined,
      technologies: techArray,
      completionDate: newProjDate || new Date().toISOString().slice(0, 7),
    };

    setPastProjects([newProject, ...pastProjects]);
    setNewProjTitle('');
    setNewProjDesc('');
    setNewProjUrl('');
    setNewProjTech('');
    setNewProjDate('');
    setShowAddProject(false);
  };

  const handleRemovePastProject = (index: number) => {
    setPastProjects(pastProjects.filter((_, i) => i !== index));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/freelancer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          bio,
          hourlyRate,
          skills,
          pastProjects,
          paypalEmail,
          availability,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Profile and portfolio saved to MongoDB Atlas successfully!');
        setTimeout(() => setMessage(null), 3500);
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-600" />
        <span>Loading freelancer profile from MongoDB...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Freelancer Profile & Portfolio</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your skills and completed projects are analyzed by our AI selection model to match you with merchant projects.
          </p>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ratings & Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Talent Category</span>
          <div className="text-xl font-extrabold text-slate-900 uppercase">{category}</div>
          <span className="text-[11px] text-cyan-600 font-semibold">Matched for {category} milestones</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Rating Score</span>
          <div className="text-xl font-extrabold text-amber-500 flex items-center gap-1">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span>{rating.toFixed(1)} / 5.0</span>
          </div>
          <span className="text-[11px] text-slate-400">Based on merchant approvals</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Completed Gigs</span>
          <div className="text-xl font-extrabold text-emerald-600">{completedProjects} Finished</div>
          <span className="text-[11px] text-slate-400">Recorded in MongoDB</span>
        </div>
      </div>

      {/* Basic Info & Rates Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Professional Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Professional Title</label>
            <input
              type="text"
              placeholder="e.g. Senior Next.js & Full-Stack Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Hourly Rate (USD)</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                min={15}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Bio & Experience Overview</label>
          <textarea
            rows={3}
            placeholder="Highlight your domain experience, specialties, and workflow..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">PayPal Payout Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                placeholder="your-paypal-email@domain.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Current Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
            >
              <option value="available">Available for new milestones</option>
              <option value="busy">Busy / At capacity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skills Selection Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Skills & Competencies</h2>
            <p className="text-xs text-slate-500">
              Add technical skills and tools our AI matcher checks against project goals.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{skills.length} Skills</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200"
            >
              <Tag className="w-3 h-3 text-cyan-600" />
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="text-slate-400 hover:text-rose-600 ml-0.5 text-xs font-bold"
              >
                ✕
              </button>
            </span>
          ))}
          {skills.length === 0 && (
            <span className="text-xs text-slate-400 italic">No skills added yet.</span>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="e.g. Next.js, TypeScript, Figma, Tailwind CSS, SEO"
            value={newSkillInput}
            onChange={(e) => setNewSkillInput(e.target.value)}
            onKeyDown={handleAddSkill}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="button"
            onClick={handleAddSkill}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            Add Skill
          </button>
        </div>
      </div>

      {/* Past Projects & Existing Portfolio Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Portfolio & Previous Projects</h2>
            <p className="text-xs text-slate-500">
              Document completed projects to showcase capability and boost AI selection ranking.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddProject(!showAddProject)}
            className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </button>
        </div>

        {/* Add Project Form */}
        {showAddProject && (
          <form
            onSubmit={handleAddPastProject}
            className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs"
          >
            <h3 className="font-bold text-slate-900 text-sm">Add New Portfolio Project</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ecommerce Storefront Platform"
                  value={newProjTitle}
                  onChange={(e) => setNewProjTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Live URL / Repo (Optional)</label>
                <input
                  type="url"
                  placeholder="https://github.com/... or https://..."
                  value={newProjUrl}
                  onChange={(e) => setNewProjUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Description of Work</label>
              <textarea
                rows={2}
                required
                placeholder="What did you build and deliver?"
                value={newProjDesc}
                onChange={(e) => setNewProjDesc(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Technologies Used (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Next.js, Stripe, MongoDB, Tailwind"
                  value={newProjTech}
                  onChange={(e) => setNewProjTech(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Completion Date (Month / Year)</label>
                <input
                  type="month"
                  value={newProjDate}
                  onChange={(e) => setNewProjDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProject(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold"
              >
                Add to Portfolio
              </button>
            </div>
          </form>
        )}

        {/* Existing Projects List */}
        <div className="space-y-3">
          {pastProjects.map((proj, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">{proj.title}</h3>
                  {proj.projectUrl && (
                    <a
                      href={proj.projectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-0.5 text-xs font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Link</span>
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{proj.description}</p>
                {proj.technologies && proj.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proj.technologies.map((t, ti) => (
                      <span
                        key={ti}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex sm:flex-col items-end justify-between gap-2 shrink-0">
                {proj.completionDate && (
                  <span className="text-[11px] text-slate-400">{proj.completionDate}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePastProject(idx)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                  title="Remove Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {pastProjects.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No previous projects documented yet. Add past client work or personal showcases above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
