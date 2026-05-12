import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ToggleRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { refreshFeatureFlags } from "@/hooks/useFeatureFlag";

interface Flag { key: string; enabled: boolean; description: string | null; updated_at: string; }

const DevFlagsPage = () => {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("feature_flags").select("*").order("key");
    setFlags((data as Flag[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (f: Flag, value: boolean) => {
    const { data, error } = await supabase.rpc("dev_set_flag", { _key: f.key, _enabled: value, _payload: null });
    if (error || !(data as any)?.success) { toast.error("更新失败"); return; }
    toast.success(`${f.key} 已${value ? "开启" : "关闭"}`);
    refreshFeatureFlags();
    load();
  };

  const create = async () => {
    if (!newKey.trim()) return;
    await supabase.rpc("dev_set_flag", { _key: newKey.trim(), _enabled: false, _payload: null });
    setNewKey("");
    load();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate("/__dev/console")} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold flex items-center gap-2"><ToggleRight className="w-5 h-5 text-primary" />功能开关</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        <Card className="p-4 flex gap-2">
          <Input placeholder="新增 flag key（如 new_feature）" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Button onClick={create}>新增</Button>
        </Card>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : flags.map((f) => (
          <Card key={f.key} className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-semibold">{f.key}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.description || "—"}</div>
            </div>
            <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f, v)} />
          </Card>
        ))}
      </main>
    </div>
  );
};

export default DevFlagsPage;
