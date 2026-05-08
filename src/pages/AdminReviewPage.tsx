import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Check, X, HardHat, Scissors, Car, Store, Search } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";

interface PendingDriver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  role_requested?: string;
  created_at: string;
}
interface PendingMerchant {
  id: string;
  store_name: string;
  contact_phone: string;
  license_number: string;
  created_at: string;
}

const AdminReviewPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useUserRoles();
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [merchants, setMerchants] = useState<PendingMerchant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [d, m] = await Promise.all([
      supabase.from("driver_applications").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("merchant_applications").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setDrivers((d.data as any) || []);
    setMerchants((m.data as any) || []);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  const reviewDriver = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase
      .from("driver_applications")
      .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "已通过" : "已拒绝");
    load();
  };

  const reviewMerchant = async (id: string, approve: boolean) => {
    setBusy(id);
    const fn = approve ? "approve_merchant_application" : "reject_merchant_application";
    const { data, error } = await supabase.rpc(fn, { _application_id: id });
    setBusy(null);
    if (error || (data as any)?.success === false) {
      toast.error(error?.message || "操作失败");
      return;
    }
    toast.success(approve ? "已通过" : "已拒绝");
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">仅管理员可访问</p>
        <Button variant="warm" className="mt-4" onClick={() => navigate("/")}>返回首页</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />审核中台</h1>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-6">
        <DriverReviewTabs drivers={drivers} busy={busy} onReview={reviewDriver} />

        <section>
          <h2 className="font-bold mb-2 text-sm flex items-center gap-1.5">
            <Store className="w-4 h-4 text-primary" />商家入驻 ({merchants.length})
          </h2>
          <div className="space-y-2">
            {merchants.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">暂无待审申请</p>}
            {merchants.map((m) => (
              <div key={m.id} className="bg-card rounded-xl p-3 card-shadow">
                <p className="font-bold text-sm">{m.store_name}</p>
                <p className="text-xs text-muted-foreground">{m.contact_phone} · 营业执照 {m.license_number}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="hero" disabled={busy === m.id} onClick={() => reviewMerchant(m.id, true)}>
                    <Check className="w-4 h-4 mr-1" />通过
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => reviewMerchant(m.id, false)}>
                    <X className="w-4 h-4 mr-1" />拒绝
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

const ROLE_TABS = [
  { key: "sitter", label: "宠托师", icon: HardHat, fields: ["实名认证", "爱心测试", "无犯罪证明"] },
  { key: "groomer", label: "护理师", icon: Scissors, fields: ["实名认证", "兽医/美容证", "服务案例"] },
  { key: "driver", label: "宠物司机", icon: Car, fields: ["驾驶证", "行驶证", "车辆环境照"] },
] as const;

function DriverReviewTabs({
  drivers,
  busy,
  onReview,
}: {
  drivers: PendingDriver[];
  busy: string | null;
  onReview: (id: string, approve: boolean) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, PendingDriver[]> = { sitter: [], groomer: [], driver: [] };
    drivers.forEach((d) => {
      const r = (d.role_requested || "sitter") as keyof typeof g;
      (g[r] || g.sitter).push(d);
    });
    return g;
  }, [drivers]);

  return (
    <section>
      <h2 className="font-bold mb-2 text-sm">守护者认证审核 ({drivers.length})</h2>
      <Tabs defaultValue="sitter">
        <TabsList className="grid grid-cols-3 w-full">
          {ROLE_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                <Icon className="w-3.5 h-3.5 mr-1" />
                {t.label} ({grouped[t.key]?.length || 0})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ROLE_TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="space-y-2 mt-3">
            <div className="bg-secondary/40 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
              审核要点：{t.fields.join(" · ")}
            </div>
            {(grouped[t.key] || []).length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无待审申请</p>
            )}
            {(grouped[t.key] || []).map((d) => (
              <div key={d.id} className="bg-card rounded-xl p-3 card-shadow">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{d.full_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{t.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  📱 {d.phone}
                  {t.key === "driver" && d.vehicle_type && ` · 🚗 ${d.vehicle_type}`}
                </p>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {t.fields.map((f) => (
                    <span key={f} className="text-[10px] bg-secondary/60 rounded px-1.5 py-0.5 text-center text-muted-foreground">
                      ✓ {f}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="hero" disabled={busy === d.id} onClick={() => onReview(d.id, true)}>
                    <Check className="w-4 h-4 mr-1" />通过
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => onReview(d.id, false)}>
                    <X className="w-4 h-4 mr-1" />拒绝
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

export default AdminReviewPage;
