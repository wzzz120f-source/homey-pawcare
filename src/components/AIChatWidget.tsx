import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const QUICK = [
  "我想预约上门洗澡 🐶",
  "宠物寄养怎么收费？",
  "我要预约接送服务 🚗",
  "技师都有哪些资质？",
];

const HIDE_ON = ["/auth", "/customer-service"];

const AIChatWidget = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "你好呀～我是 **爪爪管家** 🐾\n可以帮你解答 **上门服务 / 寄养 / 接送** 相关问题，并引导你完成预约。试试下方的快捷问题吧 ✨",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (HIDE_ON.some((p) => location.pathname.startsWith(p))) return null;

  const send = async (text: string, attempt = 0) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const next: Msg[] = attempt === 0 ? [...messages, { role: "user", content: trimmed }] : messages;
    if (attempt === 0) {
      setMessages(next);
      setInput("");
    }
    setStreaming(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content !== "...thinking") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    const showFallbackMessage = (note: string) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            `⚠️ ${note}\n\n你可以：\n- 点击下方「**完整客服**」转人工\n- 或直接前往对应预约页面（首页·服务 / 宠物酒店 / 接送预约）\n- 系统会保留你的对话上下文，稍后可重试`,
        },
      ]);
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });
      if (resp.status === 429) {
        toast.error("请求过于频繁，已为你提供人工客服入口");
        showFallbackMessage("AI 当前请求过于频繁。");
        setStreaming(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI 额度不足，已为你提供人工客服入口");
        showFallbackMessage("AI 服务额度不足，请联系管理员或转人工客服。");
        setStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("AI 服务暂时不可用");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      // Auto-retry once for transient network errors
      if (attempt < 1) {
        setStreaming(false);
        await new Promise((r) => setTimeout(r, 600));
        return send(text, attempt + 1);
      }
      toast.error(e instanceof Error ? e.message : "网络异常");
      showFallbackMessage("AI 暂时无法响应。");
    } finally {
      setStreaming(false);
    }
  };

  const goBook = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          aria-label="打开 AI 客服"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform md:bottom-6"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent animate-pulse" />
        </button>
      )}

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end md:p-4 bg-background/40 backdrop-blur-sm">
          <div
            className="w-full md:w-[380px] h-[80vh] md:h-[600px] bg-card rounded-t-2xl md:rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
            role="dialog"
            aria-label="AI 客服对话"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">爪爪管家 · AI 客服</div>
                  <div className="text-[11px] opacity-80 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> 在线 · 解答与预约引导
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="h-8 w-8 rounded-full hover:bg-primary-foreground/15 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted/20">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border rounded-tl-sm"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_strong]:text-primary">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> 正在思考…
                </div>
              )}

              {/* Quick chips on first turn */}
              {messages.length <= 1 && !streaming && (
                <div className="flex flex-wrap gap-2 px-1 pt-1">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:bg-accent/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick booking shortcuts */}
            <div className="flex gap-1.5 px-3 py-2 border-t border-border bg-card overflow-x-auto">
              <button
                onClick={() => goBook("/booking")}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              >
                去预约上门
              </button>
              <button
                onClick={() => goBook("/pet-hotel")}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              >
                去预约寄养
              </button>
              <button
                onClick={() => goBook("/booking?type=pickup")}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              >
                去预约接送
              </button>
              <button
                onClick={() => goBook("/customer-service")}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
              >
                完整客服
              </button>
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 p-3 border-t border-border bg-card"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入问题，例如：我想预约明天的上门洗澡"
                disabled={streaming}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
