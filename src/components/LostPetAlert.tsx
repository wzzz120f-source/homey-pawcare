import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MapPin, Navigation } from "lucide-react";

const ALERT_RADIUS_KM = 5;
const DISMISS_KEY = "lost-pet-alert-dismissed";

interface LostPet {
  id: string;
  pet_name: string;
  pet_type: string;
  features: string;
  last_seen_location: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  reward_points: number;
  lost_at: string;
}

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const LostPetAlert = () => {
  const navigate = useNavigate();
  const [pet, setPet] = useState<(LostPet & { distance: number }) | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");

      const getLoc = (): Promise<{ lat: number; lng: number }> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve({ lat: 31.2304, lng: 121.4737 });
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve({ lat: 31.2304, lng: 121.4737 }),
            { timeout: 5000 }
          );
        });

      const loc = await getLoc();
      const { data } = await supabase
        .from("lost_pets" as any)
        .select("*")
        .eq("status", "searching")
        .order("lost_at", { ascending: false })
        .limit(20);

      if (!data || data.length === 0) return;

      // pick the closest searching pet within radius and not dismissed
      const enriched = (data as unknown as LostPet[])
        .filter((p) => !dismissed.includes(p.id))
        .map((p) => ({ ...p, distance: distanceKm(loc.lat, loc.lng, p.latitude, p.longitude) }))
        .filter((p) => p.distance <= ALERT_RADIUS_KM)
        .sort((a, b) => a.distance - b.distance);

      if (enriched.length === 0) return;
      setPet(enriched[0]);
      setOpen(true);
    };
    // delay slightly to let UI settle
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    if (pet) {
      const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed, pet.id]));
    }
    setOpen(false);
  };

  const goHelp = () => {
    if (!pet) return;
    const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed, pet.id]));
    setOpen(false);
    navigate(`/community?tab=radar&focus=${pet.id}`);
  };

  if (!pet) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm border-2 border-destructive shadow-2xl animate-fade-in-up p-0 overflow-hidden">
        <div
          className="px-4 py-3 text-destructive-foreground flex items-center gap-2"
          style={{ background: "var(--emergency-gradient, hsl(0 84% 55%))" }}
        >
          <AlertTriangle className="w-5 h-5 animate-pulse" />
          <DialogTitle className="text-base font-extrabold text-destructive-foreground">
            🚨 附近有宠物走失！
          </DialogTitle>
        </div>
        <div className="p-4 space-y-3">
          {pet.image_url && (
            <img
              src={pet.image_url}
              alt={pet.pet_name}
              className="w-full aspect-video object-cover rounded-lg"
              loading="lazy"
            />
          )}
          <div>
            <h3 className="font-bold text-foreground text-base">
              {pet.pet_type === "cat" ? "🐱" : "🐶"} {pet.pet_name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{pet.features}</p>
          </div>
          <div className="text-xs text-foreground space-y-1">
            <p className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-destructive" /> {pet.last_seen_location}
            </p>
            <p className="flex items-center gap-1 font-bold text-destructive">
              <Navigation className="w-3 h-3" /> 距离你仅 {pet.distance.toFixed(1)} km
            </p>
          </div>
          {pet.reward_points > 0 && (
            <div className="bg-destructive/10 rounded-lg p-2 text-xs text-destructive font-bold text-center">
              ❤️ 失主悬赏 {pet.reward_points} 爱心积分
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={dismiss}>
              暂不
            </Button>
            <Button variant="hero" className="flex-1" onClick={goHelp}>
              我来帮忙 🙋
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LostPetAlert;
