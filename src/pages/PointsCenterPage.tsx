import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLovePoints, POINT_RULES, getActionLabel } from "@/hooks/useLovePoints";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Gift, Sparkles, ArrowLeft, ChevronRight, TrendingUp, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CATEGORY_BADGE: Record<string, string> = {
  goods: "实物礼品",
  coupon: "商城券",
  virtual: "虚拟权益",
};

const PointsCenterPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, refresh, spend, donate, loading } = useLovePoints();

  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);

  const [redeemTarget, setRedeemTarget] = useState<any>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donatePoints, setDonatePoints] = useState(100);
  const [donateTargetType, setDonateTargetType] = useState<"platform_pool" | "rescue_story">("platform_pool");
  const [donateTargetId, setDonateTargetId] = useState<string | null>(null);
  const [donateMsg, setDonateMsg] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAll = async () => {
    const [itemsRes, txRes, donationsRes, storiesRes] = await Promise.all([
      (supabase as any).from("point_redeemable_items").select("*").eq("is_active", true).order("sort_order"),
      (supabase as any).from("love_point_transactions").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("point_donations").select("*").order("created_at", { ascending: false }).limit(20),
      (supabase as any).from("rescue_stories").select("id, pet_name, pet_type, status").eq("is_active", true).limit(20),
    ]);
    setItems(itemsRes.data || []);
    setTransactions(txRes.data || []);
    setDonations(donationsRes.data || []);
    setStories(storiesRes.data || []);
  };

  const handleRedeem = async () => {
    if (!redeemTarget) return;
    if (balance < redeemTarget.points_required) {
      toast.error("积分不足");
      return;
    }
    const ok = await spend(
      redeemTarget.points_required,
      "redeem",
      "item",
      redeemTarget.id,
      `兑换：${redeemTarget.name}`,
    );
    if (ok) {
      toast.success("兑换成功 🎁", { description: "已生成兑换记录，平台将尽快为你寄出" });
      setRedeemTarget(null);
      loadAll();
    }
  };

  const handleDonate = async () => {
    if (donatePoints <= 0 || donatePoints > balance) {
      toast.error("请输入有效的积分数量");
      return;
    }
    const ok = await donate(
      donatePoints,
      { type: donateTargetType, id: donateTargetType === "rescue_story" ? donateTargetId : null },
      donateMsg.trim() || undefined,
    );
    if (ok) {
      setDonateOpen(false);
      setDonateMsg("");
      setDonatePoints(100);
      loadAll();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* 顶部余额卡 */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-secondary text-primary-foreground px-4 pt-12 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">爱心积分中心</h1>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-sm opacity-90 mb-2">
            <Heart className="w-4 h-4 fill-current" />
            我的爱心积分
          </div>
          <div className="text-5xl font-bold tracking-tight mb-3">{balance}</div>
          <div className="text-xs opacity-80">100 积分 = ¥1 商城抵现 · 也可转捐救助站</div>
          <div className="flex gap-2 mt-4 justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => setDonateOpen(true)}
            >
              <HandHeart className="w-4 h-4" /> 公益转捐
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => navigate("/shop")}
            >
              <Gift className="w-4 h-4" /> 去商城抵现
            </Button>
          </div>
        </div>
      </div>

      {/* 赚取攻略 */}
      <Card className="mx-4 -mt-6 p-4 shadow-md relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">如何赚取积分（每日封顶 100）</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(Object.keys(POINT_RULES) as Array<keyof typeof POINT_RULES>).map((k) => (
            <div key={k} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{getActionLabel(k)}</span>
              <span className="font-bold text-primary">+{POINT_RULES[k]}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div className="px-4 mt-6">
        <Tabs defaultValue="shop">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="shop">积分专区</TabsTrigger>
            <TabsTrigger value="history">积分流水</TabsTrigger>
            <TabsTrigger value="donate">公益榜</TabsTrigger>
          </TabsList>

          {/* 兑换专区 */}
          <TabsContent value="shop" className="mt-4 space-y-3">
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">暂无可兑换商品</p>
            ) : (
              items.map((item) => {
                const enough = balance >= item.points_required;
                return (
                  <Card key={item.id} className="p-4 flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-secondary/40 to-primary/20 rounded-xl flex items-center justify-center text-3xl shrink-0">
                      {item.category === "coupon" ? "🎟️" : item.category === "virtual" ? "🏆" : "🎁"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {CATEGORY_BADGE[item.category] || "礼品"}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-primary font-bold text-sm">
                        <Heart className="w-3 h-3 fill-current" />
                        {item.points_required}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!enough || item.stock <= 0}
                      onClick={() => setRedeemTarget(item)}
                    >
                      {item.stock <= 0 ? "已兑完" : enough ? "兑换" : "积分不足"}
                    </Button>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* 流水 */}
          <TabsContent value="history" className="mt-4 space-y-2">
            {transactions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">暂无积分记录，快去赚积分吧～</p>
            ) : (
              transactions.map((tx) => (
                <Card key={tx.id} className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {tx.description || getActionLabel(tx.action_type)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: zhCN })}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-bold text-sm shrink-0 ml-3",
                      tx.points > 0 ? "text-status-success" : "text-destructive",
                    )}
                  >
                    {tx.points > 0 ? "+" : ""}
                    {tx.points}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* 公益榜 */}
          <TabsContent value="donate" className="mt-4 space-y-2">
            <Card className="p-4 bg-gradient-to-br from-secondary/30 to-primary/10 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">爱心循环</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                你的积分将由平台按 100:1 折算为猫粮狗粮，定向寄送到合作救助机构。每一笔捐赠都会公开公示。
              </p>
              <Button size="sm" className="w-full" onClick={() => setDonateOpen(true)}>
                <HandHeart className="w-4 h-4" /> 我也要捐赠
              </Button>
            </Card>
            {donations.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">还没有捐赠记录，做第一个吧 ❤️</p>
            ) : (
              donations.map((d) => (
                <Card key={d.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">
                      {d.target_type === "platform_pool" ? "平台公益池" : "定向救助"}
                    </Badge>
                    <span className="font-bold text-primary text-sm flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current" />
                      {d.points}
                    </span>
                  </div>
                  {d.message && <p className="text-xs text-muted-foreground mt-2">"{d.message}"</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: zhCN })}
                  </p>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 兑换确认 */}
      <Dialog open={!!redeemTarget} onOpenChange={(o) => !o && setRedeemTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认兑换</DialogTitle>
          </DialogHeader>
          {redeemTarget && (
            <div className="space-y-3">
              <p className="text-sm">
                兑换 <span className="font-semibold">{redeemTarget.name}</span>
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">所需积分</span>
                <span className="font-bold text-primary">{redeemTarget.points_required}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">兑换后余额</span>
                <span className="font-bold">{balance - redeemTarget.points_required}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemTarget(null)}>取消</Button>
            <Button onClick={handleRedeem} disabled={loading}>确认兑换</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 捐赠对话框 */}
      <Dialog open={donateOpen} onOpenChange={setDonateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>公益转捐</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">捐赠对象</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDonateTargetType("platform_pool")}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition",
                    donateTargetType === "platform_pool"
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <div className="text-sm font-semibold">平台公益池</div>
                  <div className="text-[10px] text-muted-foreground mt-1">折算寄送物资</div>
                </button>
                <button
                  onClick={() => setDonateTargetType("rescue_story")}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition",
                    donateTargetType === "rescue_story"
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <div className="text-sm font-semibold">定向救助</div>
                  <div className="text-[10px] text-muted-foreground mt-1">指定救助故事</div>
                </button>
              </div>
            </div>

            {donateTargetType === "rescue_story" && (
              <div>
                <label className="text-sm font-medium mb-2 block">选择救助故事</label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {stories.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setDonateTargetId(s.id)}
                      className={cn(
                        "w-full p-2 rounded-md text-left text-sm flex justify-between items-center",
                        donateTargetId === s.id ? "bg-primary/10 border border-primary" : "hover:bg-muted",
                      )}
                    >
                      <span>{s.pet_type === "cat" ? "🐱" : "🐶"} {s.pet_name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                  {stories.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">暂无活跃救助故事</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">捐赠积分（当前余额 {balance}）</label>
              <div className="flex gap-2 mb-2">
                {[100, 500, 1000].map((p) => (
                  <Button
                    key={p}
                    variant={donatePoints === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDonatePoints(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                max={balance}
                value={donatePoints}
                onChange={(e) => setDonatePoints(Math.max(1, parseInt(e.target.value) || 0))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">留言（可选）</label>
              <Textarea
                placeholder="给毛孩子说几句话吧～"
                value={donateMsg}
                onChange={(e) => setDonateMsg(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDonateOpen(false)}>取消</Button>
            <Button
              onClick={handleDonate}
              disabled={loading || (donateTargetType === "rescue_story" && !donateTargetId)}
            >
              <HandHeart className="w-4 h-4" /> 确认捐赠
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default PointsCenterPage;
