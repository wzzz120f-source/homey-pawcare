import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Syringe, AlertTriangle, Share2, Edit3, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

interface Vaccination {
  name: string;
  date: string;
  expires_at: string;
}

interface Pet {
  id: string;
  user_id: string;
  name: string;
  pet_type: string;
  breed: string | null;
  weight_kg: number | null;
  birthday: string | null;
  avatar_url: string | null;
  vaccinations: Vaccination[];
  allergies: string[];
  behavior_notes: string[];
  notes: string | null;
  auto_share: boolean;
  is_default: boolean;
}

const PET_EMOJIS: Record<string, string> = { dog: "🐶", cat: "🐱", rabbit: "🐰", bird: "🐦", other: "🐾" };

const isVaccineActive = (expires_at: string) => {
  if (!expires_at) return false;
  return new Date(expires_at) > new Date();
};

const PetProfilesPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Pet | null>(null);
  const [open, setOpen] = useState(false);

  const fetchPets = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "加载失败", description: error.message, variant: "destructive" });
    } else {
      setPets((data || []) as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchPets();
  }, [user, authLoading]);

  const openNew = () => {
    setEditing({
      id: "",
      user_id: user!.id,
      name: "",
      pet_type: "dog",
      breed: "",
      weight_kg: null,
      birthday: null,
      avatar_url: "",
      vaccinations: [],
      allergies: [],
      behavior_notes: [],
      notes: "",
      auto_share: true,
      is_default: pets.length === 0,
    });
    setOpen(true);
  };

  const openEdit = (pet: Pet) => {
    setEditing({ ...pet, vaccinations: pet.vaccinations || [], allergies: pet.allergies || [], behavior_notes: pet.behavior_notes || [] });
    setOpen(true);
  };

  const save = async () => {
    if (!editing || !user) return;
    if (!editing.name.trim()) {
      toast({ title: "请填写宠物名称", variant: "destructive" });
      return;
    }
    const payload: any = {
      user_id: user.id,
      name: editing.name.trim(),
      pet_type: editing.pet_type,
      breed: editing.breed || null,
      weight_kg: editing.weight_kg,
      birthday: editing.birthday,
      avatar_url: editing.avatar_url || null,
      vaccinations: editing.vaccinations,
      allergies: editing.allergies,
      behavior_notes: editing.behavior_notes,
      notes: editing.notes,
      auto_share: editing.auto_share,
      is_default: editing.is_default,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("pets").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("pets").insert(payload));
    }
    if (error) {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "已保存" });
    setOpen(false);
    setEditing(null);
    fetchPets();
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除这只宠物档案？")) return;
    const { error } = await supabase.from("pets").delete().eq("id", id);
    if (error) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
      return;
    }
    fetchPets();
  };

  const toggleAutoShare = async (pet: Pet) => {
    const { error } = await supabase.from("pets").update({ auto_share: !pet.auto_share }).eq("id", pet.id);
    if (error) {
      toast({ title: "操作失败", description: error.message, variant: "destructive" });
    } else {
      fetchPets();
    }
  };

  const updateField = <K extends keyof Pet>(key: K, value: Pet[K]) => {
    setEditing((p) => (p ? { ...p, [key]: value } : p));
  };

  const addVaccination = () =>
    updateField("vaccinations", [...(editing?.vaccinations || []), { name: "", date: "", expires_at: "" }]);

  const updateVaccination = (i: number, field: keyof Vaccination, value: string) => {
    const list = [...(editing?.vaccinations || [])];
    list[i] = { ...list[i], [field]: value };
    updateField("vaccinations", list);
  };

  const removeVaccination = (i: number) => {
    const list = [...(editing?.vaccinations || [])];
    list.splice(i, 1);
    updateField("vaccinations", list);
  };

  const parseTags = (raw: string) => raw.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">宠物档案</h1>
          <Button size="sm" onClick={openNew} className="ml-auto gap-1">
            <Plus className="w-4 h-4" /> 新增
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 text-sm flex gap-2">
          <Share2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-foreground/90">
            开启「自动共享」后，下单时档案（疫苗/过敏/禁忌）将自动推送给司机，无需手填。
          </p>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中…</div>
        ) : pets.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <PawPrint className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">还没有宠物档案，建一个吧</p>
            <Button onClick={openNew}>新增宠物</Button>
          </div>
        ) : (
          pets.map((pet) => {
            const activeVac = pet.vaccinations?.filter((v) => isVaccineActive(v.expires_at)).length || 0;
            const totalVac = pet.vaccinations?.length || 0;
            return (
              <article key={pet.id} className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-3xl shrink-0">
                    {pet.avatar_url ? (
                      <img src={pet.avatar_url} alt={pet.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      PET_EMOJIS[pet.pet_type] || "🐾"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{pet.name}</h3>
                      {pet.is_default && <Badge variant="secondary" className="text-[10px]">默认</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pet.breed || PET_EMOJIS[pet.pet_type]} · {pet.weight_kg ? `${pet.weight_kg}kg` : "未填重量"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button onClick={() => openEdit(pet)} className="p-2 hover:bg-muted rounded-lg" aria-label="编辑">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(pet.id)} className="p-2 hover:bg-muted rounded-lg text-destructive" aria-label="删除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Syringe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>
                    疫苗 {activeVac}/{totalVac} 有效
                  </span>
                  {totalVac > activeVac && <Badge variant="destructive" className="text-[10px]">部分待更新</Badge>}
                </div>

                {pet.allergies.length > 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {pet.allergies.map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {pet.behavior_notes.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-xs">
                    {pet.behavior_notes.map((n) => (
                      <span key={n} className="px-2 py-0.5 rounded-full bg-muted">
                        {n}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2 text-xs">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>下单时自动共享给司机</span>
                  </div>
                  <Switch checked={pet.auto_share} onCheckedChange={() => toggleAutoShare(pet)} />
                </div>
              </article>
            );
          })
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "编辑宠物" : "新增宠物"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>名称 *</Label>
                  <Input value={editing.name} onChange={(e) => updateField("name", e.target.value)} placeholder="奶茶" />
                </div>
                <div>
                  <Label>类型</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={editing.pet_type}
                    onChange={(e) => updateField("pet_type", e.target.value)}
                  >
                    <option value="dog">🐶 狗</option>
                    <option value="cat">🐱 猫</option>
                    <option value="rabbit">🐰 兔</option>
                    <option value="bird">🐦 鸟</option>
                    <option value="other">🐾 其它</option>
                  </select>
                </div>
                <div>
                  <Label>品种</Label>
                  <Input value={editing.breed || ""} onChange={(e) => updateField("breed", e.target.value)} placeholder="柯基" />
                </div>
                <div>
                  <Label>体重 (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editing.weight_kg ?? ""}
                    onChange={(e) => updateField("weight_kg", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>生日</Label>
                  <Input type="date" value={editing.birthday || ""} onChange={(e) => updateField("birthday", e.target.value || null)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-1"><Syringe className="w-4 h-4" /> 疫苗记录</Label>
                  <Button size="sm" variant="outline" onClick={addVaccination}>+ 添加</Button>
                </div>
                <div className="space-y-2">
                  {editing.vaccinations.map((v, i) => (
                    <div key={i} className="grid grid-cols-7 gap-1 items-center">
                      <Input
                        className="col-span-3"
                        placeholder="名称"
                        value={v.name}
                        onChange={(e) => updateVaccination(i, "name", e.target.value)}
                      />
                      <Input
                        className="col-span-3"
                        type="date"
                        value={v.expires_at}
                        onChange={(e) => updateVaccination(i, "expires_at", e.target.value)}
                      />
                      <button onClick={() => removeVaccination(i)} className="text-destructive justify-self-end" aria-label="删除疫苗">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {editing.vaccinations.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无疫苗记录</p>
                  )}
                </div>
              </div>

              <div>
                <Label>过敏 (逗号分隔)</Label>
                <Input
                  placeholder="花生,鸡肉"
                  defaultValue={editing.allergies.join(", ")}
                  onBlur={(e) => updateField("allergies", parseTags(e.target.value))}
                />
              </div>

              <div>
                <Label>行为禁忌 (逗号分隔)</Label>
                <Input
                  placeholder="晕车,怕雷声"
                  defaultValue={editing.behavior_notes.join(", ")}
                  onBlur={(e) => updateField("behavior_notes", parseTags(e.target.value))}
                />
              </div>

              <div>
                <Label>备注</Label>
                <Textarea
                  rows={2}
                  value={editing.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="性格 / 特殊照护要点"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <p className="font-medium">下单时自动共享</p>
                  <p className="text-xs text-muted-foreground">把档案推给司机，提前知晓</p>
                </div>
                <Switch checked={editing.auto_share} onCheckedChange={(v) => updateField("auto_share", v)} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <p className="font-medium">设为默认宠物</p>
                  <p className="text-xs text-muted-foreground">下单时优先选择</p>
                </div>
                <Switch checked={editing.is_default} onCheckedChange={(v) => updateField("is_default", v)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default PetProfilesPage;
