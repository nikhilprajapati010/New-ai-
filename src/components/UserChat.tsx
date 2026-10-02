import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Sparkles, Copy, Check } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
}

export const UserChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "model",
      content: "Hello! I am Vanguard AI. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isReplying]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isReplying) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: textToSend,
    };

    const assistantId = `msg-${Date.now() + 1}`;
    const initialAssistantMessage: Message = {
      id: assistantId,
      role: "model",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setInput("");
    setIsReplying(true);

    try {
      const history = messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          message: textToSend,
          replayToken: `chat-${Date.now()}`,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response stream body available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.substring(6));
              if (payload.chunk) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: msg.content + payload.chunk }
                      : msg
                  )
                );
              } else if (payload.error) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content:
                            msg.content ||
                            `Vanguard AI encountered an issue: ${payload.error}`,
                        }
                      : msg
                  )
                );
              }
            } catch (err) {
              // Ignore partial JSON parse errors in stream
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Vanguard stream chat error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId && !msg.content
            ? {
                ...msg,
                content: `Vanguard AI encountered an issue: ${err.message}`,
              }
            : msg
        )
      );
    } finally {
      setIsReplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const starterSuggestions = [
    "How does Vanguard AI handle 503 and 429 API errors?",
    "Explain the 24/7 continuous file watcher and background testing loop",
    "What is the priority order of the dynamic model routing chain?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-5 pb-6">
        {messages.map((message) => {
          const isUser = message.role === "user";
          // If this is an assistant message still awaiting its first chunk
          const isEmptyAssistant = !isUser && message.content === "";

          if (isEmptyAssistant && isReplying) {
            return (
              <div key={message.id} className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-300 text-sm flex items-center space-x-2.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.4s]"></span>
                  <span className="text-xs font-medium text-slate-300">
                    Vanguard AI is replying...
                  </span>
                </div>
              </div>
            );
          }

          if (isEmptyAssistant) return null;

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative group max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-900 border border-slate-800 text-slate-200"
                }`}
              >
                {!isUser && (
                  <div className="text-xs font-semibold text-cyan-400 mb-1 font-sans">
                    Vanguard AI
                  </div>
                )}

                <div className="whitespace-pre-wrap font-sans text-slate-100">
                  {message.content}
                </div>

                {/* Copy Button */}
                {!isUser && (
                  <button
                    onClick={() => handleCopy(message.content, message.id)}
                    className="absolute top-2 right-2 p-1 rounded-md text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Copy response"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts */}
      {messages.length <= 2 && (
        <div className="mb-4">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 mb-2 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vanguard AI prompts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {starterSuggestions.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="text-left px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-lg focus-within:border-slate-700 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Vanguard AI anything..."
          rows={1}
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none outline-none"
        />
        <div className="flex items-center justify-end px-2 pt-1">
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isReplying}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              input.trim() && !isReplying
                ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
