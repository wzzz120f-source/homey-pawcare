import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Heart, Plus, ImageIcon, X, MapPin, Users, Calendar, Sparkles, ShieldAlert, Share2 } from "lucide-react";
import ShareCardDialog from "@/components/ShareCardDialog";
import RescueFeedDialog from "@/components/community/RescueFeedDialog";
import { toast } from "sonner";
import { checkTextSafety } from "@/lib/contentSafety";
import { tryAutoAwardBadges } from "@/hooks/useUserBadges";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  rescuing: { text: "救助中", color: "bg-status-rescue text-status-rescue-foreground" },
  treating: { text: "治疗中", color: "bg-status-treating text-status-treating-foreground" },
  recovering: { text: "康复中", color: "bg-status-recover text-status-recover-foreground" },
  adopting: { text: "待领养", color: "bg-status-adopt text-status-adopt-foreground" },
  adopted: { text: "已领养", color: "bg-status-success text-status-success-foreground" },
};

const VERIFY_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "审核中", color: "bg-muted text-muted-foreground" },
  rejected: { text: "审核未通过", color: "bg-destructive/15 text-destructive" },
  verified: { text: "已认证", color: "bg-status-success/15 text-status-success" },
};

const TNR_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  recruiting: { text: "招募中", color: "bg-status-rescue text-status-rescue-foreground" },
  in_progress: { text: "进行中", color: "bg-status-recover text-status-recover-foreground" },
  done: { text: "已完成", color: "bg-status-success text-status-success-foreground" },
};

interface GuardianChannelProps {
  searchTerm?: string;
}

