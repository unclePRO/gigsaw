'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Send,
  MessageSquare,
  Users,
  Sparkles,
  RefreshCw,
  CheckCheck,
  Bot,
  User,
  ShieldCheck,
} from 'lucide-react';
import { IChatMessage } from '@/types';

interface EmbeddedProjectChatProps {
  projectId: string;
  projectName: string;
  className?: string;
}

export const EmbeddedProjectChat: React.FC<EmbeddedProjectChatProps> = ({
  projectId,
  projectName,
  className = '',
}) => {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [participants, setParticipants] = useState<{ name: string; role: string; email: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
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
      console.warn('Chat fetch warning:', err);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchChat().finally(() => {
      setLoading(false);
      scrollToBottom('auto');
    });

    // Real-time polling every 3.5 seconds
    const interval = setInterval(fetchChat, 3500);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

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
      console.error('AI chat assist failed:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const currentUserEmail = session?.user?.email?.toLowerCase();

  return (
    <div className={`bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col h-[560px] shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7] flex items-center justify-center font-bold">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Team Project Chat
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Live room" />
            </div>
            <p className="text-[10px] text-slate-400">
              Active for merchant & all invited talent &bull; Open before & after acceptance
            </p>
          </div>
        </div>

        {/* AI Quick Kickoff */}
        <button
          type="button"
          disabled={isAiGenerating}
          onClick={() => handleAiAssist('kickoff')}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
          title="Ask AI coordinator to kick off discussion"
        >
          {isAiGenerating ? (
            <RefreshCw className="w-3 h-3 animate-spin text-purple-500" />
          ) : (
            <Sparkles className="w-3 h-3 text-purple-500" />
          )}
          <span>{isAiGenerating ? 'AI Coordinating...' : 'AI Kickoff'}</span>
        </button>
      </div>

      {/* Participants Bar */}
      {participants.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-900/30 flex items-center gap-1.5 overflow-x-auto text-[10px]">
          <span className="text-slate-400 shrink-0 font-medium">Team:</span>
          {participants.map((p, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap shrink-0 border border-slate-200/60 dark:border-slate-700/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>{p.name}</span>
              <span className="text-slate-400 text-[8px] uppercase font-bold">({p.role})</span>
            </span>
          ))}
        </div>
      )}

      {/* Message List */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30 dark:bg-[#0A101D]/50 text-xs"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
            <span className="text-[11px]">Connecting to team chat room...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Welcome to the Team Chat!
            </p>
            <p className="text-[11px] max-w-xs text-slate-400">
              Your invited specialists can read and reply to messages right here before accepting their invitations.
            </p>
            <button
              type="button"
              onClick={() => handleAiAssist('kickoff')}
              className="mt-2 px-3 py-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Post AI Kickoff Message</span>
            </button>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderEmail?.toLowerCase() === currentUserEmail;
            const isAi = msg.senderRole === 'ai_assistant';
            const isMerchant = msg.senderRole === 'merchant';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAi ? 'items-center my-3' : isMe ? 'items-end' : 'items-start'}`}
              >
                {isAi ? (
                  <div className="max-w-md w-full bg-purple-500/10 dark:bg-purple-950/30 border border-purple-500/20 rounded-2xl p-3 text-[11px] text-purple-900 dark:text-purple-200 space-y-1 shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-300">
                      <Bot className="w-3.5 h-3.5" />
                      <span>{msg.senderName}</span>
                      <span className="text-[9px] text-purple-400 font-normal ml-auto">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
                      {msg.message}
                    </p>
                  </div>
                ) : (
                  <div className={`max-w-[85%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span
                        className={`text-[8px] uppercase font-black px-1.5 py-0.2 rounded ${
                          isMerchant
                            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                            : 'bg-[#E5F5F1] dark:bg-[#254542] text-[#168C80] dark:text-[#73D8C7]'
                        }`}
                      >
                        {msg.senderRole}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                        isMe
                          ? 'bg-cyan-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#1B3B39] flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Message project team (visible to all invited specialists)..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={sending}
          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="p-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
          title="Send message"
        >
          {sending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </form>
    </div>
  );
};
