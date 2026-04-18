import { useEffect, useRef, useState } from "react";

interface LostPet {
  id: string;
  pet_name: string;
  pet_type: string;
  status: string;
  latitude: number;
  longitude: number;
  image_url?: string | null;
  last_seen_location?: string;
}

interface Props {
  pets: LostPet[];
  userLocation: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
}

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = "f1be18c642140d1114b326946ab357cc";
const AMAP_SECURITY_KEY = "99a72147fee06b466b18e76ded5cc55c";

const PetRadarMap = ({ pets, userLocation, onMarkerClick }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.AMap) { setLoaded(true); return; }
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY };
    const existing = document.querySelector(`script[src*="webapi.amap.com"]`);
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      if (window.AMap) setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init map
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return;
    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : [121.4737, 31.2304];
    mapInstance.current = new window.AMap.Map(mapRef.current, {
      zoom: 12,
      center,
      mapStyle: "amap://styles/light",
    });
  }, [loaded, userLocation]);

  // Render markers when pets / location change
  useEffect(() => {
    if (!loaded || !mapInstance.current) return;
    // clear old markers
    markersRef.current.forEach((m) => mapInstance.current.remove(m));
    markersRef.current = [];

    const bounds: [number, number][] = [];

    // user marker (blue dot)
    if (userLocation) {
      const userMarker = new window.AMap.Marker({
        position: [userLocation.lng, userLocation.lat],
        content: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(210,90%,55%);border:3px solid white;box-shadow:0 0 0 2px hsl(210,90%,55%/0.3),0 2px 8px rgba(0,0,0,0.2);"></div>`,
        offset: new window.AMap.Pixel(-9, -9),
        zIndex: 200,
      });
      mapInstance.current.add(userMarker);
      markersRef.current.push(userMarker);
      bounds.push([userLocation.lng, userLocation.lat]);
    }

    // pet markers (red pulsing for searching)
    pets.forEach((p) => {
      if (!p.latitude || !p.longitude) return;
      const isUrgent = p.status === "searching";
      const color = isUrgent ? "hsl(0,84%,55%)" : "hsl(140,50%,45%)";
      const html = isUrgent
        ? `<div style="position:relative;width:32px;height:32px;">
             <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;animation:pulse-ring 1.6s ease-out infinite;"></div>
             <div style="position:absolute;inset:6px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;">${p.pet_type === "cat" ? "🐱" : "🐶"}</div>
           </div>`
        : `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;">${p.pet_type === "cat" ? "🐱" : "🐶"}</div>`;

      const marker = new window.AMap.Marker({
        position: [p.longitude, p.latitude],
        content: html,
        offset: new window.AMap.Pixel(isUrgent ? -16 : -12, isUrgent ? -16 : -12),
        zIndex: isUrgent ? 150 : 100,
        cursor: "pointer",
      });

      const info = new window.AMap.InfoWindow({
        content: `<div style="padding:6px 10px;min-width:140px;font-family:system-ui;">
          <div style="font-weight:700;font-size:13px;color:#111;margin-bottom:2px;">${p.pet_type === "cat" ? "🐱" : "🐶"} ${p.pet_name}</div>
          <div style="font-size:11px;color:#666;margin-bottom:4px;">${p.last_seen_location || ""}</div>
          <div style="font-size:11px;color:${isUrgent ? "hsl(0,84%,55%)" : "#666"};font-weight:600;">${isUrgent ? "🔥 紧急寻找中" : "✅ 已找回"}</div>
        </div>`,
        offset: new window.AMap.Pixel(0, -24),
      });

      marker.on("mouseover", () => info.open(mapInstance.current, marker.getPosition()));
      marker.on("mouseout", () => info.close());
      marker.on("click", () => onMarkerClick(p.id));

      mapInstance.current.add(marker);
      markersRef.current.push(marker);
      bounds.push([p.longitude, p.latitude]);
    });

    // fit view
    if (bounds.length > 1) {
      mapInstance.current.setFitView(markersRef.current, false, [40, 40, 40, 40]);
    } else if (bounds.length === 1) {
      mapInstance.current.setCenter(bounds[0]);
      mapInstance.current.setZoom(13);
    }
  }, [loaded, pets, userLocation, onMarkerClick]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border mb-3" style={{ height: 220 }}>
      <div ref={mapRef} className="w-full h-full bg-secondary" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary text-xs text-muted-foreground">
          地图加载中...
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] text-foreground flex items-center gap-2 shadow-sm">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />紧急</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-success" />已找回</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(210,90%,55%)" }} />我的位置</span>
      </div>
    </div>
  );
};

export default PetRadarMap;
