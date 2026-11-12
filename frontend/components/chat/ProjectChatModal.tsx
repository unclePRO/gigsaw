'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Send,
  X,
  Users,
  ShieldCheck,
  RefreshCw,
  Phone,
  Video,
  MoreVertical,
  Search,
  Paperclip,
  Smile,
  CheckCheck,
  Briefcase,
  Layers,
  TrendingUp,
  UserCheck,
  Info,
  Sparkles,
} from 'lucide-react';
import { IChatMessage } from '@/types';

interface ProjectChatModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectChatModal: React.FC<ProjectChatModalProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose,
}) => {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [participants, setParticipants] = useState<{ name: string; role: string; email: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChat = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        if (data.participants) {
          setParticipants(data.participants);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err: any) {
      console.error('Failed to load chat:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      fetchChat().finally(() => {
        setLoading(false);
        scrollToBottom();
      });

      // Poll chat every 3 seconds while modal is open
      const interval = setInterval(fetchChat, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleAiAssist = async (action: 'kickoff' | 'action_items' | 'summarize') => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);

    try {
      const res = await fetch('/api/ai/chat-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          project_name: projectName,
          merchant_name: session?.user?.name || 'Merchant',
          members: participants.map((p) => ({
            name: p.name,
            role: p.role?.toLowerCase().includes('merchant') ? 'merchant' : 'freelancer',
          })),
          messages: messages.map((m) => ({
            sender: m.senderName,
            role: m.senderRole === 'merchant' ? 'merchant' : m.senderRole === 'ai_assistant' ? 'ai_assistant' : 'freelancer',
            text: m.message,
          })),
          action,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        // Post the AI coordinator message directly into the room
        await fetch(`/api/projects/${projectId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: data.message,
            isAiAssistant: true,
          }),
        });

        await fetchChat();
        scrollToBottom();
      }
    } catch (err) {
      console.error('AI chat room error:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  if (!isOpen) return null;

  const currentEmail = session?.user?.email?.toLowerCase();

  // Color generator for participant names in WhatsApp style
  const getParticipantColor = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'ai_assistant') return 'text-cyan-600 dark:text-cyan-400 font-extrabold';
    if (r.includes('dev')) return 'text-cyan-600 dark:text-cyan-400';
    if (r.includes('design')) return 'text-purple-600 dark:text-purple-400';
    if (r.includes('market')) return 'text-emerald-600 dark:text-emerald-400';
    if (r.includes('merchant')) return 'text-[#168C80] dark:text-[#32B6A5]';
    return 'text-amber-600 dark:text-amber-400';
  };

  const getRoleIcon = (role: string) => {
    const r = role.toLowerCase();
    if (r === 'ai_assistant') return <Sparkles className="w-3.5 h-3.5 text-cyan-500" />;
    if (r.includes('dev')) return <Briefcase className="w-3.5 h-3.5 text-cyan-500" />;
    if (r.includes('design')) return <Layers className="w-3.5 h-3.5 text-purple-400" />;
    if (r.includes('market')) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
    return <UserCheck className="w-3.5 h-3.5 text-[#168C80] dark:text-[#32B6A5]" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#1B3B39] rounded-2xl w-full max-w-3xl h-[620px] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        {/* WhatsApp Style Group Header */}
        <div className="px-4 py-3 bg-[#142F2E] text-white flex items-center justify-between border-b border-slate-800 select-none shadow-md">
          <div
            onClick={() => setShowGroupInfo(!showGroupInfo)}
            className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity min-w-0"
          >
            {/* WhatsApp Group Avatar */}
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-[#168C80] to-[#32B6A5] flex items-center justify-center shrink-0 border border-cyan-400/30 shadow-inner">
              <Users className="w-5 h-5 text-white" />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#142F2E]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white truncate max-w-[220px] sm:max-w-md">
                  {projectName} Team
                </h3>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  Group
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate max-w-[220px] sm:max-w-md mt-0.5">
                {participants.length > 0
                  ? participants.map((p) => p.name).join(', ')
                  : 'Merchant, Assigned Specialists'}
              </p>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 sm:gap-2 text-slate-300">
            <button
              type="button"
              onClick={() => setShowGroupInfo(!showGroupInfo)}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors"
              title="Group Information"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Group Info Drawer (collapsible) */}
        {showGroupInfo && (
          <div className="bg-slate-100 dark:bg-[#1B3B39] border-b border-slate-200 dark:border-slate-800 p-4 transition-all animate-fadeIn text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-500" />
                <span>Team Members ({participants.length})</span>
              </span>
              <span className="text-[10px] text-slate-400">Protected Project Chat</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-white dark:bg-[#1B3B39] rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate text-[11px]">{p.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp Message Wallpaper / Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#EFEAE2] dark:bg-[#0B141A] transition-colors">
          {/* End-to-end encryption notification pill */}
          <div className="flex justify-center">
            <div className="bg-[#FFF4C4] dark:bg-[#182229] border border-[#FFE799] dark:border-slate-800 text-[#54656F] dark:text-[#8696A0] text-[10px] px-3.5 py-1.5 rounded-lg shadow-sm text-center max-w-sm flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Messages are encrypted for secure team collaboration.</span>
            </div>
          </div>

          {loading ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
              <span>Connecting to project team...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 text-center">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Welcome to your project team group!
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                Introduce project goals, share links, or coordinate milestones with your hired specialists.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderEmail.toLowerCase() === currentEmail;
              const isAi = msg.senderRole === 'ai_assistant';
              const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div
                    className={`relative max-w-sm sm:max-w-md px-3 py-2 rounded-2xl text-xs shadow-sm ${
                      isAi
                        ? 'bg-cyan-50/95 dark:bg-cyan-950/70 border border-cyan-300/80 dark:border-cyan-800 text-slate-900 dark:text-cyan-100 rounded-tl-none shadow-cyan-500/10'
                        : isMe
                        ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-900 dark:text-white rounded-tr-none'
                        : 'bg-white dark:bg-[#202C33] text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Sender Name in WhatsApp colors for other team members */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1">
                        {isAi && <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" />}
                        <span className={`font-bold text-[11px] ${getParticipantColor(msg.senderRole)}`}>
                          {msg.senderName}
                        </span>
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 font-bold">
                          {isAi ? 'AI Facilitator' : msg.senderRole}
                        </span>
                      </div>
                    )}

                    {/* Message Text */}
                    <p className="leading-relaxed whitespace-pre-wrap text-[12px] break-words">
                      {msg.message}
                    </p>

                    {/* Timestamp & WhatsApp Double Checkmarks */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400 dark:text-slate-400">
                      <span>{formattedTime}</span>
                      {isMe && (
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* AI Room Coordinator Quick Actions */}
        <div className="px-3 py-1.5 bg-[#EFEAE2]/90 dark:bg-[#0B141A]/90 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="font-bold text-slate-400 uppercase text-[10px] shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <span>AI Room Tools:</span>
          </span>
          <button
            type="button"
            disabled={isAiGenerating}
            onClick={() => handleAiAssist('kickoff')}
            className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1F2C34] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-300 dark:border-slate-700 font-semibold transition-all shrink-0 active:scale-95"
          >
            {isAiGenerating ? 'Generating...' : '✨ Team Kickoff'}
          </button>
          <button
            type="button"
            disabled={isAiGenerating}
            onClick={() => handleAiAssist('action_items')}
            className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1F2C34] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-300 dark:border-slate-700 font-semibold transition-all shrink-0 active:scale-95"
          >
            📋 Milestone Action Items
          </button>
          <button
            type="button"
            disabled={isAiGenerating}
            onClick={() => handleAiAssist('summarize')}
            className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1F2C34] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-300 dark:border-slate-700 font-semibold transition-all shrink-0 active:scale-95"
          >
            📝 Executive Summary
          </button>
        </div>

        {/* WhatsApp Style Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-2 sm:p-3 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <button
              type="button"
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Attach File"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Type a message to team..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2A3942] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors shadow-sm"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white transition-all shadow-md shrink-0 ${
              !inputText.trim() || sending
                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-400'
                : 'bg-cyan-500 hover:bg-cyan-600 active:scale-95 shadow-glow-cyan'
            }`}
            title="Send Message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
