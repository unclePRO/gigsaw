'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  MessageSquare,
  Send,
  X,
  Users,
  ShieldCheck,
  RefreshCw,
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

  if (!isOpen) return null;

  const currentEmail = session?.user?.email?.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl h-[560px] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 truncate max-w-sm">
                  {projectName} Group Chat
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Secured</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Users className="w-3 h-3 text-slate-400" />
                <span>
                  {participants.length} team members (Merchant & matched Specialists)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-slate-50/50">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
              <span>Loading project conversation...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-1">
              <MessageSquare className="w-8 h-8 text-slate-300 mb-1" />
              <p className="text-xs font-semibold text-slate-600">No messages in this project yet.</p>
              <p className="text-[11px] text-slate-400">
                Start the conversation with your team members about milestone deliverables or feedback.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderEmail.toLowerCase() === currentEmail;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-700">
                      {isMe ? 'You' : msg.senderName}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        msg.senderRole === 'merchant'
                          ? 'bg-royal-100 text-royal-700'
                          : 'bg-cyan-100 text-cyan-800'
                      }`}
                    >
                      {msg.senderRole}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`max-w-md px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-slate-900 text-white rounded-br-none shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Type a message to the project group..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
              !inputText.trim() || sending
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-cyan-500 hover:bg-cyan-600 shadow-sm'
            }`}
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
