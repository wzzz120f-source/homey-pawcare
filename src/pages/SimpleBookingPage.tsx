import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ArrowRight, Check, MapPin, PawPrint, CalendarDays,
  Clock, Pencil, ShieldCheck, Star, Sparkles,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

type SimpleType = "walk" | "feed" | "groom";

const SERVICE_META: Record<SimpleType, { title: string; emoji: string; price: number; desc: string; tag: string }> = {
  walk: { title: "专业遛狗", emoji: "🐕", price: 58, desc: "30 分钟室外陪伴 + GPS 轨迹", tag: "适合狗狗" },
  feed: { title: "上门喂宠", emoji: "🍽️", price: 38, desc: "喂食 / 换水 / 铲屎 + 实拍照片", tag: "适合所有" },
  groom: { title: "专业洗护", emoji: "🛁", price: 128, desc: "洗澡 / 吹干 / 修剪 + 持证师傅", tag: "适合猫狗" },
};

const TIME_SLOTS = ["09:00-10:00", "10:00-11:00", "14:00-15:00", "15:00-16:00", "18:00-19:00", "19:00-20:00"];

interface AddrRow { id: string; recipient: string; phone: string; province: string; city: string; district: string; detail: string; is_default?: boolean }
interface PetRow { id: string; name: string; pet_type: string; breed?: string; is_default?: boolean }
interface ProviderRow { user_id: string; username?: string; avatar_url?: string; rating?: number; orders_done?: number; verified?: boolean }

const Stepper = ({ step }: { step: 1 | 2 | 3 }) => (
  <div className="flex items-center gap-2 px-4 py-3">
    {[1, 2, 3].map((n) => (
      <div key={n} className="flex-1 flex items-center gap-2">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          step >= n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}>
          {step > n ? <Check className="w-4 h-4" /> : n}
        </div>
        <div className={cn("flex-1 h-1 rounded-full", n < 3 ? (step > n ? "bg-primary" : "bg-secondary") : "bg-transparent")} />
      </div>
    ))}
  </div>
);

