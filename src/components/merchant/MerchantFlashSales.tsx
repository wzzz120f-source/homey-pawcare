import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

interface MerchantFlashSalesProps {
  merchantId: string;
}

interface FlashSaleRow {
  id: string;
  product_id: string;
  flash_price: number;
  original_price: number;
  stock: number;
  sold_count: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  products?: { name: string; price: number; cover_image: string | null } | null;
}

interface ProductLite {
  id: string;
  name: string;
  price: number;
}

const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

const MerchantFlashSales = ({ merchantId }: MerchantFlashSalesProps) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FlashSaleRow[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    flash_price: "",
    stock: "10",
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: toLocalInput(new Date(Date.now() + 24 * 3600_000).toISOString()),
  });

  const load = async () => {
    if (!merchantId) return;
    setLoading(true);
    const [{ data: prodList }, { data: fsList }] = await Promise.all([
      supabase.from("products").select("id,name,price").eq("merchant_id", merchantId),
      supabase
        .from("flash_sales")
        .select("*, products!inner(name, price, cover_image, merchant_id)")
        .eq("products.merchant_id", merchantId)
        .order("starts_at", { ascending: false }),
    ]);
    setProducts((prodList as ProductLite[]) || []);
    setRows((fsList as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [merchantId]);

  const submit = async () => {
    if (!form.product_id) return toast.error("请选择商品");
    const price = Number(form.flash_price);
    const stock = Number(form.stock);
    if (!price || price <= 0) return toast.error("请输入闪购价");
    if (!stock || stock <= 0) return toast.error("请输入库存");
    const startsAt = new Date(form.starts_at);
    const endsAt = new Date(form.ends_at);
    if (endsAt <= startsAt) return toast.error("结束时间必须晚于开始时间");

    const prod = products.find((p) => p.id === form.product_id);
    if (!prod) return toast.error("商品不存在");
    if (price >= prod.price) return toast.error("闪购价应低于原价");

    setSaving(true);
    const { error } = await supabase.from("flash_sales").insert({
      product_id: form.product_id,
      flash_price: price,
      original_price: prod.price,
      stock,
      sold_count: 0,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("闪购已创建");
    setOpen(false);
    load();
  };

  const toggle = async (row: FlashSaleRow) => {
    const { error } = await supabase
      .from("flash_sales")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (row: FlashSaleRow) => {
    if (!confirm("确认删除该闪购？")) return;
    const { error } = await supabase.from("flash_sales").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("已删除");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {rows.length} 个闪购活动</p>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
          <Plus className="w-4 h-4" /> 新增闪购
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          暂无闪购活动
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const now = Date.now();
            const live = r.is_active && new Date(r.starts_at).getTime() <= now && new Date(r.ends_at).getTime() > now;
            return (
              <div key={r.id} className="border rounded-lg p-3 bg-card">
                <div className="flex items-start gap-3">
                  {r.products?.cover_image ? (
                    <img src={r.products.cover_image} className="w-14 h-14 object-cover rounded-md" alt="" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center">
                      <Zap className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{r.products?.name || "—"}</p>
                      {live ? (
                        <Badge className="bg-orange-500 text-white">进行中</Badge>
                      ) : r.is_active ? (
                        <Badge variant="outline">已启用</Badge>
                      ) : (
                        <Badge variant="secondary">已停用</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="text-primary font-semibold">¥{r.flash_price}</span>
                      <span className="line-through ml-2">¥{r.original_price}</span>
                      <span className="ml-2">库存 {r.stock - r.sold_count}/{r.stock}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(r.starts_at).toLocaleString()} → {new Date(r.ends_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => toggle(r)}>
                    {r.is_active ? "停用" : "启用"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增闪购</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">选择商品</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="选择商品" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}（原价 ¥{p.price}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">闪购价（元）</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.flash_price}
                  onChange={(e) => setForm({ ...form, flash_price: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">活动库存</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">开始时间</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">结束时间</Label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantFlashSales;
