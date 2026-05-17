import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Hotel, Camera, LogIn, LogOut, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

interface HotelInfo {
  hotel_id: string;
  pet_hotels: { id: string; name: string; address: string } | null;
}

interface HotelOrder {
  id: string;
  order_no: string;
  user_id: string;
  pet_type: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  notes: string | null;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  created: "待支付",
  paid: "待入住",
  pending_accept: "待入住",
  confirmed: "待入住",
  accepted: "待入住",
  in_stay: "在住",
  awaiting_confirm: "待确认退房",
  completed: "已完成",
  cancelled: "已取消",
};

const HotelMerchantPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [hotels, setHotels] = useState<HotelInfo[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");
  const [orders, setOrders] = useState<HotelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    supabase
      .from("hotel_owners")
      .select("hotel_id, pet_hotels(id,name,address)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const list = (data ?? []) as any as HotelInfo[];
        setHotels(list);
        if (list[0]) setSelectedHotelId(list[0].hotel_id);
        if (list.length === 0) setLoading(false);
      });
  }, [user, authLoading, navigate]);

  const loadOrders = useCallback(async () => {
    if (!selectedHotelId) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id,order_no,user_id,pet_type,check_in,check_out,nights,notes,order_status,payment_status,total_amount,created_at")
      .eq("hotel_id", selectedHotelId)
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((data ?? []) as HotelOrder[]);
    setLoading(false);
  }, [selectedHotelId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filterOrders = (key: string) => {
    if (key === "pending") return orders.filter((o) => ["paid", "pending_accept", "confirmed", "accepted"].includes(o.order_status));
    if (key === "in_stay") return orders.filter((o) => o.order_status === "in_stay");
    if (key === "awaiting") return orders.filter((o) => o.order_status === "awaiting_confirm");
    return orders.filter((o) => ["completed", "cancelled"].includes(o.order_status));
  };

  const handleCheckin = async (orderId: string) => {
    const { data, error } = await supabase.rpc("hotel_checkin", { _order_id: orderId });
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "操作失败");
      return;
    }
    toast.success("入住已登记");
    loadOrders();
  };

  const handleCheckout = async (orderId: string) => {
    const { data, error } = await supabase.rpc("hotel_checkout", { _order_id: orderId });
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "操作失败");
      return;
    }
    toast.success("已发起退房，等待用户确认");
    loadOrders();
  };

  const handleUploadPhoto = async (orderId: string, hotelId: string, file: File) => {
    if (!user) return;
    setUploadingFor(orderId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${hotelId}/${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("hotel-visits")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("hotel-visits")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      const photoUrl = signed?.signedUrl || path;
      const { error: insErr } = await supabase.from("hotel_visit_photos").insert({
        order_id: orderId,
        hotel_id: hotelId,
        uploader_id: user.id,
        photo_url: photoUrl,
        caption: caption || null,
        visibility: "order_only",
      });
      if (insErr) throw insErr;
      toast.success("已上传，用户会收到通知");
      setCaption("");
    } catch (e: any) {
      toast.error(e?.message || "上传失败");
    } finally {
      setUploadingFor(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="px-4 h-14 flex items-center gap-2 border-b">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-bold">酒店后台</h1>
        </header>
        <Card className="m-4 p-6 text-center space-y-3">
          <Hotel className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            你的账号还未绑定任何酒店。请联系超管在控制台中绑定。
          </p>
        </Card>
        <BottomNav />
      </div>
    );
  }

  const currentHotel = hotels.find((h) => h.hotel_id === selectedHotelId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <Hotel className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-base truncate flex-1">
            {currentHotel?.pet_hotels?.name || "酒店后台"}
          </h1>
        </div>
        {hotels.length > 1 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
            {hotels.map((h) => (
              <button
                key={h.hotel_id}
                onClick={() => setSelectedHotelId(h.hotel_id)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                  h.hotel_id === selectedHotelId ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {h.pet_hotels?.name || h.hotel_id.slice(0, 6)}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="text-xs text-muted-foreground">待入住</div>
            <div className="text-xl font-bold">{filterOrders("pending").length}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-muted-foreground">在住</div>
            <div className="text-xl font-bold">{filterOrders("in_stay").length}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-muted-foreground">待确认</div>
            <div className="text-xl font-bold">{filterOrders("awaiting").length}</div>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="pending">待入住</TabsTrigger>
            <TabsTrigger value="in_stay">在住</TabsTrigger>
            <TabsTrigger value="awaiting">待确认</TabsTrigger>
            <TabsTrigger value="done">历史</TabsTrigger>
          </TabsList>

          {(["pending", "in_stay", "awaiting", "done"] as const).map((k) => (
            <TabsContent key={k} value={k} className="space-y-3 mt-3">
              {filterOrders(k).length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">暂无订单</Card>
              ) : (
                filterOrders(k).map((o) => (
                  <Card key={o.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">{o.order_no}</span>
                      <Badge variant="outline">{STATUS_LABEL[o.order_status] || o.order_status}</Badge>
                    </div>
                    <div className="text-sm">
                      <div>{o.pet_type || "宠物"} · {o.nights || 1} 晚 · ¥{Number(o.total_amount).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.check_in} → {o.check_out}
                      </div>
                      {o.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.notes}</div>}
                    </div>

                    <div className="flex gap-2 flex-wrap pt-1">
                      {k === "pending" && o.payment_status === "paid" && (
                        <Button size="sm" onClick={() => handleCheckin(o.id)}>
                          <LogIn className="w-3.5 h-3.5 mr-1" /> 办理入住
                        </Button>
                      )}
                      {(k === "in_stay" || k === "pending") && o.order_status === "in_stay" && (
                        <Button size="sm" variant="outline" onClick={() => handleCheckout(o.id)}>
                          <LogOut className="w-3.5 h-3.5 mr-1" /> 退房结算
                        </Button>
                      )}
                      {(k === "in_stay" || k === "awaiting") && (
                        <label className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-secondary cursor-pointer hover:bg-secondary/80">
                          {uploadingFor === o.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Camera className="w-3.5 h-3.5" />
                          )}
                          上传探视照片
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={uploadingFor === o.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadPhoto(o.id, selectedHotelId, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                      <Link to={`/orders/${o.id}`} className="text-xs underline text-primary self-center">详情</Link>
                    </div>

                    {(k === "in_stay" || k === "awaiting") && (
                      <Textarea
                        placeholder="给本次上传的照片加一句话（可选，提交前填好）"
                        value={uploadingFor === o.id ? caption : caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="text-xs min-h-[40px]"
                      />
                    )}
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Card className="p-3 text-[11px] text-muted-foreground flex gap-2">
          <Upload className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            所有探视照片均存放在私有空间，仅订单用户与本酒店账号可见，平台不会公开。
            请勿上传含他人或敏感信息的照片。
          </div>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
};

export default HotelMerchantPage;
