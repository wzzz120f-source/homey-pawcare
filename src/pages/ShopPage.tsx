import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, MessageCircle, ChevronRight, Search, ShoppingCart, Plus, Minus, Trash2, Heart, ArrowUpDown } from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";
import FlashSaleSection from "@/components/FlashSaleSection";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  original_price: number | null;
  cover_image: string | null;
  stock: number;
  sales_count: number;
  merchant_id: string;
  category_id: string | null;
}

interface Merchant {
  id: string;
  name: string;
  logo_url: string | null;
  license_number: string | null;
  description: string | null;
  contact_phone: string | null;
  is_verified: boolean;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "c1111111-1111-1111-1111-111111111111": "🐱",
  "c2222222-2222-2222-2222-222222222222": "🐶",
  "c3333333-3333-3333-3333-333333333333": "🧸",
  "c4444444-4444-4444-4444-444444444444": "👕",
  "c5555555-5555-5555-5555-555555555555": "💊",
};

const getEmoji = (categoryId: string | null) => (categoryId && CATEGORY_EMOJI[categoryId]) || "🏠";

const ShopPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cart = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortBy, setSortBy] = useState<"sales" | "price_asc" | "price_desc">("sales");
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showMerchantDialog, setShowMerchantDialog] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  useEffect(() => {
    fetchCategories();
    fetchMerchants();
  }, []);

  // 检测 env(safe-area-inset-bottom) 与 CSS 变量支持情况，不可用时打印降级日志
  useEffect(() => {
    if (typeof window === "undefined" || !window.CSS || typeof CSS.supports !== "function") {
      console.warn("[SafeArea] CSS.supports 不可用，已启用固定 padding 1.5rem 降级方案");
      return;
    }
    try {
      const supportsEnv =
        CSS.supports("padding-bottom: env(safe-area-inset-bottom)") ||
        CSS.supports("padding-bottom: constant(safe-area-inset-bottom)");
      const supportsVar = CSS.supports("color", "var(--fake, #000)");
      if (!supportsEnv || !supportsVar) {
        console.warn(
          "[SafeArea] 降级生效 — env() 支持:", supportsEnv,
          "| CSS 变量支持:", supportsVar,
          "→ 使用固定 padding 1.5rem 兜底，确保「去结算」按钮可点击"
        );
      }
    } catch (err) {
      console.warn("[SafeArea] 检测异常，启用固定 padding 兜底:", err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery, brandFilter, sortBy]);

  // Fetch user favorites
  useEffect(() => {
    if (!user) return;
    const fetchFavs = async () => {
      const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
      if (data) setFavoriteIds(new Set(data.map((f: any) => f.product_id)));
    };
    fetchFavs();
  }, [user]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("product_categories").select("*").order("sort_order");
    if (data) setCategories(data);
  };

  const fetchMerchants = async () => {
    const { data } = await supabase.from("merchants").select("*");
    if (data) setMerchants(data);
  };

  const fetchProducts = async () => {
    const orderCol = sortBy === "sales" ? "sales_count" : "price";
    const ascending = sortBy === "price_asc";
    let query = supabase.from("products").select("*").order(orderCol, { ascending: sortBy === "price_asc" ? true : sortBy === "price_desc" ? false : false });
    if (selectedCategory) query = query.eq("category_id", selectedCategory);
    if (searchQuery) query = query.or(`name.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%`);
    if (brandFilter) query = query.eq("brand", brandFilter);
    const { data } = await query;
    if (data) {
      setProducts(data);
      // Extract unique brands
      const brands = [...new Set(data.map((p: any) => p.brand).filter(Boolean))] as string[];
      if (allBrands.length === 0 && brands.length > 0) setAllBrands(brands);
    }
  };

  const getMerchant = (merchantId: string) => merchants.find((m) => m.id === merchantId);

  const handleAddToCart = (product: Product) => {
    const merchant = getMerchant(product.merchant_id);
    cart.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.original_price,
      categoryId: product.category_id,
      merchantName: merchant?.name || "未知商家",
    });
    toast({ title: "已加入购物车", description: product.name });
  };

  const handleToggleFavorite = async (productId: string) => {
    if (!user) {
      toast({ title: "请先登录", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (favoriteIds.has(productId)) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId);
      setFavoriteIds((prev) => { const n = new Set(prev); n.delete(productId); return n; });
      toast({ title: "已取消收藏" });
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
      setFavoriteIds((prev) => new Set(prev).add(productId));
      toast({ title: "已收藏" });
    }
  };

  const trackBrowsing = async (productId: string) => {
    if (!user) return;
    await supabase.from("browsing_history").insert({ user_id: user.id, product_id: productId });
  };

  const handleCheckout = () => {
    if (cart.totalItems === 0) return;
    setShowCart(false);
    navigate("/payment", {
      state: {
        order_type: "shop",
        service_type: "商城购物",
        total_amount: cart.totalAmount,
        service_label: `${cart.totalItems}件商品`,
        cart_items: cart.items,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索商品..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-full bg-muted border-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
            aria-label="购物车"
          >
            <ShoppingCart className="w-5 h-5 text-foreground" />
            {cart.totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.totalItems > 99 ? "99+" : cart.totalItems}
              </span>
            )}
          </button>
        </div>

        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            <Badge
              variant={selectedCategory === null ? "default" : "secondary"}
              className="cursor-pointer whitespace-nowrap shrink-0 px-3 py-1"
              onClick={() => setSelectedCategory(null)}
            >
              全部
            </Badge>
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "secondary"}
                className="cursor-pointer whitespace-nowrap shrink-0 px-3 py-1"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.icon} {cat.name}
              </Badge>
            ))}
          </div>
        </ScrollArea>

        {/* Filters Row */}
        <div className="flex gap-2 mt-2">
          {allBrands.length > 0 && (
            <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="品牌筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部品牌</SelectItem>
                {allBrands.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-8 text-xs w-28">
              <ArrowUpDown className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">销量优先</SelectItem>
              <SelectItem value="price_asc">价格低→高</SelectItem>
              <SelectItem value="price_desc">价格高→低</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Banner Carousel & Flash Sales */}
      <BannerCarousel />
      <FlashSaleSection />

      {/* Merchant Banners */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold text-foreground mb-2">认证商家</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {merchants.map((m) => (
            <Card
              key={m.id}
              className="shrink-0 w-40 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setSelectedMerchant(m); setShowMerchantDialog(true); }}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm font-semibold text-foreground truncate">{m.name}</span>
                  {m.is_verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 pt-2">
        <h2 className="text-sm font-bold text-foreground mb-2">
          {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : "热门商品"}
          <span className="text-muted-foreground font-normal ml-1">({products.length})</span>
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => {
            const merchant = getMerchant(product.merchant_id);
            const cartItem = cart.items.find((i) => i.id === product.id);
            return (
              <Card key={product.id} className="overflow-hidden">
                <div
                  className="aspect-square bg-muted flex items-center justify-center text-4xl cursor-pointer"
                  onClick={() => { navigate(`/product/${product.id}`); trackBrowsing(product.id); }}
                >
                  {getEmoji(product.category_id)}
                </div>
                <CardContent className="p-2.5">
                  <p
                    className="text-sm font-medium text-foreground line-clamp-2 mb-1 cursor-pointer"
                    onClick={() => { navigate(`/product/${product.id}`); trackBrowsing(product.id); }}
                  >
                    {product.name}
                  </p>
                  {product.brand && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mb-1">{product.brand}</Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-primary font-bold text-base">¥{product.price}</span>
                      {product.original_price && (
                        <span className="text-muted-foreground text-xs line-through">¥{product.original_price}</span>
                      )}
                    </div>
                    {cartItem ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => cart.updateQuantity(product.id, cartItem.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center"
                          aria-label="减少数量"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{cartItem.quantity}</span>
                        <button
                          type="button"
                          onClick={() => cart.updateQuantity(product.id, cartItem.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          aria-label="增加数量"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        aria-label={`加入购物车 ${product.name}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">已售 {product.sales_count}</span>
                    {merchant && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{merchant.name}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {products.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">暂无商品</div>
        )}
      </div>

      {/* Cart Floating Bar */}
      {cart.totalItems > 0 && !showCart && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2">
          <div className="max-w-lg mx-auto bg-card rounded-2xl card-shadow p-3 flex items-center gap-3 border border-border">
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="relative"
              aria-label="打开购物车"
            >
              <ShoppingCart className="w-6 h-6 text-primary" />
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cart.totalItems}
              </span>
            </button>
            <div className="flex-1">
              <span className="text-lg font-extrabold text-primary">¥{cart.totalAmount.toFixed(2)}</span>
            </div>
            <Button variant="hero" size="sm" onClick={handleCheckout}>
              去结算
            </Button>
          </div>
        </div>
      )}

      {/* Cart Drawer - bottom sheet */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 rounded-t-2xl">
          <SheetHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> 购物车 ({cart.totalItems})
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {cart.items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">购物车是空的</p>
            ) : (
              cart.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl shrink-0">
                    {getEmoji(item.categoryId)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.merchantName}</p>
                    <span className="text-primary font-bold text-sm">¥{item.price}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center min-w-[28px]"
                      aria-label="减少"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center min-w-[28px]"
                      aria-label="增加"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cart.removeItem(item.id)}
                      className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center ml-1"
                      aria-label="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {cart.items.length > 0 && (
            <div className="safe-pb shrink-0 px-5 pt-4 border-t border-border bg-card space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">合计</span>
                <span className="text-2xl font-extrabold text-primary">¥{cart.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex gap-3 items-stretch">
                <Button
                  variant="outline"
                  onClick={() => cart.clearCart()}
                  className="flex-1 min-h-[52px] text-base"
                  aria-label="清空购物车"
                >
                  清空
                </Button>
                <Button
                  variant="hero"
                  onClick={handleCheckout}
                  className="flex-[2] min-h-[52px] text-base font-bold shadow-lg active:scale-[0.98] transition-transform"
                  aria-label={`去结算，共 ${cart.totalItems} 件商品`}
                >
                  去结算 ({cart.totalItems}件)
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedProduct && (() => {
            const merchant = getMerchant(selectedProduct.merchant_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-left">{selectedProduct.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-6xl">
                    {getEmoji(selectedProduct.category_id)}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-primary font-bold text-2xl">¥{selectedProduct.price}</span>
                      {selectedProduct.original_price && (
                        <span className="text-muted-foreground line-through">¥{selectedProduct.original_price}</span>
                      )}
                    </div>
                    {selectedProduct.brand && <Badge variant="secondary" className="mb-2">{selectedProduct.brand}</Badge>}
                    <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>库存: {selectedProduct.stock}</span>
                    <span>·</span>
                    <span>已售: {selectedProduct.sales_count}</span>
                  </div>
                  {merchant && (
                    <Card className="cursor-pointer" onClick={() => { setSelectedProduct(null); setSelectedMerchant(merchant); setShowMerchantDialog(true); }}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{merchant.name}</span>
                          {merchant.is_verified && <ShieldCheck className="w-4 h-4 text-primary" />}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(selectedProduct.id)}
                      className="w-11 h-11 rounded-xl border border-border flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
                      aria-label={favoriteIds.has(selectedProduct.id) ? "取消收藏" : "收藏"}
                    >
                      <Heart className={cn("w-5 h-5", favoriteIds.has(selectedProduct.id) ? "text-primary fill-primary" : "text-muted-foreground")} />
                    </button>
                    <Button variant="warm" className="flex-1" onClick={() => { setSelectedProduct(null); handleAddToCart(selectedProduct); }}>
                      <ShoppingCart className="w-4 h-4 mr-1" /> 加入购物车
                    </Button>
                    <Button variant="hero" className="flex-1" onClick={() => {
                      setSelectedProduct(null);
                      handleAddToCart(selectedProduct);
                      handleCheckout();
                    }}>
                      立即购买
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Merchant Detail Dialog */}
      <Dialog open={showMerchantDialog} onOpenChange={setShowMerchantDialog}>
        <DialogContent className="max-w-md">
          {selectedMerchant && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedMerchant.name}
                  {selectedMerchant.is_verified && <ShieldCheck className="w-5 h-5 text-primary" />}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedMerchant.description}</p>
                <div className="space-y-2 text-sm">
                  {selectedMerchant.license_number && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">营业执照:</span>
                      <span className="font-medium">{selectedMerchant.license_number}</span>
                    </div>
                  )}
                  {selectedMerchant.contact_phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">联系电话:</span>
                      <span className="font-medium">{selectedMerchant.contact_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">认证状态:</span>
                    <Badge variant={selectedMerchant.is_verified ? "default" : "secondary"}>
                      {selectedMerchant.is_verified ? "已认证" : "未认证"}
                    </Badge>
                  </div>
                </div>
                <Button variant="warm" className="w-full" onClick={() => { setShowMerchantDialog(false); navigate("/customer-service"); }}>
                  <MessageCircle className="w-4 h-4 mr-1" /> 联系商家
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default ShopPage;
