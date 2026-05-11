import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  cover_image: string | null;
}

interface Props { postId: string }

const PostProductCard = ({ postId }: Props) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: links } = await supabase
        .from("post_product_links" as any)
        .select("product_id")
        .eq("post_id", postId);
      const ids = ((links as any[]) || []).map((l) => l.product_id);
      if (ids.length === 0) return;
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,price,cover_image")
        .in("id", ids);
      setItems((prods as Product[]) || []);
    })();
  }, [postId]);

  if (items.length === 0) return null;

  return (
    <div className="px-4 pb-3 space-y-2">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => navigate(`/product/${p.id}`)}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border text-left transition-colors"
        >
          <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center overflow-hidden shrink-0">
            {p.cover_image ? <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover" />
              : <ShoppingBag className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
            <p className="text-primary font-bold text-sm">¥{Number(p.price).toFixed(2)}</p>
          </div>
          <span className="text-xs text-primary font-semibold flex items-center gap-0.5 shrink-0">
            去购买<ChevronRight className="w-3 h-3" />
          </span>
        </button>
      ))}
    </div>
  );
};

export default PostProductCard;
