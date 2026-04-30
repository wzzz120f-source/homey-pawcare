import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, ArrowLeft, Bot, Sparkles, Loader2, Trash2, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { consumeHandoffContext, type HandoffContext } from "@/lib/bookingDraft";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DbMessage {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

const QUICK_QUESTIONS = [
  "退款政策是什么？",
  "发货需要多久？",
  "有什么宠物护理建议？",
  "推荐一些热门商品",
];

const CustomerServicePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [handoff, setHandoff] = useState<HandoffContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pick up any handoff context saved by the booking / hotel pages.
  useEffect(() => {
    const ctx = consumeHandoffContext();
    if (ctx) setHandoff(ctx);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Load conversation history
  useEffect(() => {
    if (!user) return;
    const loadHistory = async () => {
      // Find or create conversation
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      let convId: string;
      if (existing && existing.length > 0) {
        convId = existing[0].id;
      } else {
        const { data: newConv } = await supabase
          .from("chat_conversations")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (!newConv) { setLoadingHistory(false); return; }
        convId = newConv.id;
      }
      setConversationId(convId);

      // Load messages
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at");

      if (msgs && msgs.length > 0) {
        const restored: Message[] = msgs
          .filter((m: DbMessage) => m.sender_type === "user" || m.sender_type === "assistant")
          .map((m: DbMessage) => ({
            role: m.sender_type as "user" | "assistant",
            content: m.content,
          }));
        setMessages(restored);
      }
      setLoadingHistory(false);
    };
    loadHistory();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const persistMessage = async (role: "user" | "assistant", content: string) => {
    if (!conversationId || !user) return;
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_type: role,
      content,
    });
  };

  const handleClearHistory = async () => {
    if (!conversationId || !user) return;
    // Delete messages from DB
    await supabase.from("chat_messages").delete().eq("conversation_id", conversationId);
    setMessages([]);
    toast.success("聊天记录已清空");
  };

  const sendMessage = async (content?: string) => {
    const text = (content || input).trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsStreaming(true);

    // Persist user message
    await persistMessage("user", text);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("请求过于频繁，请稍后再试");
        else if (resp.status === 402) toast.error("AI服务额度不足");
        else toast.error(errData.error || "AI服务暂时不可用");
        setIsStreaming(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsertAssistant(c);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Persist assistant response
      if (assistantSoFar) {
        await persistMessage("assistant", assistantSoFar);
      }
    } catch (e) {
      console.error(e);
      toast.error("连接AI服务失败，请稍后重试");
    } finally {
      setIsStreaming(false);
    }
  };

  if (authLoading || loadingHistory) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">爪爪管家 · AI客服</h1>
            <p className="text-xs text-muted-foreground">智能助手 · 随时为您服务</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
            title="清空聊天记录"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-bold text-foreground mb-1">您好！我是爪爪管家 🐾</h2>
            <p className="text-sm text-muted-foreground">AI智能客服，有任何问题都可以问我~</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              )}
              <Card className={`max-w-[80%] ${isUser ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <CardContent className="p-3">
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap text-primary-foreground">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <Card className="bg-card">
              <CardContent className="p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">思考中...</span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Quick Questions */}
      <div className="px-4 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {QUICK_QUESTIONS.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="whitespace-nowrap shrink-0 text-xs rounded-full"
              onClick={() => sendMessage(q)}
              disabled={isStreaming}
            >
              {q}
            </Button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 flex gap-2 bg-background">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="输入消息..."
          className="flex-1 rounded-full"
          disabled={isStreaming}
        />
        <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || isStreaming} className="rounded-full shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CustomerServicePage;
