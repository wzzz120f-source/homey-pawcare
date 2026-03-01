import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Star, MessageCircle, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
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

const ShopPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showMerchantDialog, setShowMerchantDialog] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchMerchants();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("product_categories").select("*").order("sort_order");
    if (data) setCategories(data);
  };

  const fetchMerchants = async () => {
    const { data } = await supabase.from("merchants").select("*");
    if (data) setMerchants(data);
  };

  const fetchProducts = async () => {
    let query = supabase.from("products").select("*").order("sales_count", { ascending: false });
    if (selectedCategory) query = query.eq("category_id", selectedCategory);
    if (searchQuery) query = query.ilike("name", `%${searchQuery}%`);
    const { data } = await query;
    if (data) setProducts(data);
  };

  const getMerchant = (merchantId: string) => merchants.find((m) => m.id === merchantId);

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
        </div>

        {/* Categories */}
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
      </div>

      {/* Merchant Banners */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">认证商家</h2>
        </div>
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
            return (
              <Card
                key={product.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="aspect-square bg-muted flex items-center justify-center text-4xl">
                  {product.category_id === "c1111111-1111-1111-1111-111111111111" ? "🐱" :
                   product.category_id === "c2222222-2222-2222-2222-222222222222" ? "🐶" :
                   product.category_id === "c3333333-3333-3333-3333-333333333333" ? "🧸" :
                   product.category_id === "c4444444-4444-4444-4444-444444444444" ? "👕" :
                   product.category_id === "c5555555-5555-5555-5555-555555555555" ? "💊" : "🏠"}
                </div>
                <CardContent className="p-2.5">
                  <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{product.name}</p>
                  {product.brand && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mb-1">{product.brand}</Badge>
                  )}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-primary font-bold text-base">¥{product.price}</span>
                    {product.original_price && (
                      <span className="text-muted-foreground text-xs line-through">¥{product.original_price}</span>
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
                    {selectedProduct.category_id === "c1111111-1111-1111-1111-111111111111" ? "🐱" :
                     selectedProduct.category_id === "c2222222-2222-2222-2222-222222222222" ? "🐶" :
                     selectedProduct.category_id === "c3333333-3333-3333-3333-333333333333" ? "🧸" :
                     selectedProduct.category_id === "c4444444-4444-4444-4444-444444444444" ? "👕" :
                     selectedProduct.category_id === "c5555555-5555-5555-5555-555555555555" ? "💊" : "🏠"}
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
                    <Button variant="warm" className="flex-1" onClick={() => navigate("/customer-service")}>
                      <MessageCircle className="w-4 h-4 mr-1" /> 咨询客服
                    </Button>
                    <Button variant="hero" className="flex-1">立即购买</Button>
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
