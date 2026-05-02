import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineEvent {
  id: string;
  event_type: string;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  occurred_at: string;
}

const EVENT_META: Record<string, { emoji: string; label: string }> = {
  arrived: { emoji: "🚪", label: "到达进门" },
  sanitized: { emoji: "🧴", label: "已消毒换鞋" },
  feeding: { emoji: "🍱", label: "进食中" },
  cleaning: { emoji: "🧹", label: "铲屎完成" },
  playing: { emoji: "🎾", label: "陪玩中" },
  walking: { emoji: "🦮", label: "外出遛弯" },
  resting: { emoji: "😴", label: "休息中" },
  leaving: { emoji: "👋", label: "服务结束" },
  photo: { emoji: "📸", label: "照片更新" },
};

interface Props {
  orderId: string;
}

const ServiceTimeline = ({ orderId }: Props) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("service_timeline_events")
        .select("id, event_type, description, media_url, media_type, occurred_at")
        .eq("order_id", orderId)
        .order("occurred_at", { ascending: true });
      if (!mounted) return;
      setEvents((data as TimelineEvent[]) || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`timeline-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_timeline_events", filter: `order_id=eq.${orderId}` },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as TimelineEvent]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm" aria-label="云陪伴时间轴">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <span aria-hidden="true">📡</span> 云陪伴实况
        </h3>
        <span className="text-[10px] flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          实时同步中
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
          宠托师到达后会开始记录服务进展
        </div>
      ) : (
        <ol className="relative border-l-2 border-primary/20 ml-2 space-y-4">
          {events.map((e, i) => {
            const meta = EVENT_META[e.event_type] || { emoji: "🐾", label: e.event_type };
            const isLast = i === events.length - 1;
            return (
              <li key={e.id} className="ml-4 relative">
                <span
                  className={`absolute -left-[1.4rem] flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                    isLast ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse" : "bg-muted"
                  }`}
                  aria-hidden="true"
                >
                  {isLast ? <CheckCircle2 className="w-3.5 h-3.5" /> : meta.emoji}
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    <span className="mr-1">{meta.emoji}</span>
                    {meta.label}
                  </p>
                  <time className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(e.occurred_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
                {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
                {e.media_url && e.media_type === "image" && (
                  <img
                    src={e.media_url}
                    alt={meta.label}
                    className="mt-2 rounded-lg w-32 h-32 object-cover border"
                    loading="lazy"
                  />
                )}
                {e.media_url && e.media_type === "video" && (
                  <video src={e.media_url} controls className="mt-2 rounded-lg w-48 border" />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default ServiceTimeline;
