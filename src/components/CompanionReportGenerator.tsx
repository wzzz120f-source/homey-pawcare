import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Download, ImagePlus, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  petName: string;
  sitterName?: string;
  /** 默认勾选项 */
  defaultActions?: string[];
  /** 绑定到具体订单：如提供则自动加载并保存历史记录 */
  orderId?: string;
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

const CompanionReportGenerator = ({ petName, sitterName, defaultActions = [], orderId }: Props) => {
  const [actions, setActions] = useState<string[]>(defaultActions);
  const [extra, setExtra] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>(""); // 已上传后的公网 URL（用于持久化）
  const [photoPreview, setPhotoPreview] = useState<string>(""); // 渲染预览（可能是 blob 或 url）
  const [diary, setDiary] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posterUrl, setPosterUrl] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        const r = data as any;
        setReportId(r.id);
        setActions(r.actions || []);
        setExtra(r.extra || "");
        if (r.photo_url) {
          setPhotoUrl(r.photo_url);
          setPhotoPreview(r.photo_url);
        }
        if (r.diary) setDiary(r.diary);
        if (r.poster_url) setPosterUrl(r.poster_url);
      }
    })();
  }, [orderId]);

  const toggle = (a: string) =>
    setActions((arr) => (arr.includes(a) ? arr.filter((x) => x !== a) : [...arr, a]));

  // 持久化到 companion_reports（upsert by order_id）
  const persist = async (patch: Record<string, any>) => {
    if (!orderId) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    setSaving(true);
    try {
      const payload = {
        order_id: orderId,
        user_id: uid,
        actions,
        extra,
        photo_url: photoUrl || null,
        diary: diary || null,
        poster_url: posterUrl || null,
        ...patch,
      };
      const { data, error } = await supabase
        .from("companion_reports" as any)
        .upsert(payload, { onConflict: "order_id" })
        .select()
        .single();
      if (error) throw error;
      if (data) setReportId((data as any).id);
    } catch (e: any) {
      console.warn("companion_reports save failed", e?.message);
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("图片不能大于 5MB");
      return;
    }
    e.target.value = "";
    setPhotoPreview(URL.createObjectURL(f));

    // 上传到 Storage 以便绑定到订单持久化
    setUploading(true);
    try {
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
      setPhotoUrl(pub.publicUrl);
      if (orderId) await persist({ photo_url: pub.publicUrl });
    } catch (err: any) {
      toast.error(err?.message || "照片上传失败");
    } finally {
      setUploading(false);
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
      const { data, error } = await supabase.functions.invoke("companion-diary", {
        body: { records, pet_name: petName, sitter_name: sitterName },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const text = (data as any).diary || "";
      setDiary(text);
      toast.success("陪伴日记已生成");
      if (orderId) await persist({ diary: text });
    } catch (e: any) {
      toast.error(e?.message || "生成失败");
    } finally {
      setLoading(false);
    }
  };

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
      } catch {
        // ignore
      }
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
    toast.success("海报已生成，长按保存");

    // 上传海报并持久化
    if (orderId) {
      try {
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png", 0.92));
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id || "anon";
        const path = `companion-poster/${uid}/${orderId}/${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
          upsert: true,
          contentType: "image/png",
        });
        if (!upErr) {
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          setPosterUrl(pub.publicUrl);
          await persist({ poster_url: pub.publicUrl });
        }
      } catch (e) {
        console.warn("poster upload failed", e);
      }
    }
  };

  // 勾选项 / 补充文字变化时也实时同步
  const handleToggle = async (a: string) => {
    toggle(a);
    if (orderId) {
      const next = actions.includes(a) ? actions.filter((x) => x !== a) : [...actions, a];
      await persist({ actions: next });
    }
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

  return (
    <div className="space-y-4">
      <div className="bg-card card-shadow rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">今日服务记录</h3>
          {orderId && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {saving ? "保存中…" : reportId ? "已绑定订单" : "未保存"}
            </span>
          )}
        </div>

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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPhoto}
          />
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
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {loading ? "AI 撰写中…" : "✨ 生成 AI 陪伴日记"}
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
