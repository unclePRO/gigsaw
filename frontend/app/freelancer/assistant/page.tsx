'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bot, FileText, Copy, Receipt } from 'lucide-react';

export default function FreelancerAssistantPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user as any;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/freelancer/assistant');
    } else if (status === 'authenticated') {
      const u = session?.user as any;
      if (u?.role === 'merchant') {
        router.push('/dashboard');
        return;
      }
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

  const [prompt, setPrompt] = useState(
    'Generate an itemized milestone quotation for full-stack web development with responsive frontend and API integration, total $600.'
  );
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedDoc(`=======================================================
GIGSAW FREELANCER INVOICE / QUOTATION
=======================================================
Invoice #: INV-${Date.now().toString().slice(-6)}
Date: ${new Date().toLocaleDateString()}

ISSUED BY:
${user?.name || 'Freelancer Specialist'} (${user?.category?.toUpperCase() || 'DEVELOPER'})
Email: ${user?.email || 'freelancer@example.com'}

LINE ITEMS:
1. Core Architecture & Database Setup ........... $250.00
2. Functional Implementation & Integrations ..... $250.00
3. Staging Deployment & Review Revisions ........ $100.00
-------------------------------------------------------
Total Milestone Amount:                          $600.00
Payment Status: Paid via PayPal Multi-Seller Checkout
=======================================================`);
      setIsGenerating(false);
    }, 600);
  };

  const copyToClipboard = () => {
    if (generatedDoc) {
      navigator.clipboard.writeText(generatedDoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Freelancer Assistant</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate quick quotations, milestone scopes, and invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <label className="text-xs font-bold text-slate-700 block">Prompt</label>
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate Invoice Document'}
          </button>
        </div>

        <div className="bg-slate-900 text-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 font-mono text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Document Output</span>
              {generatedDoc && (
                <button
                  onClick={copyToClipboard}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <pre className="pt-3 whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed">
              {generatedDoc || 'Click generate to create an invoice preview.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