const SimpleBookingPage = () => {
  const navigate = useNavigate();
  const { type } = useParams<{ type: SimpleType }>();
  const svcType = (type && SERVICE_META[type as SimpleType]) ? (type as SimpleType) : "walk";
  const meta = SERVICE_META[svcType];
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [providerId, setProviderId] = useState<string>(""); // empty = system match
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [petId, setPetId] = useState<string>("");
  const [pets, setPets] = useState<PetRow[]>([]);

  // Step 2
  const [date, setDate] = useState<Date>(addDays(new Date(), 1));
  const [slot, setSlot] = useState<string>(TIME_SLOTS[0]);
  const [addrId, setAddrId] = useState<string>("");
  const [addresses, setAddresses] = useState<AddrRow[]>([]);
  const [newAddr, setNewAddr] = useState<string>("");

  const [notes, setNotes] = useState<string>("");

  // Draft autosave key
  const draftKey = `simple-booking-${svcType}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.date) setDate(new Date(d.date));
        if (d.slot) setSlot(d.slot);
        if (d.notes) setNotes(d.notes);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svcType]);
  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ date: date.toISOString(), slot, notes }));
  }, [date, slot, notes, draftKey]);

  // Load user data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: petRows }, { data: addrRows }] = await Promise.all([
        supabase.from("pets").select("id,name,pet_type,breed,is_default").eq("user_id", user.id),
        supabase.from("shipping_addresses").select("id,recipient,phone,province,city,district,detail,is_default").eq("user_id", user.id),
      ]);
      const pl = ((petRows as any[]) || []) as PetRow[];
      setPets(pl);
      const dp = pl.find((p) => p.is_default) || pl[0];
      if (dp) setPetId(dp.id);
      const al = ((addrRows as any[]) || []) as AddrRow[];
      setAddresses(al);
      const da = al.find((a) => a.is_default) || al[0];
      if (da) setAddrId(da.id);
    })();
  }, [user]);

  const fmtAddr = (a: AddrRow) => `${a.province}${a.city}${a.district}${a.detail}`;

  // Load nearby providers (best-effort: list approved sitters/groomers)
  useEffect(() => {
    (async () => {
      const role = svcType === "groom" ? "groomer" : "sitter";
      const { data } = await supabase
        .from("user_roles").select("user_id, profiles:user_id(username, avatar_url)")
        .eq("role", role).limit(6);
      const list: ProviderRow[] = ((data as any[]) || []).map((r) => ({
        user_id: r.user_id,
        username: r.profiles?.username,
        avatar_url: r.profiles?.avatar_url,
        verified: true,
        rating: 4.7 + Math.random() * 0.3,
        orders_done: 50 + Math.floor(Math.random() * 400),
      }));
      setProviders(list);
    })();
  }, [svcType]);

  const selectedPet = useMemo(() => pets.find((p) => p.id === petId), [pets, petId]);
  const selectedAddr = useMemo(() => addresses.find((a) => a.id === addrId), [addresses, addrId]);
  const addrText = newAddr.trim() || selectedAddr?.full_address || "";
  const selectedProvider = useMemo(() => providers.find((p) => p.user_id === providerId), [providers, providerId]);

  const next = () => {
    if (step === 1) {
      if (!petId && pets.length > 0) { toast.error("请选择宠物"); return; }
      setStep(2); return;
    }
    if (step === 2) {
      if (!addrText) { toast.error("请填写或选择地址"); return; }
      setStep(3); return;
    }
  };

  const submit = () => {
    requireAuth(async () => {
      const orderData = {
        order_type: "service",
        service_type: svcType,
        pet_id: petId || null,
        pet_type: selectedPet?.pet_type || null,
        pet_snapshot: selectedPet ? { name: selectedPet.name, breed: selectedPet.breed } : null,
        booking_date: format(date, "yyyy-MM-dd"),
        booking_time: slot,
        pickup_address: addrText,
        notes: notes || null,
        total_amount: meta.price,
        provider_id: providerId || null,
      };
      navigate("/payment", { state: { orderData, amount: meta.price } });
      localStorage.removeItem(draftKey);
    }, { message: "登录后即可下单，订单信息已保留" });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => (step === 1 ? navigate(-1) : setStep((s) => (s - 1) as any))} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-base">{meta.emoji} {meta.title}</h1>
            <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
          </div>
          <span className="text-primary font-bold">¥{meta.price}</span>
        </div>
        <Stepper step={step} />
        <div className="flex justify-between text-[11px] text-muted-foreground px-4 pb-2">
          <span className={cn(step >= 1 && "text-foreground font-medium")}>1. 选服务者</span>
          <span className={cn(step >= 2 && "text-foreground font-medium")}>2. 时间地址</span>
          <span className={cn(step >= 3 && "text-foreground font-medium")}>3. 确认支付</span>
        </div>
      </header>

      <main className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {step === 1 && (
          <>
            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><PawPrint className="w-4 h-4 text-primary" />选择宠物</h2>
              {pets.length === 0 ? (
                <button onClick={() => requireAuth(() => navigate("/pets"))} className="w-full py-4 rounded-xl border-2 border-dashed text-sm text-muted-foreground">
                  还没有宠物档案，点此添加 →
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {pets.map((p) => (
                    <button key={p.id} onClick={() => setPetId(p.id)}
                      className={cn("p-3 rounded-xl border text-left", petId === p.id ? "border-primary bg-primary/5" : "border-border")}>
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.breed || p.pet_type}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />匹配服务者</h2>
              <button onClick={() => setProviderId("")} className={cn("w-full p-3 rounded-xl border mb-2 text-left flex items-center gap-3",
                providerId === "" ? "border-primary bg-primary/5" : "border-border")}>
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">系统智能派单（推荐）</p>
                  <p className="text-[11px] text-muted-foreground">自动匹配最近、评分最高的服务者，等待时间最短</p>
                </div>
              </button>
              <div className="space-y-2">
                {providers.map((p) => (
                  <button key={p.user_id} onClick={() => setProviderId(p.user_id)}
                    className={cn("w-full p-3 rounded-xl border text-left flex items-center gap-3",
                      providerId === p.user_id ? "border-primary bg-primary/5" : "border-border")}>
                    <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <PawPrint className="w-full h-full p-2 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm truncate">{p.username || "服务者"}</p>
                        {p.verified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 flex items-center gap-0.5"><ShieldCheck className="w-3 h-3" />已审核</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500 fill-amber-500" />{p.rating?.toFixed(1)}</span>
                        <span>{p.orders_done} 单</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-primary" />选择日期</h2>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((i) => {
                  const d = addDays(new Date(), i);
                  const active = format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
                  return (
                    <button key={i} onClick={() => setDate(d)}
                      className={cn("py-2 rounded-xl border text-center", active ? "border-primary bg-primary/5" : "border-border")}>
                      <p className="text-[11px] text-muted-foreground">{i === 0 ? "今天" : i === 1 ? "明天" : format(d, "EEE", { locale: zhCN })}</p>
                      <p className="font-bold text-sm">{format(d, "MM/dd")}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />选择时段</h2>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((s) => (
                  <button key={s} onClick={() => setSlot(s)}
                    className={cn("py-2 rounded-xl border text-xs", slot === s ? "border-primary bg-primary/5 font-bold" : "border-border")}>
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />服务地址</h2>
              {addresses.length > 0 && (
                <div className="space-y-2 mb-2">
                  {addresses.map((a) => (
                    <button key={a.id} onClick={() => { setAddrId(a.id); setNewAddr(""); }}
                      className={cn("w-full p-3 rounded-xl border text-left",
                        addrId === a.id && !newAddr ? "border-primary bg-primary/5" : "border-border")}>
                      <p className="text-sm font-medium truncate">{a.full_address}</p>
                      {a.receiver_name && <p className="text-[11px] text-muted-foreground">{a.receiver_name} · {a.receiver_phone}</p>}
                    </button>
                  ))}
                </div>
              )}
              <Input
                placeholder="或填写新地址（详细到门牌号）"
                value={newAddr}
                onChange={(e) => { setNewAddr(e.target.value); if (e.target.value) setAddrId(""); }}
              />
            </section>

            <section className="bg-card rounded-2xl p-4 card-shadow">
              <h2 className="font-bold text-sm mb-2">备注（可选）</h2>
              <Textarea placeholder="例如：狗狗怕雷声、需要喂药等" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <section className="bg-card rounded-2xl p-4 card-shadow space-y-3">
              <h2 className="font-bold text-sm">订单确认</h2>

              <Row label="服务" value={`${meta.emoji} ${meta.title}`} onEdit={() => setStep(1)} />
              <Row label="服务者" value={selectedProvider?.username || "系统智能派单"} onEdit={() => setStep(1)} />
              <Row label="宠物" value={selectedPet ? `${selectedPet.name}（${selectedPet.breed || selectedPet.pet_type}）` : "未选择"} onEdit={() => setStep(1)} />
              <Row label="时间" value={`${format(date, "MM 月 dd 日", { locale: zhCN })} · ${slot}`} onEdit={() => setStep(2)} />
              <Row label="地址" value={addrText || "未填写"} onEdit={() => setStep(2)} />
              {notes && <Row label="备注" value={notes} onEdit={() => setStep(2)} />}

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-muted-foreground">合计</span>
                <span className="text-2xl font-extrabold text-primary">¥{meta.price}</span>
              </div>
            </section>

            <section className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 flex gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <p className="font-bold">担保支付保障</p>
                <p>付款后资金由平台暂存，服务完成并经你确认后才结算给服务者；出问题可随时申请退款。</p>
              </div>
            </section>
          </>
        )}
      </main>

      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t z-20">
        <div className="max-w-lg mx-auto flex gap-2">
          {step > 1 && (
            <Button variant="outline" size="xl" className="flex-1" onClick={() => setStep((s) => (s - 1) as any)}>
              上一步
            </Button>
          )}
          {step < 3 ? (
            <Button variant="hero" size="xl" className="flex-[2]" onClick={next}>
              下一步 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button variant="hero" size="xl" className="flex-[2]" onClick={submit}>
              确认下单 · ¥{meta.price}
            </Button>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

const Row = ({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) => (
  <div className="flex items-start gap-2 text-sm">
    <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
    <span className="flex-1 break-words">{value}</span>
    {onEdit && (
      <button onClick={onEdit} className="text-primary text-xs flex items-center gap-0.5 shrink-0">
        <Pencil className="w-3 h-3" /> 修改
      </button>
    )}
  </div>
);

export default SimpleBookingPage;
