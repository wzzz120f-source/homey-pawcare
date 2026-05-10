import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ChecklistItem {
  key: string;
  label: string;
}

const DEFAULT_ACTIONS: ChecklistItem[] = [
  { key: "feed_food", label: "添加宠粮" },
  { key: "clean_litter", label: "清理砂盆" },
  { key: "play", label: "陪伴互动" },
  { key: "leave", label: "离开打卡" },
];

interface CheckinRow {
  id: string;
  action_key: string;
  photo_url: string;
  exif_at: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

async function watermarkImage(file: File, lat: number | null, lng: number | null): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  // Watermark
  const ts = new Date().toLocaleString("zh-CN");
  const text1 = `📍 ${lat?.toFixed(5) ?? "—"}, ${lng?.toFixed(5) ?? "—"}`;
  const text2 = `🕒 ${ts}`;
  const fontSize = Math.max(14, Math.round(w / 40));
  ctx.font = `${fontSize}px sans-serif`;
  const padding = 12;
  const lineH = fontSize + 4;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - lineH * 2 - padding * 2, w, lineH * 2 + padding * 2);
  ctx.fillStyle = "#fff";
  ctx.fillText(text1, padding, h - lineH - padding);
  ctx.fillText(text2, padding, h - padding - 4);
  URL.revokeObjectURL(url);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

function getPos(): Promise<GeolocationPosition | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res(p),
      () => res(null),
      { timeout: 6000, enableHighAccuracy: true },
    );
  });
}

export default function ServiceCheckinChecklist({
  orderId,
  actions = DEFAULT_ACTIONS,
  onAllComplete,
}: {
  orderId: string;
  actions?: ChecklistItem[];
  onAllComplete?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_checkins")
      .select("id, action_key, photo_url, exif_at, lat, lng, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setRows((data as CheckinRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`checkins-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_checkins", filter: `order_id=eq.${orderId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const completed = new Set(rows.map((r) => r.action_key));

  const trigger = (key: string) => {
    setPendingKey(key);
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const key = pendingKey;
    setPendingKey(null);
    if (!file || !key || !user) return;
    setBusyKey(key);
    try {
      const pos = await getPos();
      const lat = pos?.coords.latitude ?? null;
      const lng = pos?.coords.longitude ?? null;
      const blob = await watermarkImage(file, lat, lng);
      const path = `${user.id}/${orderId}/${key}-${Date.now()}.jpg`;
      const up = await supabase.storage.from("service-checkins").upload(path, blob, {
        contentType: "image/jpeg",
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("service-checkins").getPublicUrl(path);
      const { error } = await supabase.from("service_checkins").insert({
        order_id: orderId,
        user_id: user.id,
        action_key: key,
        photo_url: pub.publicUrl,
        exif_at: new Date().toISOString(),
        lat,
        lng,
      });
      if (error) throw error;
      toast({ title: "打卡成功", description: actions.find((a) => a.key === key)?.label });
    } catch (err: any) {
      toast({ title: "打卡失败", description: err?.message ?? "请重试", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const allDone = actions.every((a) => completed.has(a.key));
  const missing = actions.filter((a) => !completed.has(a.key));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async () => {
    setSubmitting(true);
    const required = actions.map((a) => a.key);
    const { data, error } = await (supabase as any).rpc("complete_service_order", {
      _order_id: orderId,
      _required: required,
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (error || !data?.success) {
      toast({
        title: "无法完成订单",
        description:
          data?.error === "checkin_incomplete"
            ? `缺少打卡：${(data.missing ?? []).join(", ")}`
            : error?.message ?? "请检查打卡是否齐全",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "服务已完成" });
    onAllComplete?.();
  };

  return (
    <div className="rounded-2xl bg-card p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          服务打卡
        </h3>
        <span className="text-xs text-muted-foreground">
          {completed.size}/{actions.length} 已完成
        </span>
      </div>

      {!allDone && missing.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-700 dark:text-amber-300">还差 {missing.length} 项才能结单</p>
            <p className="text-amber-700/80 dark:text-amber-300/80 mt-0.5">
              缺少：{missing.map((m) => m.label).join("、")}
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">加载中…</p>
      ) : (
        <ul className="space-y-2">
          {actions.map((a) => {
            const row = rows.find((r) => r.action_key === a.key);
            const done = !!row;
            return (
              <li key={a.key} className="flex items-center gap-3 rounded-xl border p-2.5 bg-background">
                {done ? (
                  <img src={row!.photo_url} alt={a.label} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    {a.label}
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <span className="text-[10px] text-amber-600 font-normal">待完成</span>
                    )}
                  </p>
                  {done && row?.lat != null && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {row.lat.toFixed(4)}, {row.lng?.toFixed(4)} · {new Date(row.created_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={done ? "outline" : "hero"}
                  onClick={() => trigger(a.key)}
                  disabled={busyKey === a.key}
                >
                  {busyKey === a.key ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? "重拍" : "拍照打卡"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        className="w-full mt-4"
        variant="hero"
        disabled={!allDone}
        onClick={() => setConfirmOpen(true)}
      >
        {allDone ? "全部完成 · 提交结单" : `还差 ${missing.length} 项可结单`}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交结单？</AlertDialogTitle>
            <AlertDialogDescription>
              提交后订单将标记为已完成，宠主会收到结单通知。请确认所有 {actions.length} 项打卡照片均真实有效。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再检查一下</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              确认结单
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
