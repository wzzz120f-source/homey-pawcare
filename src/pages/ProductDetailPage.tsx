import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Heart, ShoppingCart, Star, ChevronLeft, ChevronRight, ShieldCheck, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  original_price: number | null;
  cover_image: string | null;
  images: string[] | null;
  stock: number;
  sales_count: number;
  merchant_id: string;
  category_id: string | null;
}

interface Merchant {
  id: string;
  name: string;
  is_verified: boolean;
  description: string | null;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
}

interface ProductSku {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  stock: number;
  attributes: Record<string, string>;
  sort_order: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "c1111111-1111-1111-1111-111111111111": "🐱",
  "c2222222-2222-2222-2222-222222222222": "🐶",
  "c3333333-3333-3333-3333-333333333333": "🧸",
  "c4444444-4444-4444-4444-444444444444": "👕",
  "c5555555-5555-5555-5555-555555555555": "💊",
};
const getEmoji = (id: string | null) => (id && CATEGORY_EMOJI[id]) || "🏠";

/* ── Loading Skeleton ── */
const DetailSkeleton = () => (
  <div className="min-h-screen bg-background pb-24">
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="h-5 w-24" />
      </div>
    </header>
    <div className="max-w-lg mx-auto">
      <Skeleton className="aspect-square w-full" />
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="px-4 mt-4 space-y-3">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Derived price/stock from selected SKU or product defaults
  const activePrice = selectedSku?.price ?? product?.price ?? 0;
  const activeOriginalPrice = selectedSku?.original_price ?? product?.original_price;
  const activeStock = selectedSku?.stock ?? product?.stock ?? 0;

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const { data: p } = await supabase.from("products").select("*").eq("id", id).single();
      if (!p) { setLoading(false); return; }
      setProduct(p as any);

      const [merchantRes, reviewRes, skuRes] = await Promise.all([
        supabase.from("merchants").select("id, name, is_verified, description").eq("id", p.merchant_id).single(),
        supabase.from("order_reviews" as any).select("*").limit(10),
        supabase.from("product_skus" as any).select("*").eq("product_id", id).order("sort_order", { ascending: true }),
      ]);
      if (merchantRes.data) setMerchant(merchantRes.data as any);
      if (reviewRes.data) setReviews((reviewRes.data as any[]).slice(0, 5));
      if (skuRes.data && (skuRes.data as any[]).length > 0) {
        const skuList = skuRes.data as ProductSku[];
        setSkus(skuList);
        setSelectedSku(skuList[0]); // default select first SKU
      }

      if (user) {
        const { data: fav } = await supabase.from("favorites").select("id").eq("user_id", user.id).eq("product_id", id).maybeSingle();
        setIsFav(!!fav);
        await supabase.from("browsing_history").insert({ user_id: user.id, product_id: id });
      }
      setLoading(false);
    };
    fetchAll();
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!product) return;
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", product.id);
      setIsFav(false);
      toast({ title: "已取消收藏" });
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, product_id: product.id });
      setIsFav(true);
      toast({ title: "已收藏" });
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    const skuLabel = selectedSku ? ` (${selectedSku.name})` : "";
    for (let i = 0; i < quantity; i++) {
      cart.addItem({
        id: selectedSku ? `${product.id}_${selectedSku.id}` : product.id,
        name: product.name + skuLabel,
        price: activePrice,
        originalPrice: activeOriginalPrice,
        categoryId: product.category_id,
        merchantName: merchant?.name || "商家",
      });
    }
    toast({ title: "已加入购物车", description: `${product.name}${skuLabel} x${quantity}` });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate("/payment", {
      state: {
        order_type: "shop",
        service_type: "商城购物",
        total_amount: activePrice * quantity,
        service_label: `${quantity}件商品`,
        cart_items: cart.items,
      },
    });
  };

  const images = product?.images?.length ? product.images : [null];

  if (loading) return <DetailSkeleton />;

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">商品不存在</p>
        <Button variant="outline" onClick={() => navigate("/shop")}>返回商城</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground truncate">商品详情</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Image Carousel */}
        <div className="relative aspect-square bg-muted flex items-center justify-center">
          {product.cover_image ? (
            <img src={product.cover_image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-8xl">{getEmoji(product.category_id)}</span>
          )}
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => setCurrentImage((p) => (p - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/70 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setCurrentImage((p) => (p + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/70 flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <div key={i} className={cn("w-2 h-2 rounded-full", i === currentImage ? "bg-primary" : "bg-background/50")} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Price & Title */}
        <div className="px-4 pt-4 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-extrabold text-3xl">¥{activePrice}</span>
            {activeOriginalPrice && (
              <span className="text-muted-foreground line-through text-lg">¥{activeOriginalPrice}</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-foreground">{product.name}</h2>
          <div className="flex items-center gap-2">
            {product.brand && <Badge variant="secondary">{product.brand}</Badge>}
            <span className="text-xs text-muted-foreground">已售 {product.sales_count} · 库存 {activeStock}</span>
          </div>
        </div>

        {/* SKU Selection */}
        {skus.length > 0 && (
          <div className="px-4 mt-4">
            <p className="text-sm font-semibold text-foreground mb-2">规格选择</p>
            <div className="flex flex-wrap gap-2">
              {skus.map((sku) => (
                <button
                  key={sku.id}
                  type="button"
                  onClick={() => { setSelectedSku(sku); setQuantity(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                    selectedSku?.id === sku.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border text-foreground hover:border-primary/50"
                  )}
                >
                  {sku.name}
                  <span className="ml-1 text-xs text-muted-foreground">¥{sku.price}</span>
                </button>
              ))}
            </div>
            {selectedSku && Object.keys(selectedSku.attributes).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(selectedSku.attributes).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quantity */}
        <div className="px-4 mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">数量</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold">{quantity}</span>
            <button type="button" onClick={() => setQuantity(Math.min(activeStock, quantity + 1))} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Merchant */}
        {merchant && (
          <div className="px-4 mt-4">
            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{merchant.name}</span>
                  {merchant.is_verified && <ShieldCheck className="w-4 h-4 text-primary" />}
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/customer-service")}>联系商家</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="px-4 mt-4">
            <h3 className="text-sm font-bold text-foreground mb-2">商品详情</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Reviews */}
        <div className="px-4 mt-6">
          <h3 className="text-sm font-bold text-foreground mb-3">用户评价 ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无评价</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("w-3.5 h-3.5", s <= r.rating ? "text-amber-400 fill-amber-400" : "text-border")} />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {format(new Date(r.created_at), "yyyy-MM-dd")}
                      </span>
                    </div>
                    {r.content && <p className="text-sm text-foreground">{r.content}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
        <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-3">
          <button type="button" onClick={toggleFav} className="flex flex-col items-center gap-0.5 min-w-[44px]">
            <Heart className={cn("w-5 h-5", isFav ? "text-primary fill-primary" : "text-muted-foreground")} />
            <span className="text-[10px] text-muted-foreground">收藏</span>
          </button>
          <button type="button" onClick={() => navigate("/shop")} className="flex flex-col items-center gap-0.5 min-w-[44px]">
            <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">购物车</span>
          </button>
          <Button variant="warm" className="flex-1" onClick={handleAddToCart}>
            加入购物车
          </Button>
          <Button variant="hero" className="flex-1" onClick={handleBuyNow}>
            立即购买
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
