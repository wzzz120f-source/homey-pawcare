import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, AlertCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Status = "none" | "pending" | "approved" | "rejected";

const RescueKycStatusCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("none");
  const [note, setNote] = useState<string | null>(null);
  const [hasFeed, setHasFeed] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [k, t] = await Promise.all([
        supabase.from("rescue_kyc" as any).select("status,review_note").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions").select("id").eq("user_id", user.id).eq("type", "feed_in").limit(1),
      ]);
      const row = (k.data as any);
      setStatus((row?.status as Status) || "none");
      setNote(row?.review_note || null);
      setHasFeed(((t.data as any[]) || []).length > 0);
    })();
  }, [user]);

  if (!hasFeed && status === "none") return null;

  const cfg: Record<Status, { color: string; label: string; cta: string; icon: any }> = {
    none: { color: "outline", label: "未实名认证", cta: "去认证", icon: ShieldAlert },
    pending: { color: "outline", label: "审核中", cta: "查看进度", icon: ShieldAlert },
    approved: { color: "secondary", label: "已通过", cta: "查看详情", icon: ShieldCheck },
    rejected: { color: "destructive", label: "审核未通过", cta: "重新提交", icon: AlertCircle },
  };
  const c = cfg[status];
  const Icon = c.icon;

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${status === "approved" ? "text-emerald-600" : status === "rejected" ? "text-destructive" : "text-amber-500"}`} />
          <span className="font-semibold text-sm">救助提现实名认证</span>
        </div>
        <Badge variant={c.color as any}>{c.label}</Badge>
      </div>
      {status === "rejected" && note && <p className="text-xs text-destructive">{note}</p>}
      {hasFeed && status !== "approved" && (
        <p className="text-xs text-muted-foreground">你的钱包包含爱心投喂资金，需通过实名认证后才能提现。</p>
      )}
      <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate("/rescue-kyc")}>
        {c.cta}<ChevronRight className="w-4 h-4" />
      </Button>
    </Card>
  );
};

export default RescueKycStatusCard;
