"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, Loader2, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "How does a savings circle work?",
  "What makes Sanctuary secure?",
  "How do I start saving with Bitcoin?",
  "What is a ROSCA?",
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-fg-muted animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

interface AiChatProps {
  open: boolean;
  onClose: () => void;
}

export function AiChat({ open, onClose }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Something went wrong. Please try again.");
        } else {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch {
        setError("Network error. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestion = (prompt: string) => {
    sendMessage(prompt);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const showWelcome = messages.length === 0 && !loading;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Chat Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sanctuary AI assistant"
        className={`fixed bottom-0 right-0 z-50 flex flex-col transition-all duration-300 ease-out
          sm:bottom-6 sm:right-6 sm:rounded-2xl
          w-full sm:w-[420px]
          h-[85dvh] sm:h-[600px]
          ${open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}
        `}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 0 0 1px rgba(245,158,11,0.1), 0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                boxShadow: "0 0 12px rgba(245,158,11,0.4)",
              }}
            >
              <Bot className="h-4 w-4" style={{ color: "#1a1206" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                Sanctuary AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                className="rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-2"
                style={{ color: "var(--color-fg-muted)" }}
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ color: "var(--color-fg-muted)" }}
              aria-label="Close AI chat"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
          {showWelcome && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,191,36,0.1))",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                <Bot className="h-7 w-7" style={{ color: "var(--color-primary)" }} />
              </div>
              <div>
                <h3
                  className="font-semibold text-base mb-1"
                  style={{ color: "var(--color-fg)" }}
                >
                  Ask me anything
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-fg-muted)" }}>
                  About savings circles, Bitcoin security,
                  <br />
                  or building better financial habits.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 w-full mt-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestion(prompt)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-fg-muted)",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="mr-2 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                  }}
                >
                  <Bot className="h-3.5 w-3.5" style={{ color: "#1a1206" }} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"
                }`}
                style={
                  msg.role === "user"
                    ? {
                        background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                        color: "#1a1206",
                      }
                    : {
                        background: "var(--color-surface-2)",
                        color: "var(--color-fg)",
                        border: "1px solid var(--color-border)",
                      }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="mr-2 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}
              >
                <Bot className="h-3.5 w-3.5" style={{ color: "#1a1206" }} />
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <TypingDots />
              </div>
            </div>
          )}

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              id="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about savings circles…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 disabled:opacity-60 transition-all"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
                maxHeight: "120px",
                scrollbarWidth: "thin",
                // @ts-expect-error CSS custom property
                "--tw-ring-color": "var(--color-ring)",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
              aria-label="Message to Sanctuary AI"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background:
                  input.trim() && !loading
                    ? "linear-gradient(135deg, #f59e0b, #fbbf24)"
                    : "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}
              aria-label="Send message"
            >
              {loading ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  style={{ color: "var(--color-fg-muted)" }}
                />
              ) : (
                <Send
                  className="h-4 w-4"
                  style={{ color: input.trim() ? "#1a1206" : "var(--color-fg-muted)" }}
                />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-xs" style={{ color: "var(--color-fg-muted)" }}>
            AI can make mistakes — always verify important financial decisions.
          </p>
        </div>
      </div>
    </>
  );
}
