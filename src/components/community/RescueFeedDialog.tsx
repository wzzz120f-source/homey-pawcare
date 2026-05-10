import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Wallet, Trophy, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { friendlySupabaseError } from "@/lib/supabaseError";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  storyId: string;
  petName: string;
  recipientUserId: string;
  onSuccess?: (amount: number) => void;
}

const PRESET_AMOUNTS = [1, 5, 10, 20, 50];

interface FeedRow {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_amount: number;
  feed_count: number;
}

interface FeedItem {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  amount: number;
  message: string | null;
  paid_at: string;
}

const PAGE_SIZE = 20;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const RescueFeedDialog = ({ open, onClose, storyId, petName, recipientUserId, onSuccess }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [topFeeders, setTopFeeders] = useState<FeedRow[]>([]);
  const [totalReceived, setTotalReceived] = useState<number>(0);

  const isSelf = user?.id === recipientUserId;

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (user) {
        const { data: w } = await supabase
          .from("user_wallets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        setBalance(Number(w?.balance ?? 0));
      }
      const [{ data: top }, { data: story }] = await Promise.all([
        (supabase as any).rpc("get_rescue_feed_top", { _story_id: storyId, _limit: 5 }),
        supabase.from("rescue_stories" as any).select("total_feed_amount").eq("id", storyId).maybeSingle(),
      ]);
      setTopFeeders(((top as any[]) || []).map((r) => ({
        user_id: r.user_id,
        username: r.username,
        avatar_url: r.avatar_url,
        total_amount: Number(r.total_amount) || 0,
        feed_count: Number(r.feed_count) || 0,
      })));
      setTotalReceived(Number((story as any)?.total_feed_amount ?? 0));
    })();
  }, [open, user, storyId]);

  const finalAmount = (() => {
    const n = Number(custom);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : amount;
  })();

  const insufficient = balance !== null && finalAmount > balance;

  const handleSubmit = async () => {
    if (!user) {
      toast.error("请先登录");
      navigate("/auth");
      return;
    }
    if (isSelf) {
      toast.error("不能给自己投喂哦");
      return;
    }
    if (finalAmount <= 0) {
      toast.error("请选择金额");
      return;
    }
    if (insufficient) {
      toast.error("钱包余额不足，请先充值");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("feed_rescue_with_balance", {
        _story_id: storyId,
        _amount: finalAmount,
        _message: message.trim() || null,
      });
      if (error) throw error;
      if (!data?.success) {
        const map: Record<string, string> = {
          unauthorized: "请先登录",
          invalid_amount: "金额无效",
          amount_too_large: "单笔金额上限 ¥9999",
          story_not_found: "救助故事不存在",
          story_inactive: "该救助已结束",
          self_feed_forbidden: "不能给自己投喂",
          insufficient_balance: "钱包余额不足",
        };
        toast.error(map[data?.error] || "投喂失败");
        return;
      }
      toast.success(`✅ 已直达救助者钱包 ¥${finalAmount}`);
      onSuccess?.(finalAmount);
      onClose();
    } catch (e) {
      toast.error(friendlySupabaseError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-destructive fill-current" />
            为「{petName}」云投喂
          </DialogTitle>
        </DialogHeader>

        {/* 直达说明 */}
        <div className="flex items-start gap-2 text-[11px] text-status-success-foreground bg-status-success/10 border border-status-success/30 rounded-lg p-2">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-status-success" />
          <span>100% 直达救助者钱包，平台不抽成。提现需通过救助资质审核。</span>
        </div>

        {/* 已到账金额 */}
        <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
          <div className="text-xs text-muted-foreground">救助者已收到</div>
          <div className="text-lg font-extrabold text-foreground">¥{totalReceived.toFixed(2)}</div>
        </div>

        {/* 金额选择 */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-foreground">投喂金额</div>
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => { setAmount(a); setCustom(""); }}
                className={cn(
                  "h-10 rounded-lg text-sm font-bold border transition-colors",
                  !custom && amount === a
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground hover:bg-secondary",
                )}
              >
                ¥{a}
              </button>
            ))}
          </div>
          <Input
            type="number"
            placeholder="自定义金额（元）"
            value={custom}
            min={1}
            max={9999}
            onChange={(e) => setCustom(e.target.value)}
            className="h-10"
          />
        </div>

        {/* 留言 */}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="留下祝福（可选）"
          maxLength={60}
          className="h-10"
        />

        {/* 钱包余额 */}
        <div className={cn(
          "flex items-center justify-between text-xs px-3 py-2 rounded-lg",
          insufficient ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground",
        )}>
          <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> 钱包余额</span>
          <span className="font-bold">
            {balance === null ? "—" : `¥${balance.toFixed(2)}`}
            {insufficient && (
              <button onClick={() => navigate("/wallet")} className="ml-2 underline">充值</button>
            )}
          </span>
        </div>

        {/* 投喂榜 */}
        {topFeeders.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-accent" /> 爱心投喂榜
            </div>
            <div className="space-y-1">
              {topFeeders.map((f, i) => (
                <div key={f.user_id} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-center font-bold text-muted-foreground">{i + 1}</span>
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={f.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{(f.username || "宠")[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-foreground">{f.username || "爱心人士"}</span>
                  <span className="text-muted-foreground">{f.feed_count} 次</span>
                  <span className="font-bold text-destructive">¥{f.total_amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>取消</Button>
          <Button
            variant="hero"
            disabled={submitting || isSelf || finalAmount <= 0}
            onClick={handleSubmit}
            className="gap-1"
          >
            <Heart className="w-4 h-4" /> 投喂 ¥{finalAmount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescueFeedDialog;
