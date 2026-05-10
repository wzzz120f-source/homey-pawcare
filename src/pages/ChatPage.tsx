import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Image as ImageIcon, MapPin, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterSensitive } from "@/lib/sensitiveWords";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  media_url: string | null;
  lat: number | null;
  lng: number | null;
  location_address: string | null;
  created_at: string;
  read_at: string | null;
}

interface Conv {
  id: string;
  user_id: string;
  peer_id: string | null;
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [conv, setConv] = useState<Conv | null>(null);
  const [peerName, setPeerName] = useState<string>("聊天");
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    const load = async () => {
      const { data: c } = await supabase
        .from("chat_conversations")
        .select("id, user_id, peer_id")
        .eq("id", id)
        .maybeSingle();
      if (!c || cancelled) return;
      setConv(c as Conv);
      const peerId = c.user_id === user.id ? c.peer_id : c.user_id;
      if (peerId) {
        const { data: p } = await supabase.from("profiles").select("username").eq("user_id", peerId).maybeSingle();
        if (p) {
          setPeerName((p as any).username ?? "聊天");
          setPeerPhone(null);
        }
      }
      const { data: m } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, sender_id, message_type, content, media_url, lat, lng, location_address, created_at, read_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMsgs((m as Msg[]) ?? []);
      await (supabase as any).rpc("mark_conversation_read", { _conv_id: id });
    };
    load();
    const ch = supabase
      .channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        setMsgs((prev) => [...prev, payload.new as Msg]);
        (supabase as any).rpc("mark_conversation_read", { _conv_id: id });
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async (payload: Partial<Msg>) => {
    if (!id || !user) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: id,
      sender_id: user.id,
      sender_type: "user",
      content: payload.content ?? "",
      message_type: payload.message_type ?? "text",
      media_url: payload.media_url ?? null,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      location_address: payload.location_address ?? null,
    });
    setSending(false);
    if (error) toast({ title: "发送失败", description: error.message, variant: "destructive" });
  };

  const sendText = async () => {
    const raw = text.trim();
    if (!raw) return;
    const { clean, hit, words } = filterSensitive(raw);
    if (hit) toast({ title: "已过滤敏感词", description: words.join("、") });
    setText("");
    await send({ message_type: "text", content: clean });
  };

  const sendImage = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type });
    if (up.error) {
      toast({ title: "上传失败", description: up.error.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    await send({ message_type: "image", content: "[图片]", media_url: data.publicUrl });
  };

  const sendLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "设备不支持定位", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => send({ message_type: "location", content: "[位置]", lat: p.coords.latitude, lng: p.coords.longitude, location_address: "当前位置" }),
      () => toast({ title: "定位失败", variant: "destructive" }),
      { timeout: 6000 },
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1 truncate">{peerName}</h1>
        {peerPhone && (
          <a href={`tel:${peerPhone}`} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="拨打">
            <Phone className="w-5 h-5 text-primary" />
          </a>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-card border",
                )}
              >
                {m.message_type === "image" && m.media_url ? (
                  <img src={m.media_url} alt="img" className="rounded-lg max-w-full" />
                ) : m.message_type === "location" && m.lat != null ? (
                  <a
                    href={`https://uri.amap.com/marker?position=${m.lng},${m.lat}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 underline"
                  >
                    <MapPin className="w-4 h-4" />
                    {m.location_address || `${m.lat?.toFixed(4)}, ${m.lng?.toFixed(4)}`}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
                <p className={cn("text-[10px] mt-1 opacity-60", mine ? "text-right" : "")}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <footer className="sticky bottom-0 bg-card border-t px-3 py-2 flex items-center gap-2 shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) sendImage(f);
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg hover:bg-muted" aria-label="图片">
          <ImageIcon className="w-5 h-5" />
        </button>
        <button onClick={sendLocation} className="p-2 rounded-lg hover:bg-muted" aria-label="位置">
          <MapPin className="w-5 h-5" />
        </button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText();
            }
          }}
          placeholder="说点什么…"
          className="flex-1"
        />
        <Button size="sm" onClick={sendText} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </footer>
    </div>
  );
}
