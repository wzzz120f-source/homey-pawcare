import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Sparkles,
  Download,
  ImagePlus,
  Camera,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  petName: string;
  sitterName?: string;
  defaultActions?: string[];
  /** 绑定到具体订单：如提供则自动加载并保存历史记录 */
  orderId?: string;
  /** 当持久化数据变化时，把最新报告推给父组件展示历史 */
  onSavedChange?: (report: SavedReport | null) => void;
}

export interface SavedReport {
  id: string;
  actions: string[];
  extra: string | null;
  photo_url: string | null;
  diary: string | null;
  poster_url: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_ACTIONS = [
  "🥣 按时喂食",
  "💧 更换饮水",
  "🚽 清理猫砂 / 便便",
  "🐾 散步遛弯",
  "🛁 简单清洁",
  "❤️ 陪伴抚摸",
];

const BUCKET = "review-media";

// 通用重试：指数退避，默认 3 次
async function withRetry<T>(fn: () => Promise<T>, label: string, max = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      console.warn(`[${label}] 第 ${i + 1} 次失败：`, e?.message || e);
      if (i < max - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

const CompanionReportGenerator = ({
  petName,
  sitterName,
  defaultActions = [],
  orderId,
  onSavedChange,
}: Props) => {
  const [actions, setActions] = useState<string[]>(defaultActions);
  const [extra, setExtra] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [diary, setDiary] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posterUrl, setPosterUrl] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastError, setLastError] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPosterBlob, setPendingPosterBlob] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hydrate = (r: SavedReport | null) => {
    if (!r) return;
    setReportId(r.id);
    setActions(r.actions || []);
    setExtra(r.extra || "");
    if (r.photo_url) {
      setPhotoUrl(r.photo_url);
      setPhotoPreview(r.photo_url);
    }
    setDiary(r.diary || "");
    setPosterUrl(r.poster_url || "");
    setLastSavedAt(r.updated_at);
  };

