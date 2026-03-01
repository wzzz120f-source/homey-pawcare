import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, ArrowLeft, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Message {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

const AUTO_REPLIES: Record<string, string> = {
  "你好": "您好！欢迎来到宠物商城客服中心，请问有什么可以帮您的？😊",
  "退款": "关于退款，我们支持7天无理由退换货。请您提供订单号，我们会尽快为您处理。",
  "发货": "一般情况下，您的订单会在付款后48小时内发货，您可以在订单详情中查看物流信息。",
  "质量": "我们所有商品均经过严格质检。如您收到的商品有质量问题，请拍照联系我们，我们会第一时间为您处理。",
};

const getAutoReply = (content: string): string => {
  for (const [keyword, reply] of Object.entries(AUTO_REPLIES)) {
    if (content.includes(keyword)) return reply;
  }
  return "感谢您的咨询！客服人员将尽快回复您。您也可以查看我们的常见问题：退款政策、发货时间、商品质量保障等。";
};

const CustomerServicePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) initConversation();
  }, [user]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const initConversation = async () => {
    if (!user) return;
    // Find existing conversation
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
      if (!newConv) return;
      convId = newConv.id;
    }
    setConversationId(convId);

    // Load existing messages
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at");
    if (msgs) setMessages(msgs);

    // Send welcome message if empty
    if (!msgs || msgs.length === 0) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        sender_type: "system",
        content: "您好！欢迎来到宠物商城客服中心 🐾\n有任何问题都可以直接发送消息，我们将竭诚为您服务！",
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_type: "user",
      content,
    });

    // Auto reply after a short delay
    setTimeout(async () => {
      await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_type: "service",
        content: getAutoReply(content),
      });
      setSending(false);
    }, 800);
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">加载中...</div>;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-base font-bold text-foreground">在线客服</h1>
          <p className="text-xs text-muted-foreground">通常在 1 分钟内回复</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isUser = msg.sender_type === "user";
          const isSystem = msg.sender_type === "system";
          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <Card className={`max-w-[75%] ${isUser ? "bg-primary text-primary-foreground" : isSystem ? "bg-muted" : "bg-card"}`}>
                <CardContent className="p-3">
                  <p className={`text-sm whitespace-pre-wrap ${isUser ? "text-primary-foreground" : "text-foreground"}`}>
                    {msg.content}
                  </p>
                  <p className={`text-[10px] mt-1 ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Quick replies */}
      <div className="px-4 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["退款政策", "发货时间", "质量问题"].map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="whitespace-nowrap shrink-0 text-xs rounded-full"
              onClick={() => { setInput(q); }}
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
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="输入消息..."
          className="flex-1 rounded-full"
        />
        <Button size="icon" onClick={sendMessage} disabled={!input.trim() || sending} className="rounded-full shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default CustomerServicePage;
