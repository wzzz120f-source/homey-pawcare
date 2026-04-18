import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PetRadarMap from "./PetRadarMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Plus, Phone, AlertTriangle, Camera, Heart, Navigation } from "lucide-react";
import { toast } from "sonner";
import { generateVirtualPhone, checkTextSafety } from "@/lib/contentSafety";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  searching: { text: "🔥 紧急寻找", color: "bg-destructive text-destructive-foreground" },
  found: { text: "✅ 已找回", color: "bg-status-success text-status-success-foreground" },
  closed: { text: "已关闭", color: "bg-muted text-muted-foreground" },
};

const PetRadar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lostPets, setLostPets] = useState<any[]>([]);
  const [clues, setClues] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showClueForm, setShowClueForm] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // 走失登记表单
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("dog");
  const [breed, setBreed] = useState("");
  const [features, setFeatures] = useState("");
  const [lastSeen, setLastSeen] = useState("");
  const [reward, setReward] = useState(50);
  const [donate, setDonate] = useState(false);
  const [petImg, setPetImg] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  // 线索表单
  const [clueDesc, setClueDesc] = useState("");
  const [clueImg, setClueImg] = useState<File | null>(null);
  const clueImgRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("lost_pets" as any).select("*").order("status", { ascending: true }).order("lost_at", { ascending: false }).limit(30);
    setLostPets(data || []);

    // 加载每个走失宠物的线索
    if (data && data.length > 0) {
      const ids = data.map((p: any) => p.id);
      const { data: cluesData } = await supabase.from("lost_pet_clues" as any).select("*").in("lost_pet_id", ids);
      const map: Record<string, any[]> = {};
      (cluesData || []).forEach((c: any) => {
        if (!map[c.lost_pet_id]) map[c.lost_pet_id] = [];
        map[c.lost_pet_id].push(c);
      });
      setClues(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // 获取用户位置
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 31.2304, lng: 121.4737 }), // 上海默认
        { timeout: 5000 }
      );
    }
    const ch = supabase
      .channel("radar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "lost_pets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "lost_pet_clues" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Deep-link focus: scroll to and highlight the targeted pet card
  const focusPet = (id: string) => {
    const el = cardRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 2400);
    }
  };

  useEffect(() => {
    if (!focusId || lostPets.length === 0) return;
    const t = setTimeout(() => focusPet(focusId), 300);
    return () => clearTimeout(t);
  }, [focusId, lostPets]);

  const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const uploadImg = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("lost-pet-media").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("lost-pet-media").getPublicUrl(path).data.publicUrl;
  };

  const submitLost = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!petName.trim() || !features.trim() || !lastSeen.trim()) { toast.error("请填写完整"); return; }
    if (!userLocation) { toast.error("无法获取位置，请允许定位权限"); return; }
    const safety = checkTextSafety(features + lastSeen);
    if (!safety.safe) { toast.error(`内容被拦截：${safety.violations.join("；")}`); return; }

    setSubmitting(true);
    try {
      let imgUrl = null;
      if (petImg) imgUrl = await uploadImg(petImg, "lost");
      const { error } = await supabase.from("lost_pets" as any).insert({
        user_id: user.id, pet_name: petName, pet_type: petType, breed, features,
        last_seen_location: lastSeen, latitude: userLocation.lat, longitude: userLocation.lng,
        image_url: imgUrl, reward_points: reward, donate_to_shelter: donate,
        virtual_phone: generateVirtualPhone(user.id),
      });
      if (error) throw error;
      toast.success("已发布！将向方圆 5km 内的好心人推送 📡");
      setShowForm(false);
      setPetName(""); setBreed(""); setFeatures(""); setLastSeen(""); setPetImg(null);
      load();
    } catch (e: any) { toast.error(e.message || "发布失败"); }
    finally { setSubmitting(false); }
  };

  const submitClue = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!clueDesc.trim() || !showClueForm) return;
    if (!userLocation) { toast.error("无法获取位置"); return; }
    setSubmitting(true);
    try {
      let imgUrl = null;
      if (clueImg) imgUrl = await uploadImg(clueImg, "clues");
      const { error } = await supabase.from("lost_pet_clues" as any).insert({
        lost_pet_id: showClueForm, user_id: user.id,
        description: clueDesc, image_url: imgUrl,
        latitude: userLocation.lat, longitude: userLocation.lng,
      });
      if (error) throw error;
      toast.success("线索已提交！失主将立即收到通知 🙏");
      setShowClueForm(null); setClueDesc(""); setClueImg(null);
      load();
    } catch (e: any) { toast.error(e.message || "提交失败"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="px-4 pt-3 pb-4">
      {/* 紧急横幅 */}
      <div className="mb-3 text-destructive-foreground rounded-xl p-3 flex items-center gap-2" style={{ background: "var(--emergency-gradient)" }}>
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs flex-1">
          <p className="font-bold">紧急寻宠雷达 📡</p>
          <p className="text-[11px] opacity-90">附近 5-10km 内的走失宠物会推送提醒，发现即可一键上报线索</p>
        </div>
      </div>

      {/* 隐私安全提示 */}
      <div className="mb-3 flex items-start gap-2 text-[11px] text-muted-foreground bg-secondary rounded-lg p-2">
        <Phone className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
        <span>所有联系方式自动转换为虚拟中间号（400-PET-xxxx），保护双方隐私</span>
      </div>

      {/* 发起按钮 */}
      <Button variant="hero" size="lg" className="w-full gap-2 mb-3" onClick={() => user ? setShowForm(true) : navigate("/auth")}>
        <Plus className="w-4 h-4" /> 我家宠物走丢了
      </Button>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : lostPets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <span className="text-3xl block mb-2">📡</span>
          附近暂无走失宠物
        </div>
      ) : (
        <>
          {/* 高德地图 — 红点标注 */}
          <PetRadarMap pets={lostPets} userLocation={userLocation} onMarkerClick={focusPet} />

          <div className="space-y-3">
            {lostPets.map((p) => {
              const dist = userLocation ? distanceKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude) : null;
              const petClues = clues[p.id] || [];
              const isHighlighted = highlightId === p.id;
              return (
                <Card
                  key={p.id}
                  ref={(el) => { cardRefs.current[p.id] = el; }}
                  className={`overflow-hidden transition-all ${p.status === "searching" ? "border-destructive border-2 shadow-lg" : ""} ${isHighlighted ? "ring-4 ring-destructive ring-offset-2 scale-[1.01]" : ""}`}
                >
                  <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${STATUS_LABELS[p.status]?.color} text-white text-[10px]`}>
                          {STATUS_LABELS[p.status]?.text}
                        </Badge>
                        {dist !== null && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Navigation className="w-2.5 h-2.5" /> {dist.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-foreground">
                        {p.pet_type === "cat" ? "🐱" : "🐶"} {p.pet_name}
                        {p.breed && <span className="text-xs text-muted-foreground font-normal ml-1">·{p.breed}</span>}
                      </h3>
                    </div>
                  </div>

                  {p.image_url && (
                    <img src={p.image_url} alt={p.pet_name} className="w-full aspect-video object-cover rounded-lg mb-2" loading="lazy" />
                  )}

                  <p className="text-xs text-foreground leading-relaxed mb-2"><strong>特征：</strong>{p.features}</p>
                  <div className="text-xs text-muted-foreground space-y-1 mb-2">
                    <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> 最后出现：{p.last_seen_location}</p>
                    <p>走失时间：{formatDistanceToNow(new Date(p.lost_at), { addSuffix: true, locale: zhCN })}</p>
                  </div>

                  {p.reward_points > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <Heart className="w-3.5 h-3.5 text-destructive" />
                      <span className="font-bold text-destructive">悬赏 {p.reward_points} 爱心积分</span>
                      {p.donate_to_shelter && <Badge variant="outline" className="text-[9px]">找回后转捐救助站</Badge>}
                    </div>
                  )}

                  {/* 线索 */}
                  {petClues.length > 0 && (
                    <div className="bg-secondary rounded-lg p-2 mb-2">
                      <p className="text-[11px] font-bold text-foreground mb-1">📍 已收到 {petClues.length} 条目击线索</p>
                      {petClues.slice(0, 2).map((c) => (
                        <div key={c.id} className="text-[11px] text-muted-foreground flex items-start gap-1 mt-1">
                          <span>•</span>
                          <span className="flex-1">{c.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <div className="text-[10px] text-muted-foreground">
                      联系：<span className="font-mono font-bold text-foreground">{p.virtual_phone}</span>
                    </div>
                    {p.status === "searching" && (
                      <Button size="sm" variant="hero" className="h-8 rounded-full text-xs gap-1" onClick={() => setShowClueForm(p.id)}>
                        <Camera className="w-3 h-3" /> 我看到了
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 走失登记表单 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>📡 走失登记</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <Input placeholder="宠物昵称" value={petName} onChange={(e) => setPetName(e.target.value)} maxLength={30} />
            <div className="flex gap-2">
              {[{ v: "dog", l: "🐶 狗" }, { v: "cat", l: "🐱 猫" }, { v: "other", l: "🐾 其他" }].map((o) => (
                <button key={o.v} onClick={() => setPetType(o.v)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${petType === o.v ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <Input placeholder="品种（如：金毛 / 田园猫）" value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={50} />
            <Textarea placeholder="详细特征：颜色、体型、是否戴项圈、有无标志性记号..." rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} maxLength={500} />
            <Input placeholder="最后出现地点" value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} maxLength={100} />

            <button onClick={() => imgRef.current?.click()} className="w-full aspect-video rounded-lg bg-secondary border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary">
              {petImg ? <img src={URL.createObjectURL(petImg)} className="w-full h-full object-cover rounded-lg" /> : <><Camera className="w-6 h-6" /><span>上传宠物照片</span></>}
            </button>
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && setPetImg(e.target.files[0])} />

            <div>
              <label className="text-xs text-muted-foreground">悬赏爱心积分（可选）</label>
              <Input type="number" min={0} value={reward} onChange={(e) => setReward(parseInt(e.target.value) || 0)} />
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={donate} onChange={(e) => setDonate(e.target.checked)} />
              找回后将悬赏积分转捐救助站 ❤️ 形成爱心循环
            </label>

            <div className="text-[11px] text-status-info-foreground bg-status-info border border-status-info-border rounded-lg p-2">
              ℹ️ 你的真实手机号不会公开，系统将生成虚拟中间号供他人联系
            </div>
          </div>
          <DialogFooter>
            <Button variant="hero" onClick={submitLost} disabled={submitting} className="w-full">
              {submitting ? "发布中..." : "🔥 一键全城扩散"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 线索表单 */}
      <Dialog open={!!showClueForm} onOpenChange={(o) => !o && setShowClueForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>📷 上报线索</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="描述你看到的：在哪里、什么时候、宠物状态如何..." rows={4} value={clueDesc} onChange={(e) => setClueDesc(e.target.value)} maxLength={500} />
            <button onClick={() => clueImgRef.current?.click()} className="w-full aspect-video rounded-lg bg-secondary border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary">
              {clueImg ? <img src={URL.createObjectURL(clueImg)} className="w-full h-full object-cover rounded-lg" /> : <><Camera className="w-6 h-6" /><span>拍照上传（可选）</span></>}
            </button>
            <input ref={clueImgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && setClueImg(e.target.files[0])} />
            <p className="text-[11px] text-muted-foreground">系统会自动附上你的当前坐标，失主将立即收到通知</p>
          </div>
          <DialogFooter>
            <Button variant="hero" onClick={submitClue} disabled={submitting} className="w-full">
              {submitting ? "提交中..." : "提交线索 🙏"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PetRadar;