const GuardianChannel = ({ searchTerm = "" }: GuardianChannelProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"rescue" | "tnr">("rescue");
  const [stories, setStories] = useState<any[]>([]);
  const [tnrs, setTnrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRescueForm, setShowRescueForm] = useState(false);
  const [showTnrForm, setShowTnrForm] = useState(false);
  const [shareStory, setShareStory] = useState<any | null>(null);
  const [feedTarget, setFeedTarget] = useState<any | null>(null);

  // 救助日记表单
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("cat");
  const [story, setStory] = useState("");
  const [location, setLocation] = useState("");
  const [beforeImg, setBeforeImg] = useState<File | null>(null);
  const [afterImg, setAfterImg] = useState<File | null>(null);
  const [realName, setRealName] = useState("");
  const [idLast4, setIdLast4] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // TNR 表单
  const [tnrTitle, setTnrTitle] = useState("");
  const [tnrDesc, setTnrDesc] = useState("");
  const [tnrLocation, setTnrLocation] = useState("");
  const [tnrCats, setTnrCats] = useState(3);
  const [tnrVolunteers, setTnrVolunteers] = useState(2);
  const [tnrDate, setTnrDate] = useState("");

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    // 公共：仅展示已通过审核 + active 的故事；登录用户额外能看自己未通过的
    const baseQ = supabase
      .from("rescue_stories" as any)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    const [r1, r2] = await Promise.all([
      baseQ,
      supabase.from("tnr_collaborations" as any).select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    const all = (r1.data as any[]) || [];
    const visible = all.filter((s) => s.verify_status === "verified" || (user && s.user_id === user.id));
    setStories(visible);
    setTnrs(r2.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("guardian-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rescue_stories" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tnr_collaborations" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const uploadImg = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("rescue-media").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("rescue-media").getPublicUrl(path).data.publicUrl;
  };

  const submitRescue = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!petName.trim() || !story.trim() || !location.trim()) {
      toast.error("请填写完整：宠物名 / 故事 / 地点");
      return;
    }
    if (!realName.trim() || realName.trim().length < 2) {
      toast.error("请填写真实姓名（用于身份核查，仅审核员可见）");
      return;
    }
    if (!/^\d{4}$/.test(idLast4)) {
      toast.error("请填写身份证号末 4 位");
      return;
    }
    if (proofFiles.length === 0) {
      toast.error("请至少上传 1 张救助证据图（医院单据 / 伤情照等）");
      return;
    }
    const safety = checkTextSafety(story);
    if (!safety.safe) {
      toast.error(`内容被拦截：${safety.violations.join("；")}`);
      return;
    }
    setSubmitting(true);
    try {
      let beforeUrl = null, afterUrl = null;
      if (beforeImg) beforeUrl = await uploadImg(beforeImg);
      if (afterImg) afterUrl = await uploadImg(afterImg);
      const proofUrls: string[] = [];
      for (const f of proofFiles) proofUrls.push(await uploadImg(f));
      const { error } = await supabase.from("rescue_stories" as any).insert({
        user_id: user.id, pet_name: petName, pet_type: petType, story, location,
        before_image: beforeUrl, after_image: afterUrl,
        real_name: realName.trim(),
        id_card_last4: idLast4,
        proof_urls: proofUrls,
        verify_status: "pending",
      });
      if (error) throw error;
      tryAutoAwardBadges(user.id);
      toast.success("已提交！审核通过后即可接收云投喂 ❤️");
      setShowRescueForm(false);
      setPetName(""); setStory(""); setLocation(""); setBeforeImg(null); setAfterImg(null);
      setRealName(""); setIdLast4(""); setProofFiles([]);
      load();
    } catch (e: any) { toast.error(e.message || "发布失败"); }
    finally { setSubmitting(false); }
  };

  const submitTnr = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!tnrTitle.trim() || !tnrDesc.trim() || !tnrLocation.trim()) { toast.error("请填写完整"); return; }
    const safety = checkTextSafety(tnrDesc);
    if (!safety.safe) { toast.error(`内容被拦截：${safety.violations.join("；")}`); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("tnr_collaborations" as any).insert({
        user_id: user.id, title: tnrTitle, description: tnrDesc, location: tnrLocation,
        cats_count: tnrCats, volunteers_needed: tnrVolunteers,
        scheduled_date: tnrDate || null,
      });
      if (error) throw error;
      toast.success("TNR 协作已发起！");
      setShowTnrForm(false);
      setTnrTitle(""); setTnrDesc(""); setTnrLocation(""); setTnrDate("");
      load();
    } catch (e: any) { toast.error(e.message || "发布失败"); }
    finally { setSubmitting(false); }
  };

  const openFeedDialog = (story: any) => {
    if (!user) { navigate("/auth"); return; }
    if (story.user_id === user.id) { toast.error("不能给自己投喂哦"); return; }
    setFeedTarget(story);
  };

  const handleFeedSuccess = (storyId: string, amount: number) => {
    setStories((prev) => prev.map((s) => s.id === storyId
      ? {
          ...s,
          cloud_feed_count: (s.cloud_feed_count || 0) + 1,
          total_feed_amount: Number(s.total_feed_amount || 0) + amount,
        }
      : s,
    ));
  };

  const joinTnr = async (tnr: any) => {
    if (!user) { navigate("/auth"); return; }
    if (tnr.user_id !== user.id) {
      // 简单计数（真实场景需独立 join 表防重）
      await supabase.from("tnr_collaborations" as any).update({
        volunteers_joined: (tnr.volunteers_joined || 0) + 1,
      }).eq("id", tnr.id);
    }
    toast.success("已报名！稍后会收到通知 📞");
    load();
  };

  return (
    <div className="px-4 pt-3 pb-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-2 w-full bg-secondary rounded-xl p-1 mb-3">
          <TabsTrigger value="rescue" className="text-xs">❤️ 救助日记</TabsTrigger>
          <TabsTrigger value="tnr" className="text-xs">🤝 TNR 协作</TabsTrigger>
        </TabsList>

        {/* 合规提示 */}
        <div className="mb-3 flex items-start gap-2 text-[11px] text-status-info-foreground bg-status-info border border-status-info-border rounded-lg p-2">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>所有救助物资请走平台对接的品牌商渠道。严禁个人收款码 / 私转。如有困难请联系客服。</span>
        </div>

        {/* 发起按钮 */}
        <div className="mb-3">
          {tab === "rescue" ? (
            <Button variant="hero" size="lg" className="w-full gap-2" onClick={() => user ? setShowRescueForm(true) : navigate("/auth")}>
              <Plus className="w-4 h-4" /> 发布救助日记
            </Button>
          ) : (
            <Button variant="hero" size="lg" className="w-full gap-2" onClick={() => user ? setShowTnrForm(true) : navigate("/auth")}>
              <Plus className="w-4 h-4" /> 发起 TNR 协作
            </Button>
          )}
        </div>

        <TabsContent value="rescue" className="mt-0 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (() => {
            const kw = searchTerm.trim().toLowerCase();
            const filtered = kw
              ? stories.filter((s) => [s.pet_name, s.story, s.location, s.medical_progress].some((f) => (f || "").toLowerCase().includes(kw)))
              : stories;
            if (filtered.length === 0) {
              return <div className="text-center py-10 text-muted-foreground"><span className="text-3xl block mb-2">🐾</span>{kw ? `没有匹配「${searchTerm}」的救助日记` : "暂无救助日记"}</div>;
            }
            return filtered.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                        {s.pet_type === "cat" ? "🐱" : s.pet_type === "dog" ? "🐶" : "🐾"} {s.pet_name}
                        {s.verify_status === "verified" && (
                          <ShieldAlert className="w-3.5 h-3.5 text-status-success" aria-label="已认证" />
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {s.location}
                      </p>
                      {s.verify_status !== "verified" && (
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${VERIFY_LABELS[s.verify_status]?.color}`}>
                          {VERIFY_LABELS[s.verify_status]?.text || "未审核"}
                          {s.verify_status === "rejected" && s.verify_note ? `：${s.verify_note}` : ""}
                        </span>
                      )}
                    </div>
                    <Badge className={`${STATUS_LABELS[s.status]?.color} text-white`}>
                      {STATUS_LABELS[s.status]?.text || s.status}
                    </Badge>
                  </div>

                  {/* Before / After (image / video / Live Photo image) */}
                  {(s.before_image || s.after_image) && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                        {s.before_image ? (
                          /\.(mp4|mov|webm|m4v)(\?|$)/i.test(s.before_image) ? (
                            <video src={s.before_image} className="w-full h-full object-cover" controls preload="metadata" playsInline />
                          ) : (
                            <img src={s.before_image} alt="救助前" className="w-full h-full object-cover" loading="lazy" />
                          )
                        ) : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">救助前</div>}
                        <Badge className="absolute top-1 left-1 text-[9px] bg-foreground/70 text-background">救助前</Badge>
                      </div>
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-secondary">
                        {s.after_image ? (
                          /\.(mp4|mov|webm|m4v)(\?|$)/i.test(s.after_image) ? (
                            <video src={s.after_image} className="w-full h-full object-cover" controls preload="metadata" playsInline />
                          ) : (
                            <img src={s.after_image} alt="现在" className="w-full h-full object-cover" loading="lazy" />
                          )
                        ) : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">期待 ✨</div>}
                        <Badge className="absolute top-1 left-1 text-[9px] bg-status-success text-status-success-foreground">现在</Badge>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-foreground leading-relaxed line-clamp-3 mb-2">{s.story}</p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <div className="text-[11px] flex flex-col gap-0.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-status-rescue" /> 已收到 {s.cloud_feed_count || 0} 次爱心
                      </span>
                      <span className="text-status-success font-bold">
                        ✅ 已直达 ¥{Number(s.total_feed_amount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-full text-xs gap-1 px-2.5"
                        onClick={() => setShareStory(s)}
                        aria-label="分享救助故事"
                      >
                        <Share2 className="w-3.5 h-3.5" /> 分享
                      </Button>
                      <Button
                        size="sm"
                        variant="warm"
                        className="h-8 rounded-full text-xs gap-1"
                        onClick={() => openFeedDialog(s)}
                        disabled={s.verify_status !== "verified"}
                        title={s.verify_status !== "verified" ? "审核通过后可投喂" : undefined}
                      >
                        🍖 投喂
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ));
          })()}
        </TabsContent>

        <TabsContent value="tnr" className="mt-0 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (() => {
            const kw = searchTerm.trim().toLowerCase();
            const filtered = kw
              ? tnrs.filter((t) => [t.title, t.description, t.location].some((f) => (f || "").toLowerCase().includes(kw)))
              : tnrs;
            if (filtered.length === 0) {
              return <div className="text-center py-10 text-muted-foreground"><span className="text-3xl block mb-2">🤝</span>{kw ? `没有匹配「${searchTerm}」的TNR协作` : "暂无协作"}</div>;
            }
            return filtered.map((t) => (
              <Card key={t.id} className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-sm text-foreground flex-1 pr-2">{t.title}</h3>
                  <Badge className={`${TNR_STATUS_LABELS[t.status]?.color} text-white text-[10px]`}>
                    {TNR_STATUS_LABELS[t.status]?.text}
                  </Badge>
                </div>
                <p className="text-xs text-foreground leading-relaxed mb-2 line-clamp-2">{t.description}</p>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground mb-2">
                  <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.location}</div>
                  <div className="flex items-center gap-1"><span>🐱</span>{t.cats_count} 只</div>
                  <div className="flex items-center gap-1"><Users className="w-3 h-3" />{t.volunteers_joined}/{t.volunteers_needed}</div>
                </div>
                {t.scheduled_date && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
                    <Calendar className="w-3 h-3" /> 计划：{t.scheduled_date}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: zhCN })}
                  </span>
                  <Button size="sm" variant="hero" className="h-8 rounded-full text-xs" onClick={() => joinTnr(t)} disabled={t.status === "done"}>
                    我要报名
                  </Button>
                </div>
              </Card>
            ));
          })()}
        </TabsContent>
      </Tabs>

      {/* 救助日记表单 */}
      <Dialog open={showRescueForm} onOpenChange={setShowRescueForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>📒 发布救助日记</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <Input placeholder="宠物昵称（如：小橘）" value={petName} onChange={(e) => setPetName(e.target.value)} maxLength={30} />
            <div className="flex gap-2">
              {[{ v: "cat", l: "🐱 猫" }, { v: "dog", l: "🐶 狗" }, { v: "other", l: "🐾 其他" }].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setPetType(o.v)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${petType === o.v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <Input placeholder="发现地点（如：上海浦东）" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} />
            <Textarea placeholder="讲述救助故事，越真实越打动人..." rows={5} value={story} onChange={(e) => setStory(e.target.value)} maxLength={1000} />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => beforeRef.current?.click()}
                className="aspect-square rounded-lg bg-secondary flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground border-2 border-dashed border-border hover:border-primary relative overflow-hidden"
              >
                {beforeImg ? (
                  beforeImg.type.startsWith("video") || /\.mov$/i.test(beforeImg.name) ? (
                    <>
                      <video src={URL.createObjectURL(beforeImg)} className="w-full h-full object-cover" muted playsInline />
                      <span className="absolute bottom-1 left-1 bg-foreground/70 text-background text-[10px] px-1.5 py-0.5 rounded-full">📹 视频</span>
                    </>
                  ) : (
                    <img src={URL.createObjectURL(beforeImg)} className="w-full h-full object-cover rounded-lg" />
                  )
                ) : (<><ImageIcon className="w-5 h-5" /><span>救助前 图/视频</span></>)}
              </button>
              <button
                onClick={() => afterRef.current?.click()}
                className="aspect-square rounded-lg bg-secondary flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground border-2 border-dashed border-border hover:border-primary relative overflow-hidden"
              >
                {afterImg ? (
                  afterImg.type.startsWith("video") || /\.mov$/i.test(afterImg.name) ? (
                    <>
                      <video src={URL.createObjectURL(afterImg)} className="w-full h-full object-cover" muted playsInline />
                      <span className="absolute bottom-1 left-1 bg-foreground/70 text-background text-[10px] px-1.5 py-0.5 rounded-full">📹 视频</span>
                    </>
                  ) : (
                    <img src={URL.createObjectURL(afterImg)} className="w-full h-full object-cover rounded-lg" />
                  )
                ) : (<><ImageIcon className="w-5 h-5" /><span>现在 ✨ 图/视频</span></>)}
              </button>
              <input ref={beforeRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.mov" hidden onChange={(e) => e.target.files?.[0] && setBeforeImg(e.target.files[0])} />
              <input ref={afterRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.mov" hidden onChange={(e) => e.target.files?.[0] && setAfterImg(e.target.files[0])} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="hero" onClick={submitRescue} disabled={submitting} className="w-full">
              {submitting ? "发布中..." : "发布救助日记 ❤️"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TNR 表单 */}
      <Dialog open={showTnrForm} onOpenChange={setShowTnrForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>🤝 发起 TNR 协作</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="协作标题（如：xx小区流浪猫绝育）" value={tnrTitle} onChange={(e) => setTnrTitle(e.target.value)} maxLength={50} />
            <Textarea placeholder="详细说明：流浪猫数量、状态、希望志愿者协助内容..." rows={4} value={tnrDesc} onChange={(e) => setTnrDesc(e.target.value)} maxLength={500} />
            <Input placeholder="地点（如：浦东新区张江）" value={tnrLocation} onChange={(e) => setTnrLocation(e.target.value)} maxLength={100} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">流浪猫数量</label>
                <Input type="number" min={1} value={tnrCats} onChange={(e) => setTnrCats(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">需要志愿者</label>
                <Input type="number" min={1} value={tnrVolunteers} onChange={(e) => setTnrVolunteers(parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">计划日期（可选）</label>
              <Input type="date" value={tnrDate} onChange={(e) => setTnrDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="hero" onClick={submitTnr} disabled={submitting} className="w-full">
              {submitting ? "发起中..." : "发起协作"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享救助故事卡片 */}
      {shareStory && (
        <ShareCardDialog
          open={!!shareStory}
          onOpenChange={(o) => !o && setShareStory(null)}
          kind="rescue"
          targetId={shareStory.id}
          authorName={shareStory.pet_name}
          coverImage={shareStory.after_image || shareStory.before_image}
          contentSnippet={`${shareStory.pet_type === "cat" ? "🐱" : "🐶"} ${shareStory.pet_name}${shareStory.location ? ` · ${shareStory.location}` : ""}：${shareStory.story}`}
          badgeText={STATUS_LABELS[shareStory.status]?.text || shareStory.status}
        />
      )}

      {/* 救助投喂弹窗 */}
      {feedTarget && (
        <RescueFeedDialog
          open={!!feedTarget}
          onClose={() => setFeedTarget(null)}
          storyId={feedTarget.id}
          petName={feedTarget.pet_name}
          recipientUserId={feedTarget.user_id}
          onSuccess={(amt) => handleFeedSuccess(feedTarget.id, amt)}
        />
      )}
    </div>
  );
};

export default GuardianChannel;
