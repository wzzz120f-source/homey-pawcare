import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, MapPin, Star, Trash2, Edit3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

interface Address {
  id: string;
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postal_code: string | null;
  is_default: boolean;
}

const schema = z.object({
  recipient: z.string().trim().min(1, "请填写收件人").max(40),
  phone: z.string().trim().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  province: z.string().trim().min(1, "省").max(20),
  city: z.string().trim().min(1, "市").max(20),
  district: z.string().trim().min(1, "区").max(20),
  detail: z.string().trim().min(2, "详细地址至少 2 字").max(120),
});

const empty = { recipient: "", phone: "", province: "", city: "", district: "", detail: "", postal_code: "", is_default: false };

const AddressBookPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [sp] = useSearchParams();
  const pickMode = sp.get("pick") === "1";
  const [list, setList] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof empty & { id?: string }) | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    void load();
  }, [user, authLoading]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("加载失败：" + error.message);
    setList((data as any) || []);
    setLoading(false);
  };

  const save = async () => {
    if (!editing || !user) return;
    const r = schema.safeParse(editing);
    if (!r.success) { toast.error(Object.values(r.error.flatten().fieldErrors)[0]?.[0] || "信息有误"); return; }
    const payload = { ...editing, user_id: user.id, postal_code: editing.postal_code || null };
    const op = editing.id
      ? supabase.from("shipping_addresses").update(payload).eq("id", editing.id)
      : supabase.from("shipping_addresses").insert(payload);
    const { error } = await op;
    if (error) { toast.error(error.message); return; }
    toast.success("已保存");
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("删除该地址？")) return;
    const { error } = await supabase.from("shipping_addresses").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("已删除"); void load(); }
  };

  const setDefault = async (id: string) => {
    const { error } = await supabase.from("shipping_addresses").update({ is_default: true }).eq("id", id);
    if (error) toast.error(error.message); else void load();
  };

  const pick = (a: Address) => {
    sessionStorage.setItem("selected_shipping_address", JSON.stringify(a));
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="min-w-[40px] min-h-[40px] -ml-2 flex items-center justify-center rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold flex-1">{pickMode ? "选择收货地址" : "我的收货地址"}</h1>
          <Button size="sm" onClick={() => setEditing({ ...empty })} aria-label="新增地址">
            <Plus className="w-4 h-4 mr-1" />新增
          </Button>
        </div>
      </header>

      <main className="px-4 py-3 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : list.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">还没有收货地址，点击右上角新增</p>
          </div>
        ) : (
          list.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{a.recipient}</span>
                    <span className="text-sm text-muted-foreground">{a.phone}</span>
                    {a.is_default && <Badge className="bg-primary text-primary-foreground text-[10px] h-5">默认</Badge>}
                  </div>
                  <p className="text-sm text-foreground/80 mt-1 break-all">{a.province} {a.city} {a.district} {a.detail}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-border">
                {!a.is_default && (
                  <button onClick={() => setDefault(a.id)} className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 hover:text-primary">
                    <Star className="w-3.5 h-3.5" />设为默认
                  </button>
                )}
                <button onClick={() => setEditing({ ...a, postal_code: a.postal_code || "" })} className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 hover:text-primary">
                  <Edit3 className="w-3.5 h-3.5" />编辑
                </button>
                <button onClick={() => remove(a.id)} className="text-xs text-destructive flex items-center gap-1 px-2 py-1">
                  <Trash2 className="w-3.5 h-3.5" />删除
                </button>
                {pickMode && (
                  <Button size="sm" className="ml-auto h-8" onClick={() => pick(a)}>
                    <Check className="w-4 h-4 mr-1" />选这个
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end" onClick={() => setEditing(null)}>
          <div className="bg-background w-full max-w-lg mx-auto rounded-t-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">{editing.id ? "编辑地址" : "新增地址"}</h3>
            <Input placeholder="收件人" value={editing.recipient} onChange={(e) => setEditing({ ...editing, recipient: e.target.value })} maxLength={40} />
            <Input placeholder="手机号" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} maxLength={11} inputMode="tel" />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="省" value={editing.province} onChange={(e) => setEditing({ ...editing, province: e.target.value })} />
              <Input placeholder="市" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
              <Input placeholder="区" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} />
            </div>
            <Textarea placeholder="详细地址（街道、门牌号）" value={editing.detail} onChange={(e) => setEditing({ ...editing, detail: e.target.value })} maxLength={120} />
            <Input placeholder="邮编（选填）" value={editing.postal_code} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} maxLength={10} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
              设为默认地址
            </label>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>取消</Button>
              <Button className="flex-1" onClick={save}>保存</Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default AddressBookPage;
