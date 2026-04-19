import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantOwnership } from "@/hooks/useMerchantOwnership";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ImagePlus, Loader2, Plus, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import MerchantDashboard from "@/components/merchant/MerchantDashboard";
import MerchantOrders from "@/components/merchant/MerchantOrders";

interface MerchantProduct {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  cover_image: string | null;
  images: string[] | null;
  is_active: boolean;
  sales_count: number;
  category_id: string | null;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MerchantCenterPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const { merchants, loading: ownLoading } = useMerchantOwnership(user?.id);

  const activeMerchantId = params.get("merchant") || merchants[0]?.id || "";
  const activeMerchant = merchants.find((m) => m.id === activeMerchantId);

  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editing, setEditing] = useState<MerchantProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // 表单
  const [form, setForm] = useState({
    name: "",
    brand: "",
    description: "",
    price: "",
    original_price: "",
    stock: "0",
    is_active: true,
  });

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!activeMerchantId) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setProductsLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,brand,price,original_price,stock,cover_image,images,is_active,sales_count,category_id")
        .eq("merchant_id", activeMerchantId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error("加载产品失败：" + error.message);
        setProducts([]);
      } else {
        setProducts((data || []) as MerchantProduct[]);
      }
      setProductsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeMerchantId]);

  const resetForm = () => {
    setForm({
      name: "",
      brand: "",
      description: "",
      price: "",
      original_price: "",
      stock: "0",
      is_active: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (p: MerchantProduct) => {
    setForm({
      name: p.name,
      brand: p.brand || "",
      description: p.description || "",
      price: String(p.price),
      original_price: p.original_price != null ? String(p.original_price) : "",
      stock: String(p.stock),
      is_active: p.is_active,
    });
    setEditing(p);
    setCreating(false);
  };

  const closeDialog = () => {
    setEditing(null);
    setCreating(false);
  };

  const handleSaveProduct = async () => {
    if (!activeMerchantId) return;
    if (!form.name.trim()) {
      toast.error("请填写商品名称");
      return;
    }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("请填写有效价格");
      return;
    }
    setSavingProduct(true);
    const payload = {
      merchant_id: activeMerchantId,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      description: form.description.trim() || null,
      price: priceNum,
      original_price: form.original_price ? Number(form.original_price) : null,
      stock: Math.max(0, parseInt(form.stock || "0", 10) || 0),
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) {
        toast.error("保存失败：" + error.message);
      } else {
        toast.success("已更新");
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)));
        closeDialog();
      }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (error) {
        toast.error("创建失败：" + error.message);
      } else if (data) {
        toast.success("商品已上架");
        setProducts((prev) => [data as MerchantProduct, ...prev]);
        closeDialog();
      }
    }
    setSavingProduct(false);
  };

  const handleDeleteProduct = async (p: MerchantProduct) => {
    if (!confirm(`确定删除「${p.name}」？此操作不可恢复。`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error("删除失败：" + error.message);
      return;
    }
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    toast.success("已删除");
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!activeMerchantId) return null;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`${file.name} 超过 8MB`);
      return null;
    }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${activeMerchantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) {
      toast.error("上传失败：" + error.message);
      return null;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleReplaceCover = async (product: MerchantProduct, file: File) => {
    setUploadingFor(product.id + ":cover");
    const url = await uploadFile(file);
    if (url) {
      const { error } = await supabase.from("products").update({ cover_image: url }).eq("id", product.id);
      if (error) {
        toast.error("更新主图失败：" + error.message);
      } else {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, cover_image: url } : p)));
        toast.success("主图已更新");
      }
    }
    setUploadingFor(null);
  };

  const handleAddGallery = async (product: MerchantProduct, files: FileList) => {
    setUploadingFor(product.id + ":gallery");
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }
    if (urls.length) {
      const next = [...(product.images || []), ...urls];
      const { error } = await supabase.from("products").update({ images: next }).eq("id", product.id);
      if (error) {
        toast.error("更新相册失败：" + error.message);
      } else {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, images: next } : p)));
        toast.success(`已新增 ${urls.length} 张图`);
      }
    }
    setUploadingFor(null);
  };

  const handleRemoveGalleryImage = async (product: MerchantProduct, url: string) => {
    const next = (product.images || []).filter((u) => u !== url);
    const { error } = await supabase.from("products").update({ images: next }).eq("id", product.id);
    if (error) {
      toast.error("移除失败：" + error.message);
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, images: next } : p)));
  };

  const headerTitle = activeMerchant ? activeMerchant.name : "商家中心";

  if (authLoading || ownLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!merchants.length) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="flex items-center gap-2 px-4 h-14 max-w-lg mx-auto">
            <Button size="icon" variant="ghost" onClick={() => navigate("/profile")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-extrabold text-lg">商家中心</span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <Store className="w-14 h-14 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-bold">你还不是商家</h2>
          <p className="text-sm text-muted-foreground">
            如需开通商家中心，请联系平台运营完成商家认证后，将你的账号关联至对应商家。
          </p>
          <Button variant="outline" onClick={() => navigate("/profile")}>返回个人中心</Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-2 px-4 h-14 max-w-lg mx-auto">
          <Button size="icon" variant="ghost" onClick={() => navigate("/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-extrabold text-lg flex-1 truncate">{headerTitle}</span>
          {activeMerchant?.is_verified && <Badge variant="secondary">已认证</Badge>}
        </div>
        {merchants.length > 1 && (
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <Select
              value={activeMerchantId}
              onValueChange={(v) => setParams({ merchant: v }, { replace: true })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择商家" />
              </SelectTrigger>
              <SelectContent>
                {merchants.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <Tabs defaultValue="dashboard">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dashboard" className="text-xs">看板</TabsTrigger>
            <TabsTrigger value="products" className="text-xs">产品</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">订单</TabsTrigger>
            <TabsTrigger value="info" className="text-xs">店铺</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <MerchantDashboard merchantId={activeMerchantId} />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <MerchantOrders merchantId={activeMerchantId} />
          </TabsContent>

          <TabsContent value="products" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {products.length} 个商品
              </p>
              <Button size="sm" onClick={openCreate} className="gap-1">
                <Plus className="w-4 h-4" /> 新增商品
              </Button>
            </div>

            {productsLoading ? (
              <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">暂无商品，点击右上角新增</div>
            ) : (
              <div className="space-y-3">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    uploadingKey={uploadingFor}
                    onEdit={() => openEdit(p)}
                    onDelete={() => handleDeleteProduct(p)}
                    onReplaceCover={(f) => handleReplaceCover(p, f)}
                    onAddGallery={(fs) => handleAddGallery(p, fs)}
                    onRemoveGalleryImage={(url) => handleRemoveGalleryImage(p, url)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-4">
            <MerchantInfoForm merchantId={activeMerchantId} />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={creating || !!editing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑商品" : "新增商品"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">商品名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
            </div>
            <div>
              <Label className="text-xs">品牌</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} maxLength={40} />
            </div>
            <div>
              <Label className="text-xs">描述</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">售价（元）</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">原价（元，可选）</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.original_price}
                  onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">库存</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <Label htmlFor="is_active" className="text-sm">立即上架</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>取消</Button>
            <Button onClick={handleSaveProduct} disabled={savingProduct}>
              {savingProduct ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

const ProductCard = ({
  product,
  uploadingKey,
  onEdit,
  onDelete,
  onReplaceCover,
  onAddGallery,
  onRemoveGalleryImage,
}: {
  product: MerchantProduct;
  uploadingKey: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onReplaceCover: (f: File) => void;
  onAddGallery: (fs: FileList) => void;
  onRemoveGalleryImage: (url: string) => void;
}) => {
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const isUploadingCover = uploadingKey === product.id + ":cover";
  const isUploadingGallery = uploadingKey === product.id + ":gallery";

  return (
    <div className="bg-card rounded-2xl p-3 card-shadow space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          className="relative w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 group"
        >
          {product.cover_image ? (
            <img src={product.cover_image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">无图</div>
          )}
          <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-background text-xs gap-1">
            {isUploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImagePlus className="w-4 h-4" /> 换主图</>}
          </div>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onReplaceCover(f);
              e.target.value = "";
            }}
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm truncate">{product.name}</h3>
            {!product.is_active && <Badge variant="outline" className="text-xs">下架</Badge>}
          </div>
          {product.brand && <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>}
          <p className="text-primary font-bold mt-1">¥{product.price}
            {product.original_price && (
              <span className="text-muted-foreground text-xs font-normal line-through ml-2">¥{product.original_price}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">库存 {product.stock} · 已售 {product.sales_count}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">相册图（{(product.images || []).length}）</span>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={isUploadingGallery}
            className="text-xs text-primary flex items-center gap-1 disabled:opacity-50"
          >
            {isUploadingGallery ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
            添加
          </button>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAddGallery(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {(product.images || []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(product.images || []).map((url) => (
              <div key={url} className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveGalleryImage(url)}
                  className="absolute -top-1 -right-1 bg-foreground/80 text-background rounded-full p-0.5"
                  aria-label="移除"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}>编辑信息</Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const MerchantInfoForm = ({ merchantId }: { merchantId: string }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    name: "",
    description: "",
    address: "",
    contact_phone: "",
    logo_url: "",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: row, error } = await supabase
        .from("merchants")
        .select("name,description,address,contact_phone,logo_url")
        .eq("id", merchantId)
        .maybeSingle();
      if (cancelled) return;
      if (error) toast.error("加载失败：" + error.message);
      if (row) {
        setData({
          name: row.name || "",
          description: row.description || "",
          address: row.address || "",
          contact_phone: row.contact_phone || "",
          logo_url: row.logo_url || "",
        });
      }
      setLoading(false);
    };
    if (merchantId) load();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("merchants")
      .update({
        name: data.name.trim(),
        description: data.description.trim() || null,
        address: data.address.trim() || null,
        contact_phone: data.contact_phone.trim() || null,
      })
      .eq("id", merchantId);
    if (error) toast.error("保存失败：" + error.message);
    else toast.success("已保存");
    setSaving(false);
  };

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-3 bg-card rounded-2xl p-4 card-shadow">
      <div>
        <Label className="text-xs">店铺名称</Label>
        <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">店铺描述</Label>
        <Textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} rows={3} />
      </div>
      <div>
        <Label className="text-xs">联系电话</Label>
        <Input value={data.contact_phone} onChange={(e) => setData({ ...data, contact_phone: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">地址</Label>
        <Input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} />
      </div>
      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "保存中..." : "保存"}
      </Button>
    </div>
  );
};

export default MerchantCenterPage;
