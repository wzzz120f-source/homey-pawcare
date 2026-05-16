import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Appeal {
  id: string;
  order_id: string | null;
  reason: string;
  description: string;
  contact_info: string | null;
  status: string;
  reply: string | null;
  created_at: string;
}

interface OrderOption {
  id: string;
  order_no: string;
  service_type: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待处理", color: "bg-amber-100 text-amber-800", icon: Clock },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-800", icon: AlertTriangle },
  resolved: { label: "已解决", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
};

const REASONS = ["服务质量问题", "收费异议", "技师态度问题", "预约时间变更", "商品质量问题", "其他"];

const MerchantAppealPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledOrder = searchParams.get("order");
  const { user, loading: authLoading } = useAuth();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!prefilledOrder);
  const [submitting, setSubmitting] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(prefilledOrder || "");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("merchant_appeals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }) as any,
      supabase.from("orders").select("id, order_no, service_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]).then(([appealsRes, ordersRes]) => {
      if (appealsRes.data) setAppeals(appealsRes.data);
      if (ordersRes.data) {
        const list = ordersRes.data as OrderOption[];
        setOrders(list);
        // If prefilled order missing in last 20, fetch its number for display
        if (prefilledOrder && !list.find((o) => o.id === prefilledOrder)) {
          supabase.from("orders").select("id, order_no, service_type").eq("id", prefilledOrder).maybeSingle().then(({ data }) => {
            if (data) setOrders((p) => [data as OrderOption, ...p]);
          });
        }
      }
      setLoading(false);
    });
  }, [user, prefilledOrder]);

  const handleSubmit = async () => {
    if (!user || !reason || !description.trim()) {
      toast.error("请填写申诉原因和详细描述");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.from("merchant_appeals") as any).insert({
        user_id: user.id,
        order_id: selectedOrder || null,
        reason,
        description: description.trim(),
        contact_info: contactInfo.trim() || null,
      }).select().single();
      if (error) throw error;
      setAppeals((prev) => [data, ...prev]);
      setShowForm(false);
      setSelectedOrder("");
      setReason("");
      setDescription("");
      setContactInfo("");
      toast.success("申诉提交成功，我们会尽快处理");
    } catch (err: any) {
      toast.error(err.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">商家申诉</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {!showForm ? (
          <Button variant="hero" className="w-full gap-2" onClick={() => setShowForm(true)}>
            <AlertTriangle className="w-4 h-4" /> 提交新申诉
          </Button>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-bold text-foreground">提交申诉</h2>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">关联订单（可选）</label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger><SelectValue placeholder="选择相关订单" /></SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_no} - {o.service_type || "服务订单"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">申诉原因 *</label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="选择原因" /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">详细描述 *</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请详细描述您遇到的问题..."
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">联系方式（可选）</label>
                <Input
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="手机号或微信号"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>取消</Button>
                <Button variant="hero" className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "提交中..." : "提交申诉"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appeal History */}
        <h2 className="font-bold text-foreground text-base pt-2">申诉记录</h2>
        {appeals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">暂无申诉记录</p>
        ) : (
          <div className="space-y-3">
            {appeals.map((a) => {
              const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
              const Icon = st.icon;
              return (
                <Card key={a.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={st.color + " text-xs"}>
                        <Icon className="w-3 h-3 mr-1" />{st.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "yyyy-MM-dd HH:mm")}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{a.reason}</p>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    {a.reply && (
                      <div className="bg-muted rounded-lg p-3 mt-2">
                        <p className="text-xs font-medium text-foreground mb-1">商家回复：</p>
                        <p className="text-sm text-muted-foreground">{a.reply}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MerchantAppealPage;