  // 加载已保存的陪伴报告
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data } = await supabase
        .from("companion_reports" as any)
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data) {
        const r = data as unknown as SavedReport;
        hydrate(r);
        onSavedChange?.(r);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const toggle = (a: string) =>
    setActions((arr) => (arr.includes(a) ? arr.filter((x) => x !== a) : [...arr, a]));

  // 持久化（带重试）
  const persist = useCallback(
    async (patch: Record<string, any>): Promise<SavedReport | null> => {
      if (!orderId) return null;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      setSaveState("saving");
      try {
        const payload: any = {
          order_id: orderId,
          user_id: uid,
          actions,
          extra,
          photo_url: photoUrl || null,
          diary: diary || null,
          poster_url: posterUrl || null,
          ...patch,
        };
        const data = await withRetry(async () => {
          const { data, error } = await supabase
            .from("companion_reports" as any)
            .upsert(payload, { onConflict: "order_id" })
            .select()
            .single();
          if (error) throw error;
          return data as unknown as SavedReport;
        }, "companion_reports.upsert");
        setReportId(data.id);
        setLastSavedAt(data.updated_at);
        setSaveState("saved");
        setLastError("");
        onSavedChange?.(data);
        return data;
      } catch (e: any) {
        setSaveState("error");
        setLastError(e?.message || "保存失败");
        toast.error("保存失败：" + (e?.message || "网络异常，可点击重试"));
        return null;
      }
    },
    [orderId, actions, extra, photoUrl, diary, posterUrl, onSavedChange]
  );

  const uploadPhoto = useCallback(
    async (f: File): Promise<string> => {
      setUploading(true);
      try {
        const url = await withRetry(async () => {
          const { data: auth } = await supabase.auth.getUser();
          const uid = auth.user?.id || "anon";
          const ext = f.name.split(".").pop() || "jpg";
          const path = `companion/${uid}/${orderId || "free"}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
            upsert: true,
            contentType: f.type,
          });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          return pub.publicUrl;
        }, "photo.upload");
        setPhotoUrl(url);
        setPendingFile(null);
        if (orderId) await persist({ photo_url: url });
        toast.success("照片已上传并入库");
        return url;
      } finally {
        setUploading(false);
      }
    },
    [orderId, persist]
  );

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("图片不能大于 5MB");
      return;
    }
    e.target.value = "";
    setPhotoPreview(URL.createObjectURL(f));
    setPendingFile(f);
    try {
      await uploadPhoto(f);
    } catch (err: any) {
      toast.error("照片上传失败：" + (err?.message || "可点击重试"));
    }
  };

  const retryPhotoUpload = async () => {
    if (!pendingFile) return;
    try {
      await uploadPhoto(pendingFile);
    } catch (err: any) {
      toast.error("重试失败：" + (err?.message || ""));
    }
  };

  const generateDiary = async () => {
    if (actions.length === 0 && !extra.trim()) {
      toast.error("请至少勾选一项或填写补充记录");
      return;
    }
    setLoading(true);
    try {
      const records = [...actions, ...(extra.trim() ? [extra.trim()] : [])];
      const text = await withRetry(async () => {
        const { data, error } = await supabase.functions.invoke("companion-diary", {
          body: { records, pet_name: petName, sitter_name: sitterName },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        return ((data as any).diary || "") as string;
      }, "companion-diary");
      setDiary(text);
      toast.success("陪伴日记已生成");
      if (orderId) await persist({ diary: text });
    } catch (e: any) {
      toast.error(e?.message || "生成失败，可重试");
    } finally {
      setLoading(false);
    }
  };

  const uploadPoster = useCallback(
    async (blob: Blob): Promise<string> => {
      const url = await withRetry(async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id || "anon";
        const path = `companion-poster/${uid}/${orderId || "free"}/${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
          upsert: true,
          contentType: "image/png",
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return pub.publicUrl;
      }, "poster.upload");
      setPosterUrl(url);
      setPendingPosterBlob(null);
      if (orderId) await persist({ poster_url: url });
      return url;
    },
    [orderId, persist]
  );

  const drawPoster = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 750;
    const H = 1334;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFF5EA");
    g.addColorStop(1, "#FFE6CC");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#E67E22";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText("🐾 萌宠到家 · 今日陪伴", 40, 70);
    ctx.fillStyle = "#9B6B3B";
    ctx.font = "20px sans-serif";
    ctx.fillText(new Date().toLocaleDateString("zh-CN"), 40, 105);

    let yCursor = 150;
    const photoSrc = photoUrl || photoPreview;
    if (photoSrc) {
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.crossOrigin = "anonymous";
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = photoSrc;
        });
        const ph = 600;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect?.(40, yCursor, W - 80, ph, 24);
        ctx.clip();
        ctx.drawImage(img, 40, yCursor, W - 80, ph);
        ctx.restore();
        yCursor += ph + 30;
      } catch {}
    }

    ctx.fillStyle = "#3a2410";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(`致 ${petName}`, 40, yCursor + 20);
    yCursor += 60;

    ctx.font = "26px sans-serif";
    ctx.fillStyle = "#4a3320";
    actions.slice(0, 6).forEach((a, i) => {
      ctx.fillText(`✓ ${a}`, 50, yCursor + 20 + i * 38);
    });
    yCursor += 20 + actions.slice(0, 6).length * 38 + 20;

    if (diary) {
      ctx.fillStyle = "#FFFFFF";
      const boxH = 280;
      ctx.fillRect(30, yCursor, W - 60, boxH);
      ctx.fillStyle = "#E67E22";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("📔 今日陪伴日记", 50, yCursor + 36);
      ctx.fillStyle = "#3a2410";
      ctx.font = "22px sans-serif";
      const maxW = W - 100;
      let line = "";
      let dy = yCursor + 76;
      for (const ch of diary) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxW || ch === "\n") {
          ctx.fillText(line, 50, dy);
          dy += 32;
          line = ch === "\n" ? "" : ch;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, 50, dy);
    }

    ctx.fillStyle = "#9B6B3B";
    ctx.font = "20px sans-serif";
    ctx.fillText("由 萌宠到家 · " + (sitterName || "守护者") + " 倾情陪伴", 40, H - 40);

    const dataUrl = canvas.toDataURL("image/png");
    setPosterUrl(dataUrl);
    toast.success("海报已生成");

    if (orderId) {
      try {
        const blob: Blob = await new Promise((res) =>
          canvas.toBlob((b) => res(b!), "image/png", 0.92)
        );
        setPendingPosterBlob(blob);
        await uploadPoster(blob);
      } catch (e: any) {
        toast.error("海报入库失败：" + (e?.message || "可点击重试"));
      }
    }
  };

  const retryPosterUpload = async () => {
    if (!pendingPosterBlob) return;
    try {
      await uploadPoster(pendingPosterBlob);
    } catch (err: any) {
      toast.error("重试失败：" + (err?.message || ""));
    }
  };

  const handleToggle = async (a: string) => {
    const next = actions.includes(a) ? actions.filter((x) => x !== a) : [...actions, a];
    setActions(next);
    if (orderId) await persist({ actions: next });
  };

  const handleExtraBlur = async () => {
    if (orderId) await persist({ extra });
  };

  const downloadPoster = () => {
    if (!posterUrl) return;
    const a = document.createElement("a");
    a.href = posterUrl;
    a.download = `companion-${Date.now()}.png`;
    a.click();
  };

  // 一键清空（删除已保存记录 + 本地状态）
  const clearReport = async () => {
    if (!confirm("确认清空已保存的陪伴报告？此操作不可恢复。")) return;
    if (orderId && reportId) {
      try {
        const { error } = await supabase
          .from("companion_reports" as any)
          .delete()
          .eq("order_id", orderId);
        if (error) throw error;
        toast.success("已清空陪伴报告");
      } catch (e: any) {
        toast.error("清空失败：" + (e?.message || ""));
        return;
      }
    }
    setReportId(null);
    setActions(defaultActions);
    setExtra("");
    setPhotoUrl("");
    setPhotoPreview("");
    setDiary("");
    setPosterUrl("");
    setLastSavedAt(null);
    setSaveState("idle");
    onSavedChange?.(null);
  };

  // 重新生成（保留勾选项与照片，清空 AI 日记 + 海报）
  const resetForRegenerate = () => {
    setDiary("");
    setPosterUrl("");
    if (orderId) persist({ diary: null, poster_url: null });
  };

  const StatusIndicator = () => {
    if (!orderId) return null;
    const map: Record<SaveState, { icon: any; cls: string; text: string }> = {
      idle: { icon: CloudUpload, cls: "text-muted-foreground", text: reportId ? "已绑定订单" : "尚未保存" },
      saving: { icon: Loader2, cls: "text-primary animate-spin", text: "保存中…" },
      saved: { icon: CheckCircle2, cls: "text-green-600", text: lastSavedAt ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString("zh-CN")}` : "已保存" },
      error: { icon: AlertCircle, cls: "text-destructive", text: "保存失败，点重试" },
    };
    const m = map[saveState];
    const Icon = m.icon;
    return (
      <button
        type="button"
        onClick={() => saveState === "error" && persist({})}
        className={`ml-auto inline-flex items-center gap-1 text-[10px] ${m.cls}`}
        title={lastError || ""}
      >
        <Icon className="w-3 h-3" />
        {m.text}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-card card-shadow rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">今日服务记录</h3>
          <StatusIndicator />
        </div>

        {reportId && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
            <span>📌 该订单已存在历史报告（{actions.length} 项 · {photoUrl ? "含照片" : "无照片"} · {diary ? "已生成日记" : "未生成日记"}）</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={resetForRegenerate}>
                <RefreshCw className="w-3 h-3 mr-1" />重新生成
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={clearReport}>
                <Trash2 className="w-3 h-3 mr-1" />清空
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_ACTIONS.map((a) => (
            <label
              key={a}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                actions.includes(a) ? "bg-primary/10 border-primary" : "bg-card border-border"
              }`}
            >
              <Checkbox checked={actions.includes(a)} onCheckedChange={() => handleToggle(a)} />
              <span>{a}</span>
            </label>
          ))}
        </div>

        <Textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onBlur={handleExtraBlur}
          placeholder="补充小细节（如：今天特别活泼，蹭了我半小时…）"
          rows={2}
          maxLength={120}
        />

        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="预览" className="w-full h-44 object-cover rounded-xl" />
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="w-4 h-4 mr-1" /> {uploading ? "上传中…" : "重选"}
              </Button>
              {pendingFile && saveState === "error" && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute bottom-2 right-2"
                  onClick={retryPhotoUpload}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />重试上传
                </Button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center gap-1 text-muted-foreground"
            >
              <ImagePlus className="w-6 h-6" />
              <span className="text-sm">{uploading ? "上传中…" : "上传一张毛孩子今日照片"}</span>
            </button>
          )}
        </div>

        <Button onClick={generateDiary} disabled={loading} className="w-full" variant="hero">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          {loading ? "AI 撰写中…" : reportId && diary ? "✨ 重新生成 AI 日记" : "✨ 生成 AI 陪伴日记"}
        </Button>

        {diary && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {diary}
          </div>
        )}
      </div>

      <Button onClick={drawPoster} className="w-full" variant="outline">
        🖼️ 生成精美海报
      </Button>

      {posterUrl && (
        <div className="space-y-2">
          <img src={posterUrl} alt="陪伴海报" className="w-full rounded-2xl border border-border" />
          {pendingPosterBlob && saveState === "error" && (
            <Button onClick={retryPosterUpload} className="w-full" variant="destructive">
              <RefreshCw className="w-4 h-4 mr-1" />海报入库失败，点击重试
            </Button>
          )}
          <Button onClick={downloadPoster} className="w-full" variant="hero">
            <Download className="w-4 h-4 mr-1" /> 下载海报
          </Button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CompanionReportGenerator;
