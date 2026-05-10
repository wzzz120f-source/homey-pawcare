import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Image as ImageIcon, MapPin, Phone, PhoneCall, Loader2, Mic, Square, AlertTriangle, Play, Pause, RotateCcw, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { filterSensitive } from "@/lib/sensitiveWords";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  media_url: string | null;
  duration_sec: number | null;
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

const MAX_REC_SEC = 60;
const RECALL_WINDOW_MS = 30_000;

function VoicePlayer({ url, duration }: { url: string; duration: number | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        const a = ref.current!;
        if (a.paused) {
          a.play();
          setPlaying(true);
        } else {
          a.pause();
          setPlaying(false);
        }
      }}
      className="flex items-center gap-2"
    >
      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      <span className="text-xs">{Math.max(1, duration ?? 1)}″</span>
      <audio ref={ref} src={url} onEnded={() => setPlaying(false)} className="hidden" />
    </button>
  );
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setConv] = useState<Conv | null>(null);
  const [peerName, setPeerName] = useState<string>("聊天");
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [recPhase, setRecPhase] = useState<"recording" | "review">("recording");
  const [recSec, setRecSec] = useState(0);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewSec, setReviewSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const reviewBlobRef = useRef<Blob | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [blockedHint, setBlockedHint] = useState<string | null>(null);
  const [lastVoice, setLastVoice] = useState<{ id: string; sentAt: number } | null>(null);
  const [, force] = useState(0);

  // Tick to refresh recall visibility
  useEffect(() => {
    if (!lastVoice) return;
    const t = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [lastVoice]);

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
        if (p) setPeerName((p as any).username ?? "聊天");
        setPeerPhone("400-820-8888");
      }
      const { data: m } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, sender_id, message_type, content, media_url, duration_sec, lat, lng, location_address, created_at, read_at")
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
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        setMsgs((prev) => prev.filter((m) => m.id !== (payload.old as Msg).id));
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

  const send = async (payload: Partial<Msg>): Promise<string | null> => {
    if (!id || !user) return null;
    setSending(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        sender_type: "user",
        content: payload.content ?? "",
        message_type: payload.message_type ?? "text",
        media_url: payload.media_url ?? null,
        duration_sec: payload.duration_sec ?? null,
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        location_address: payload.location_address ?? null,
      })
      .select("id")
      .single();
    setSending(false);
    if (error) {
      toast({ title: "发送失败", description: error.message, variant: "destructive" });
      return null;
    }
    return (data as { id: string }).id;
  };

  const sendText = async () => {
    const raw = text.trim();
    if (!raw) return;
    const { clean, hit, words } = filterSensitive(raw);
    if (hit) {
      setBlockedHint(`已屏蔽：${words.join("、")}（请勿在站外私下交易）`);
      setTimeout(() => setBlockedHint(null), 4000);
    }
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

  const cleanupRecorder = () => {
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (recStreamRef.current) {
      recStreamRef.current.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    }
    recRef.current = null;
  };

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      reviewBlobRef.current = null;
      if (reviewUrl) {
        URL.revokeObjectURL(reviewUrl);
        setReviewUrl(null);
      }
      mr.ondataavailable = (e) => recChunksRef.current.push(e.data);
      mr.onstop = () => {
        const seconds = recSecRef.current;
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        cleanupRecorder();
        if (blob.size < 800) {
          setRecOpen(false);
          setRecSec(0);
          recSecRef.current = 0;
          toast({ title: "录音过短", description: "请说话至少 1 秒" });
          return;
        }
        reviewBlobRef.current = blob;
        setReviewSec(seconds);
        setReviewUrl(URL.createObjectURL(blob));
        setRecPhase("review");
      };
      mr.start();
      recRef.current = mr;
      setRecPhase("recording");
      setRecOpen(true);
      setRecSec(0);
      recSecRef.current = 0;
      recTimerRef.current = window.setInterval(() => {
        recSecRef.current += 1;
        setRecSec(recSecRef.current);
        if (recSecRef.current >= MAX_REC_SEC) {
          if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
        }
      }, 1000);
    } catch {
      toast({ title: "无法访问麦克风", description: "请在浏览器允许录音权限", variant: "destructive" });
    }
  };
  const recSecRef = useRef(0);

  const stopRecord = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const cancelRec = () => {
    cleanupRecorder();
    reviewBlobRef.current = null;
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    setRecOpen(false);
    setRecSec(0);
    recSecRef.current = 0;
  };

  const reRecord = () => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    reviewBlobRef.current = null;
    setReviewSec(0);
    startRecord();
  };

  const sendRecorded = async () => {
    if (!user || !reviewBlobRef.current) return;
    setUploading(true);
    const blob = reviewBlobRef.current;
    const path = `${user.id}/voice-${Date.now()}.webm`;
    const up = await supabase.storage.from("chat-media").upload(path, blob, { contentType: "audio/webm" });
    if (up.error) {
      setUploading(false);
      toast({ title: "上传失败", description: up.error.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    const newId = await send({ message_type: "voice", content: "[语音]", media_url: data.publicUrl, duration_sec: reviewSec });
    setUploading(false);
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    reviewBlobRef.current = null;
    setRecOpen(false);
    setRecSec(0);
    recSecRef.current = 0;
    if (newId) setLastVoice({ id: newId, sentAt: Date.now() });
  };

  const recallLastVoice = async () => {
    if (!lastVoice) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", lastVoice.id);
    if (error) {
      toast({ title: "撤回失败", description: error.message, variant: "destructive" });
      return;
    }
    setMsgs((prev) => prev.filter((m) => m.id !== lastVoice.id));
    setLastVoice(null);
    toast({ title: "已撤回最近一条语音" });
  };

  const canRecall = lastVoice && Date.now() - lastVoice.sentAt < RECALL_WINDOW_MS;
  const recallSecLeft = canRecall ? Math.max(0, Math.ceil((RECALL_WINDOW_MS - (Date.now() - lastVoice.sentAt)) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1 truncate">{peerName}</h1>
        <button
          onClick={() => setCallOpen(true)}
          className="p-1.5 rounded-lg hover:bg-secondary"
          aria-label="拨打电话"
        >
          <PhoneCall className="w-5 h-5 text-primary" />
        </button>
      </header>

      {blockedHint && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4" />
          {blockedHint}
        </div>
      )}

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
                ) : m.message_type === "voice" && m.media_url ? (
                  <VoicePlayer url={m.media_url} duration={m.duration_sec} />
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

      {canRecall && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 px-3 py-1.5 flex items-center justify-between text-xs">
          <span className="text-amber-700 dark:text-amber-300">
            刚发送了一条语音，可在 {recallSecLeft}s 内撤回
          </span>
          <button
            onClick={recallLastVoice}
            className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:underline"
          >
            <Undo2 className="w-3.5 h-3.5" /> 撤回
          </button>
        </div>
      )}

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
        <button onClick={startRecord} className="p-2 rounded-lg hover:bg-muted" aria-label="语音">
          <Mic className="w-5 h-5" />
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

      {/* 语音录制弹窗 */}
      <AlertDialog open={recOpen} onOpenChange={(o) => !o && cancelRec()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {recPhase === "recording" ? (
                <>
                  <Mic className="w-5 h-5 text-destructive animate-pulse" /> 正在录音…
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 text-primary" /> 试听并选择
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {recPhase === "recording" ? (
                <div className="space-y-2">
                  <p>
                    已录制 <span className="font-bold tabular-nums">{recSec}″</span> / {MAX_REC_SEC}″
                    {recSec >= MAX_REC_SEC ? "（已到时长上限）" : ""}
                  </p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (recSec / MAX_REC_SEC) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    录音长度 <span className="font-bold tabular-nums">{reviewSec}″</span>，可重录或直接发送。
                  </p>
                  {reviewUrl && (
                    <audio src={reviewUrl} controls className="w-full" />
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {recPhase === "recording" ? (
              <>
                <AlertDialogCancel onClick={cancelRec}>取消</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); stopRecord(); }}>
                  <Square className="w-4 h-4 mr-1" /> 停止
                </AlertDialogAction>
              </>
            ) : (
              <>
                <AlertDialogCancel onClick={cancelRec} disabled={uploading}>取消</AlertDialogCancel>
                <Button variant="outline" onClick={reRecord} disabled={uploading}>
                  <RotateCcw className="w-4 h-4 mr-1" /> 重录
                </Button>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); sendRecorded(); }} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                  发送
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 通话拨号弹窗（虚拟号） */}
      <AlertDialog open={callOpen} onOpenChange={setCallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" /> 拨打 {peerName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              为保护双方隐私，平台将通过虚拟号 <span className="font-mono">{peerPhone}</span> 中转转接。通话不收取额外费用，且双方真实号码不会泄露。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction asChild>
              <a href={`tel:${peerPhone}`}>立即拨打</a>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
