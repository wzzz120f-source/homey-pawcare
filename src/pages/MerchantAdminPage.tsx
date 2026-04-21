import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, ArrowUpDown, Loader2, Search, ShieldCheck, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Application {
  id: string;
  user_id: string;
  store_name: string;
  description: string | null;
  contact_name: string | null;
  contact_phone: string;
  address: string | null;
  license_number: string;
  license_image_url: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
}

const MerchantAdminPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchNote, setBatchNote] = useState("");
  const [batchActing, setBatchActing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin((data || []).some((r: any) => r.role === "admin"));
    };
    if (user) check();
  }, [user]);

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    const { data, error } = await supabase
      .from("merchant_applications")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: !sortDesc });
    if (error) toast.error(error.message);
    else setItems((data || []) as Application[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab, sortDesc]);

  const filteredItems = items.filter((app) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      app.store_name.toLowerCase().includes(q) ||
      app.contact_phone.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const handleApprove = async (id: string) => {
    setActing(id);
    const { data, error } = await (supabase as any).rpc("approve_merchant_application", {
      _application_id: id,
      _note: notes[id] || null,
    });
    if (error || !data?.success) {
      toast.error("审核失败：" + (error?.message || data?.error));
    } else {
      toast.success("已通过，并已为申请人开通商家中心");
      load();
    }
    setActing(null);
  };

  const handleReject = async (id: string) => {
    setActing(id);
    const { data, error } = await (supabase as any).rpc("reject_merchant_application", {
      _application_id: id,
      _note: notes[id] || null,
    });
    if (error || !data?.success) {
      toast.error("操作失败：" + (error?.message || data?.error));
    } else {
      toast.success("已驳回");
      load();
    }
    setActing(null);
  };

  const handleBatch = async (action: "approve" | "reject") => {
    if (selected.size === 0) {
      toast.error("请先勾选申请");
      return;
    }
    setBatchActing(true);
    const fn = action === "approve" ? "approve_merchant_application" : "reject_merchant_application";
    let success = 0;
    let failed = 0;
    for (const id of selected) {
      const { data, error } = await (supabase as any).rpc(fn, {
        _application_id: id,
        _note: batchNote || null,
      });
      if (error || !data?.success) failed++;
      else success++;
    }
    setBatchActing(false);
    setBatchNote("");
    if (success > 0) toast.success(`成功 ${success} 条${failed ? `，失败 ${failed} 条` : ""}`);
    else toast.error(`全部失败 (${failed})`);
    load();
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="flex items-center gap-2 px-4 h-14 max-w-lg mx-auto">
            <Button size="icon" variant="ghost" onClick={() => navigate("/profile")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-extrabold text-lg">商家审核（管理员）</span>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 py-12 text-center text-muted-foreground text-sm">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3" />
          仅平台管理员可访问。
        </div>
        <BottomNav />
      </div>
    );
  }

  const isPending = tab === "pending";
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-2 px-4 h-14 max-w-lg mx-auto">
          <Button size="icon" variant="ghost" onClick={() => navigate("/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-extrabold text-lg">商家入驻审核</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="pending">待审核</TabsTrigger>
            <TabsTrigger value="approved">已通过</TabsTrigger>
            <TabsTrigger value="rejected">已驳回</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {isPending && items.length > 0 && (
              <div className="bg-card rounded-2xl p-3 card-shadow space-y-2 sticky top-14 z-30">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                    全选（已选 {selected.size}/{items.length}）
                  </label>
                </div>
                {selected.size > 0 && (
                  <>
                    <Input
                      placeholder="批量备注（可选）"
                      value={batchNote}
                      onChange={(e) => setBatchNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-destructive border-destructive/40"
                        disabled={batchActing}
                        onClick={() => handleBatch("reject")}
                      >
                        {batchActing ? "..." : `批量驳回 (${selected.size})`}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={batchActing}
                        onClick={() => handleBatch("approve")}
                      >
                        {batchActing ? "..." : `批量通过 (${selected.size})`}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">暂无申请</div>
            ) : (
              items.map((app) => (
                <div key={app.id} className="bg-card rounded-2xl p-4 card-shadow space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {isPending && (
                        <Checkbox
                          className="mt-1"
                          checked={selected.has(app.id)}
                          onCheckedChange={() => toggleSelect(app.id)}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold truncate">{app.store_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(app.created_at), "yyyy-MM-dd HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-foreground/80">
                    {app.description && <p>简介：{app.description}</p>}
                    <p>联系：{app.contact_name || "-"} · {app.contact_phone}</p>
                    {app.address && <p>地址：{app.address}</p>}
                    <p>营业执照：{app.license_number}</p>
                  </div>
                  {app.license_image_url && (
                    <button
                      type="button"
                      className="relative block w-full group"
                      onClick={() => setPreviewUrl(app.license_image_url)}
                      aria-label="查看营业执照大图"
                    >
                      <img
                        src={app.license_image_url}
                        alt="营业执照"
                        className="w-full max-h-40 object-contain rounded-lg border border-border"
                      />
                      <span className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1.5 opacity-90">
                        <ZoomIn className="w-4 h-4" />
                      </span>
                    </button>
                  )}
                  {isPending ? (
                    <>
                      <Input
                        placeholder="审核备注（可选）"
                        value={notes[app.id] || ""}
                        onChange={(e) => setNotes({ ...notes, [app.id]: e.target.value })}
                      />
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive border-destructive/40"
                          disabled={acting === app.id}
                          onClick={() => handleReject(app.id)}
                        >
                          驳回
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={acting === app.id}
                          onClick={() => handleApprove(app.id)}
                        >
                          {acting === app.id ? "处理中..." : "通过并开通"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    app.review_note && <p className="text-xs text-muted-foreground">备注：{app.review_note}</p>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-0 bg-background/95 backdrop-blur border-0">
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-3 right-3 z-10 bg-background/80 rounded-full p-2 hover:bg-background"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
          {previewUrl && (
            <div className="w-full max-h-[90vh] overflow-auto p-4">
              <img
                src={previewUrl}
                alt="营业执照大图"
                className="w-full h-auto object-contain rounded-lg"
              />
              <div className="flex justify-center pt-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline"
                >
                  在新标签页打开原图
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default MerchantAdminPage;
