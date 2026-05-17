import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Zap, Loader2 } from "lucide-react";

interface FlashSale {
  id: string;
  flash_price: number;
  original_price: number;
  stock: number;
  sold_count: number;
  ends_at: string;
  product: { id: string; name: string; cover_image: string | null };
}

const useCountdown = (endTime: string) => {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setRemaining("已结束"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
};

const FlashSaleCard = ({ sale, onSold }: { sale: FlashSale; onSold: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const countdown = useCountdown(sale.ends_at);
  const remaining = Math.max(sale.stock - sale.sold_count, 0);
  const total = sale.stock || (sale.sold_count + remaining) || 1;
  const progress = Math.min((sale.sold_count / total) * 100, 100);
  const soldOut = remaining <= 0;
  const [buying, setBuying] = useState(false);

  const handleBuy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    if (soldOut || buying) return;
    setBuying(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_flash_order", {
        _flash_id: sale.id, _qty: 1, _payment_method: "wallet",
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.error === "sold_out" ? "已抢光" :
                    data?.error === "flash_window_closed" ? "活动已结束" :
                    data?.error === "flash_inactive" ? "活动已下架" : "下单失败";
        toast({ title: msg, description: data?.error, variant: "destructive" });
        onSold();
        return;
      }
      // 立即发起钱包支付（其余渠道用户可在结果页重新选择）
      const { data: payRes } = await supabase.functions.invoke("create-payment", {
        body: { order_id: data.order_id, channel: "wallet" },
      });
      const pid = (payRes as any)?.payment_id;
      navigate(`/payment/result/${data.order_id}${pid ? `?pid=${pid}` : ""}`);
    } catch (err: any) {
      toast({ title: "下单失败", description: err?.message ?? "请重试", variant: "destructive" });
      onSold();
    } finally {
      setBuying(false);
    }
  };

  return (
    <Card
      className="shrink-0 w-36 overflow-hidden cursor-pointer hover:card-shadow-hover transition-shadow"
      onClick={() => navigate(`/product/${sale.product.id}`)}
    >
      <div className="aspect-square bg-muted flex items-center justify-center relative">
        {sale.product.cover_image ? (
          <img src={sale.product.cover_image} alt={sale.product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-4xl">🎁</span>
        )}
        <Badge className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[10px] px-1 py-0">
          <Zap className="w-3 h-3 mr-0.5" />限时
        </Badge>
        {soldOut && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs">已抢光</Badge>
          </div>
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs font-medium text-foreground line-clamp-1 mb-1">{sale.product.name}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-destructive font-extrabold text-sm">¥{sale.flash_price}</span>
          <span className="text-muted-foreground text-[10px] line-through">¥{sale.original_price}</span>
        </div>
        <div className="mt-1.5">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">已抢{sale.sold_count}件 · 剩{remaining}</p>
        </div>
        <p className="text-[10px] text-destructive font-mono mt-0.5">{countdown}</p>
        <Button
          size="sm"
          variant={soldOut ? "secondary" : "destructive"}
          className="w-full h-7 mt-1.5 text-[11px]"
          disabled={soldOut || buying}
          onClick={handleBuy}
        >
          {buying ? <Loader2 className="w-3 h-3 animate-spin" /> : soldOut ? "已抢光" : "立即抢"}
        </Button>
      </CardContent>
    </Card>
  );
};

const FlashSaleSection = () => {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    supabase
      .from("flash_sales")
      .select("id, flash_price, original_price, stock, sold_count, ends_at, product:products(id, name, cover_image)")
      .gte("ends_at", new Date().toISOString())
      .order("ends_at")
      .then(({ data }) => {
        if (data) setSales(data as any);
        setLoading(false);
      });
  };
  useEffect(() => { load(); }, []);

  if (!loading && sales.length === 0) return null;

  return (
    <section className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.12s" }} aria-label="限时抢购">
      <div className="flex items-center gap-2 px-5 mb-3">
        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-1">
          <Zap className="w-5 h-5 text-destructive" /> 限时抢购
        </h2>
        <Badge variant="destructive" className="text-[10px] animate-pulse">HOT</Badge>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shrink-0 w-36 space-y-2">
                <Skeleton className="aspect-square w-36 rounded-t-xl" />
                <Skeleton className="h-3 w-28 mx-1" />
                <Skeleton className="h-4 w-16 mx-1" />
              </div>
            ))
          : sales.map((s) => <FlashSaleCard key={s.id} sale={s} onSold={load} />)}
      </div>
    </section>
  );
};

export default FlashSaleSection;
