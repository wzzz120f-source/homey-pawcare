import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Shield } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";

interface VisitPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
  taken_at: string;
  uploader_id: string;
}

interface Props {
  orderId: string;
}

export const VisitPhotoGallery = ({ orderId }: Props) => {
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<VisitPhoto | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("hotel_visit_photos")
        .select("id,photo_url,caption,taken_at,uploader_id")
        .eq("order_id", orderId)
        .eq("visibility", "order_only")
        .order("taken_at", { ascending: false });
      if (!cancelled) {
        setPhotos((data ?? []) as VisitPhoto[]);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`visit_photos_${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hotel_visit_photos", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.visibility === "order_only") {
            setPhotos((prev) => [{ ...row } as VisitPhoto, ...prev]);
          }
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [orderId]);

  return (
    <section className="bg-card rounded-2xl p-5 card-shadow space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-foreground text-base flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" /> 探视相册
        </h2>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Shield className="w-3 h-3" /> 仅你与酒店可见
        </span>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">加载中…</div>
      ) : photos.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          酒店还没有上传探视照片，请耐心等待 🐾
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreview(p)}
              className="aspect-square rounded-xl overflow-hidden bg-muted relative group"
            >
              <img
                src={p.photo_url}
                alt={p.caption || "探视照片"}
                className="w-full h-full object-cover group-hover:scale-105 transition"
                loading="lazy"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[9px] text-white">
                {format(new Date(p.taken_at), "MM-dd HH:mm")}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {preview && (
            <div className="space-y-2">
              <img src={preview.photo_url} alt="" className="w-full" />
              <div className="px-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(preview.taken_at), "yyyy-MM-dd HH:mm")}
                </p>
                {preview.caption && <p className="text-sm">{preview.caption}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VisitPhotoGallery;
