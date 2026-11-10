'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { IPastProject, FreelancerCategory } from '@/types';

const SUGGESTED_LANGUAGES_AND_SKILLS = [
  'TypeScript',
  'JavaScript',
  'Python',
  'React',
  'Next.js',
  'Node.js',
  'HTML/CSS',
  'Java',
  'C++',
  'Go',
  'Rust',
  'SQL',
  'Tailwind CSS',
  'PHP',
  'Figma',
  'Docker',
  'English',
  'Spanish',
  'German',
  'French',
  'Hindi',
];

export default function FreelancerProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetupParam = searchParams.get('setup') === 'required';
  const { data: session, status, update } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);

  // Form states - Strictly NO mock data defaults
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number | ''>('');
  const [indicativeProjectPrice, setIndicativeProjectPrice] = useState<number | ''>('');
  const [yearsOfExperience, setYearsOfExperience] = useState<number | ''>('');
  const [typicalDeliveryDays, setTypicalDeliveryDays] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [priceBasis, setPriceBasis] = useState<'hour' | 'project'>('hour');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [category, setCategory] = useState<FreelancerCategory>('dev');
  const [rating, setRating] = useState<number>(0);
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
            const isFormActuallyComplete = Boolean(
              (p.title && String(p.title).trim().length > 0) &&
              (p.bio && String(p.bio).trim().length > 0) &&
              (typeof p.hourlyRate === 'number' && p.hourlyRate > 0) &&
              (Array.isArray(p.skills) && p.skills.length > 0) &&
              (p.yearsOfExperience !== undefined && p.yearsOfExperience !== null && Number(p.yearsOfExperience) >= 0) &&
              (p.typicalDeliveryDays !== undefined && p.typicalDeliveryDays !== null && Number(p.typicalDeliveryDays) >= 1) &&
              (p.location && String(p.location).trim().length > 0)
            );
            const isComp = Boolean(p.isProfileComplete || isFormActuallyComplete);
            setIsProfileComplete(isComp);
            if (isComp && isSetupParam) {
              router.replace('/freelancer/profile');
            }
            setTitle(p.title || '');
            setBio(p.bio || '');
            setHourlyRate(
              typeof p.hourlyRate === 'number' && p.hourlyRate > 0 ? p.hourlyRate : ''
            );
            setIndicativeProjectPrice(
              typeof p.indicativeProjectPrice === 'number' && p.indicativeProjectPrice > 0
                ? p.indicativeProjectPrice
                : ''
            );
            setYearsOfExperience(
              typeof p.yearsOfExperience === 'number' && p.yearsOfExperience >= 0
                ? p.yearsOfExperience
                : ''
            );
            setTypicalDeliveryDays(
              typeof p.typicalDeliveryDays === 'number' && p.typicalDeliveryDays >= 1
                ? p.typicalDeliveryDays
                : ''
            );
            setLocation(p.location || '');
            setPriceBasis(p.priceBasis || 'hour');
            setPaypalEmail(p.paypalEmail || p.email || '');
            setCategory(p.category || 'dev');
            setRating(typeof p.rating === 'number' ? p.rating : 0);
            setCompletedProjects(typeof p.completedProjects === 'number' ? p.completedProjects : 0);
            setSkills(Array.isArray(p.skills) ? p.skills : []);
            setPastProjects(Array.isArray(p.pastProjects) ? p.pastProjects : []);
            setAvailability(p.availability || 'available');
          }
        })
        .catch((err) => setError('Failed to load profile from MongoDB'))
        .finally(() => setLoading(false));
    }
  }, [status, isSetupParam, router]);

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
    setMessage(null);
    setError(null);

    // Strict validation to ensure genuine, complete profile
    if (!title.trim()) {
      setError('Professional Title is required.');
      return;
    }
    if (!bio.trim()) {
      setError('Bio & Experience overview is required.');
      return;
    }
    if (hourlyRate === '' || Number(hourlyRate) <= 0) {
      setError('Please provide a valid hourly rate greater than $0.');
      return;
    }
    if (yearsOfExperience === '' || Number(yearsOfExperience) < 0) {
      setError('Please provide your years of experience (0 or more).');
      return;
    }
    if (typicalDeliveryDays === '' || Number(typicalDeliveryDays) < 1) {
      setError('Please provide typical delivery days (at least 1 day).');
      return;
    }
    if (!location.trim()) {
      setError('Location / Timezone is required.');
      return;
    }
    if (skills.length === 0) {
      setError('Please add at least one relevant skill/competency.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/freelancer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          bio: bio.trim(),
          hourlyRate: Number(hourlyRate),
          indicativeProjectPrice: indicativeProjectPrice !== '' ? Number(indicativeProjectPrice) : undefined,
          yearsOfExperience: Number(yearsOfExperience),
          typicalDeliveryDays: Number(typicalDeliveryDays),
          location: location.trim(),
          priceBasis,
          skills,
          pastProjects,
          paypalEmail: paypalEmail.trim() || undefined,
          availability,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsProfileComplete(true);
        if (typeof update === 'function') {
          try {
            await update({ isProfileComplete: true });
          } catch {}
        }
        setMessage('Profile setup complete! Redirecting to your specialist dashboard...');
        router.replace('/freelancer/profile');
        setTimeout(() => {
          router.push('/freelancer/dashboard');
        }, 1200);
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
      <div className="p-16 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-500" />
        <span>Loading freelancer profile from MongoDB...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Header & Status */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              Talent Profile
            </span>
            <span className="text-xs font-semibold text-slate-400">
              AI Matching Enabled
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Specialist Portfolio & Rates
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your skills, experience, and portfolio are indexed by our AI matching engine to pair you with merchant milestones.
          </p>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-glow-cyan flex items-center gap-1.5 self-start sm:self-auto"
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

      {/* Minimalistic Profile Setup Banner */}
      {!loading && !isProfileComplete && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong className="font-bold text-amber-950 dark:text-amber-100">Profile Setup Required:</strong> Please complete your profile details below to unlock your workspace and AI matching.
          </span>
        </div>
      )}

      {message && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ratings & Metrics Banner - Real MongoDB Atlas Data Only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Specialty Domain</span>
          <div className="text-xl font-black text-slate-900 dark:text-white uppercase">{category}</div>
          <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">Verified for {category} milestones</span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Merchant Rating</span>
          <div className="text-xl font-black text-amber-500 flex items-center gap-1.5">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span>{rating > 0 && completedProjects > 0 ? `${rating.toFixed(1)} / 5.0` : 'No Rating'}</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {completedProjects > 0 ? `${completedProjects} verified milestone reviews` : 'No reviews yet'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-1 transition-colors">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Milestones</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {completedProjects === 0 ? '0 Finished' : `${completedProjects} Finished`}
          </div>
          <span className="text-[11px] text-slate-400">
            {completedProjects === 0 ? 'Accept milestone invites to begin' : 'Verified in MongoDB Atlas'}
          </span>
        </div>
      </div>

      {/* Basic Info & Rates Card */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Professional Details & AI Parameters</h2>
          <span className="text-[11px] text-slate-400 italic">* All fields required for AI matchmaking</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Professional Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Next.js & Full-Stack Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Hourly Rate (USD) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">$</span>
              <input
                type="number"
                min={1}
                placeholder="e.g. 45"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* AI Estimation Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Years of Experience <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              placeholder="e.g. 3"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Typical Turnaround (Days) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 5"
              value={typicalDeliveryDays}
              onChange={(e) => setTypicalDeliveryDays(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Location / Timezone <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. New York, NY (EST) or Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Bio & Experience Overview <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Highlight your domain experience, specialties, past achievements, and preferred workflows..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">PayPal Payout Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                placeholder="your-paypal-email@domain.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Current Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="available">Available for new milestones</option>
              <option value="busy">Busy / At capacity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skills & Languages Selection Card */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Skills & Languages</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select or add your programming languages, spoken languages, and core competencies.
            </p>
          </div>
          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800">
            {skills.length} Selected
          </span>
        </div>

        {/* Selected skills/languages pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700"
            >
              <Tag className="w-3 h-3 text-cyan-500" />
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="text-slate-400 hover:text-rose-500 ml-0.5 text-xs font-bold"
              >
                ✕
              </button>
            </span>
          ))}
          {skills.length === 0 && (
            <span className="text-xs text-slate-400 italic">No skills or languages added yet.</span>
          )}
        </div>

        {/* Suggested Languages & Tools (One-click add) */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Suggested Languages & Tools (Click to add):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_LANGUAGES_AND_SKILLS.map((lang) => {
              const isSelected = skills.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      handleRemoveSkill(lang);
                    } else {
                      setSkills([...skills, lang]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500'
                  }`}
                >
                  <span>{isSelected ? '✓' : '+'}</span>
                  <span>{lang}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom skill/language input */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            placeholder="Type a custom language or skill (e.g. Kotlin, Rust, French, Solidity)..."
            value={newSkillInput}
            onChange={(e) => setNewSkillInput(e.target.value)}
            onKeyDown={handleAddSkill}
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="button"
            onClick={handleAddSkill}
            className="px-5 py-2 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {/* Past Projects & Existing Portfolio Card */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Portfolio & Previous Projects</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Document completed projects to showcase capability and boost AI selection ranking.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddProject(!showAddProject)}
            className="px-3.5 py-2 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </button>
        </div>

        {/* Add Project Form */}
        {showAddProject && (
          <form
            onSubmit={handleAddPastProject}
            className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs"
          >
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Add Portfolio Showcase</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ecommerce Storefront Platform"
                  value={newProjTitle}
                  onChange={(e) => setNewProjTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Live URL / Repo (Optional)</label>
                <input
                  type="url"
                  placeholder="https://github.com/... or https://..."
                  value={newProjUrl}
                  onChange={(e) => setNewProjUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Description of Work Delivered</label>
              <textarea
                rows={2}
                required
                placeholder="What did you build and deliver?"
                value={newProjDesc}
                onChange={(e) => setNewProjDesc(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Technologies (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Next.js, Stripe, MongoDB, Tailwind"
                  value={newProjTech}
                  onChange={(e) => setNewProjTech(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Completion Date (Calendar)</span>
                </label>
                <input
                  type="date"
                  value={newProjDate}
                  onChange={(e) => setNewProjDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProject(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-bold shadow-sm"
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
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{proj.title}</h3>
                  {proj.projectUrl && (
                    <a
                      href={proj.projectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Live Link</span>
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{proj.description}</p>
                {proj.technologies && proj.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proj.technologies.map((t, ti) => (
                      <span
                        key={ti}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700"
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
                  className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                  title="Remove Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {pastProjects.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              No previous projects documented yet. Add past client work or personal showcases above to boost your AI selection ranking.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
