import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface Conv {
  id: string;
  user_id: string;
  peer_id: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_user: number;
  unread_peer: number;
  order_id: string | null;
}

interface Profile {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chat_conversations")
        .select("id, user_id, peer_id, last_message, last_message_at, unread_user, unread_peer, order_id")
        .or(`user_id.eq.${user.id},peer_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const list = (data as Conv[]) ?? [];
      setConvs(list);
      const ids = Array.from(new Set(list.map((c) => (c.user_id === user.id ? c.peer_id : c.user_id)).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: pf } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
        const map: Record<string, Profile> = {};
        (pf ?? []).forEach((p: any) => (map[p.user_id] = p));
        setProfiles(map);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("messages-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1">消息</h1>
      </header>

      <main className="max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">加载中…</p>
        ) : convs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <MessageCircle className="w-12 h-12 opacity-40" />
            <p className="text-sm">暂无消息，从订单或服务者主页开启聊天</p>
          </div>
        ) : (
          <ul className="divide-y">
            {convs.map((c) => {
              const peerId = c.user_id === user.id ? c.peer_id : c.user_id;
              const unread = c.user_id === user.id ? c.unread_user : c.unread_peer;
              const peer = peerId ? profiles[peerId] : undefined;
              return (
                <li key={c.id}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left"
                    onClick={() => navigate(`/chat/${c.id}`)}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden">
                      {peer?.avatar_url ? (
                        <img src={peer.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        peer?.username?.[0] ?? "宠"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate">{peer?.username ?? "服务者"}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.last_message ?? "开始聊天吧"}</p>
                    </div>
                    {unread > 0 && <Badge className="bg-destructive text-destructive-foreground">{unread}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
