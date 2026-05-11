import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product { id: string; name: string; price: number; cover_image: string | null }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  postId: string;
  onAdded?: () => void;
}

const ProductPicker = ({ open, onOpenChange, postId, onAdded }: Props) => {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data: links } = await supabase.from("post_product_links" as any).select("product_id").eq("post_id", postId);
      setLinked(((links as any[]) || []).map((l) => l.product_id));
      void search("");
    })();
  }, [open, postId]);

  const search = async (kw: string) => {
    setLoading(true);
    let query = supabase.from("products").select("id,name,price,cover_image").limit(20);
    if (kw.trim()) query = query.ilike("name", `%${kw.trim()}%`);
    const { data } = await query;
    setItems((data as Product[]) || []);
    setLoading(false);
  };

  const toggle = async (p: Product) => {
    if (linked.includes(p.id)) {
      const { error } = await supabase.from("post_product_links" as any).delete().eq("post_id", postId).eq("product_id", p.id);
      if (error) return toast.error(error.message);
      setLinked(linked.filter((id) => id !== p.id));
    } else {
      const { error } = await supabase.from("post_product_links" as any).insert({ post_id: postId, product_id: p.id });
      if (error) return toast.error(error.message);
      setLinked([...linked, p.id]);
      toast.success("已挂载");
    }
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>挂载商城商品</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索商品名称" value={q}
            onChange={(e) => { setQ(e.target.value); }}
            onKeyDown={(e) => e.key === "Enter" && search(q)} />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? <p className="text-center text-muted-foreground py-8 text-sm">加载中…</p>
            : items.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">无结果</p>
            : items.map((p) => {
              const isLinked = linked.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                    {p.cover_image ? <img src={p.cover_image} className="w-full h-full object-cover" />
                      : <ShoppingBag className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-primary text-xs font-bold">¥{Number(p.price).toFixed(2)}</p>
                  </div>
                  <Button size="sm" variant={isLinked ? "outline" : "default"} onClick={() => toggle(p)}>
                    {isLinked ? <><X className="w-3 h-3 mr-1" />取消</> : "挂载"}
                  </Button>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductPicker;
