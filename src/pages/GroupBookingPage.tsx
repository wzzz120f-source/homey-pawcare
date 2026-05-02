import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Users, Plus, Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface GroupOrder {
  id: string;
  initiator_id: string;
  service_date: string;
  service_type: string | null;
  community_name: string;
  address_summary: string;
  member_count: number;
  target_count: number;
  discount_per_member: number;
  status: string;
  created_at: string;
}

const SERVICE_OPTIONS = [
  { id: "bath", label: "上门洗护", emoji: "🛁" },
  { id: "walking", label: "遛狗陪伴", emoji: "🦮" },
  { id: "grooming", label: "美容造型", emoji: "✂️" },
  { id: "health", label: "健康检查", emoji: "🩺" },
];

const GroupBookingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [community, setCommunity] = useState("");
  const [address, setAddress] = useState("");
  const [serviceType, setServiceType] = useState("bath");
  const [serviceDate, setServiceDate] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  });

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("group_orders")
      .select("*")
      .gte("service_date", today)
      .in("status", ["recruiting", "formed"])
      .order("service_date", { ascending: true })
      .limit(20);
    setGroups((data as GroupOrder[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("group-orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_order_members" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleJoin = async (g: GroupOrder) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (g.initiator_id === user.id) {
      toast({ title: "你已是发起人", description: "等待邻居加入即可" });
      return;
    }
    const { error } = await supabase.from("group_order_members").insert({
      group_id: g.id,
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "你已加入此拼单" });
      } else {
        toast({ title: "加入失败", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({
      title: "🎉 已加入拼单",
      description: `成团后每人减免 ¥${g.discount_per_member}，请到预约页完成下单`,
    });
    load();
  };

  const handleCreate = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!community.trim() || !address.trim()) {
      toast({ title: "请填写小区与地址" });
      return;
    }
    const { data, error } = await supabase
      .from("group_orders")
      .insert({
        initiator_id: user.id,
        service_date: serviceDate,
        service_type: serviceType,
        community_name: community.trim(),
        address_summary: address.trim(),
      })
      .select()
      .single();
    if (error) {
      toast({ title: "发起失败", description: error.message, variant: "destructive" });
      return;
    }
    // initiator joins their own group
    await supabase.from("group_order_members").insert({ group_id: data.id, user_id: user.id });
    toast({ title: "🚀 已发起拼单", description: "等待邻居加入，达 3 人自动成团" });
    setCreateOpen(false);
    setCommunity("");
    setAddress("");
    load();
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex items-center gap-1.5">
            <Users className="w-5 h-5 text-primary" /> 邻里拼单广场
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-extrabold text-foreground">同小区 3 户成团，每人减 ¥10 路费</h2>
              <p className="text-xs text-muted-foreground mt-1">
                同一小区当天约同一宠托师即视为成团，平台自动减免，省钱又结识邻居。
              </p>
            </div>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              <Plus className="w-4 h-4 mr-1" /> 发起新拼单
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>发起一个拼单</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">小区名称</Label>
                <Input value={community} onChange={(e) => setCommunity(e.target.value)} placeholder="如：阳光花园小区" />
              </div>
              <div>
                <Label className="text-xs">地址摘要（楼栋）</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="如：张杨路 500 号 8 号楼" />
              </div>
              <div>
                <Label className="text-xs">服务日期</Label>
                <Input
                  type="date"
                  value={serviceDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setServiceDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">服务类型</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {SERVICE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setServiceType(s.id)}
                      className={`p-2 rounded-lg border text-sm transition-colors ${
                        serviceType === s.id ? "border-primary bg-primary/10 text-primary" : "border-border"
                      }`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate}>
                确认发起
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">附近招募中的拼单</h3>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                暂无招募中的拼单，做第一个发起人吧～
              </CardContent>
            </Card>
          ) : (
            groups.map((g) => {
              const pct = (g.member_count / g.target_count) * 100;
              const formed = g.status === "formed";
              const svc = SERVICE_OPTIONS.find((s) => s.id === g.service_type);
              return (
                <Card key={g.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground flex items-center gap-1.5">
                          <span aria-hidden="true">{svc?.emoji || "🐾"}</span>
                          {svc?.label || g.service_type || "宠物服务"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {g.community_name} · {g.address_summary}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> {g.service_date}
                        </p>
                      </div>
                      <Badge variant={formed ? "default" : "secondary"} className="shrink-0">
                        {formed ? "✅ 已成团" : "招募中"}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          <Users className="w-3 h-3 inline mr-0.5" />
                          {g.member_count}/{g.target_count} 户
                        </span>
                        <span className="text-primary font-bold">每人省 ¥{g.discount_per_member}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    <Button
                      size="sm"
                      className="w-full"
                      variant={formed ? "outline" : "default"}
                      onClick={() => handleJoin(g)}
                    >
                      {formed ? "查看详情" : "🙋 加入拼单"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default GroupBookingPage;
