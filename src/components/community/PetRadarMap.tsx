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
  /** Search radius in km — also drives the visible circle on the map */
  radiusKm?: number;
}

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = "f1be18c642140d1114b326946ab357cc";
const AMAP_SECURITY_KEY = "99a72147fee06b466b18e76ded5cc55c";

const PetRadarMap = ({ pets, userLocation, onMarkerClick, radiusKm = 10 }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  // Load AMap JS SDK + MarkerClusterer plugin
  useEffect(() => {
    if (window.AMap && window.AMap.MarkerClusterer) { setLoaded(true); return; }
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY };

    const finish = () => {
      if (!window.AMap) return;
      window.AMap.plugin(["AMap.MarkerClusterer"], () => setLoaded(true));
    };

    const existing = document.querySelector(`script[src*="webapi.amap.com"]`);
    if (existing) {
      existing.addEventListener("load", finish);
      if (window.AMap) finish();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.MarkerClusterer`;
    script.onload = finish;
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

  // User marker + radius circle
  useEffect(() => {
    if (!loaded || !mapInstance.current || !userLocation) return;

    if (userMarkerRef.current) { mapInstance.current.remove(userMarkerRef.current); userMarkerRef.current = null; }
    if (circleRef.current) { mapInstance.current.remove(circleRef.current); circleRef.current = null; }

    userMarkerRef.current = new window.AMap.Marker({
      position: [userLocation.lng, userLocation.lat],
      content: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(210,90%,55%);border:3px solid white;box-shadow:0 0 0 2px hsl(210 90% 55% / 0.3),0 2px 8px rgba(0,0,0,0.2);"></div>`,
      offset: new window.AMap.Pixel(-9, -9),
      zIndex: 200,
    });
    mapInstance.current.add(userMarkerRef.current);

    circleRef.current = new window.AMap.Circle({
      center: [userLocation.lng, userLocation.lat],
      radius: radiusKm * 1000,
      strokeColor: "hsl(210 90% 55%)",
      strokeWeight: 1.5,
      strokeOpacity: 0.7,
      strokeStyle: "dashed",
      fillColor: "hsl(210 90% 55%)",
      fillOpacity: 0.08,
      zIndex: 50,
    });
    mapInstance.current.add(circleRef.current);
    // Fit the circle on radius change
    mapInstance.current.setFitView([circleRef.current], false, [40, 40, 40, 40]);
  }, [loaded, userLocation, radiusKm]);

  // Render pet markers via MarkerClusterer
  useEffect(() => {
    if (!loaded || !mapInstance.current) return;

    if (clusterRef.current) { clusterRef.current.setMap(null); clusterRef.current = null; }

    const markers: any[] = pets
      .filter((p) => p.latitude && p.longitude)
      .map((p) => {
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
        return marker;
      });

    if (markers.length === 0) return;

    // Custom cluster style
    const renderClusterMarker = (context: any) => {
      const count = context.count;
      const size = Math.min(56, 28 + Math.log2(count + 1) * 8);
      const div = document.createElement("div");
      div.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 30% 30%, hsl(0 84% 65%), hsl(0 84% 50%));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid white;box-shadow:0 4px 12px hsl(0 84% 50% / 0.45);`;
      div.innerText = String(count);
      context.marker.setOffset(new window.AMap.Pixel(-size / 2, -size / 2));
      context.marker.setContent(div);
    };

    clusterRef.current = new window.AMap.MarkerClusterer(mapInstance.current, markers, {
      gridSize: 60,
      maxZoom: 15,
      renderClusterMarker,
    });
  }, [loaded, pets, onMarkerClick]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border mb-3" style={{ height: 240 }}>
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
        <span className="text-muted-foreground">· 半径 {radiusKm}km</span>
      </div>
    </div>
  );
};

export default PetRadarMap;
