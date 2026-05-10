// 实时行程地图：起点 / 终点 / 司机当前位置 + 驾车路径。
// 订阅 Supabase Realtime 上的 trip_tracking 行更新即时移动司机 marker。
import { useEffect, useRef, useState } from "react";
import { loadAMap } from "@/lib/amapLoader";

interface Props {
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  /** 司机离线提示文案；非 null 时显示遮罩 */
  offlineHint?: string | null;
  height?: number;
}

const LiveTripMap = ({
  pickupAddress, dropoffAddress,
  pickupLat, pickupLng, dropoffLat, dropoffLng,
  driverLat, driverLng,
  offlineHint = null,
  height = 280,
}: Props) => {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const drivingRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load SDK
  useEffect(() => {
    let cancelled = false;
    loadAMap(["AMap.Driving", "AMap.Marker", "AMap.Polyline", "AMap.Geolocation"])
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => { if (!cancelled) setError(e?.message || "地图加载失败"); });
    return () => { cancelled = true; };
  }, []);

  // init map + draw route once we have endpoints
  useEffect(() => {
    if (!ready || !elRef.current) return;
    const AMap = (window as any).AMap;
    if (!mapRef.current) {
      mapRef.current = new AMap.Map(elRef.current, {
        zoom: 13,
        center: [pickupLng ?? 121.4737, pickupLat ?? 31.2304],
        mapStyle: "amap://styles/light",
      });
    }
    if (!drivingRef.current) {
      drivingRef.current = new AMap.Driving({ map: mapRef.current, hideMarkers: false });
    }
    if (pickupLat != null && pickupLng != null && dropoffLat != null && dropoffLng != null) {
      drivingRef.current.search(
        new AMap.LngLat(pickupLng, pickupLat),
        new AMap.LngLat(dropoffLng, dropoffLat),
        () => {},
      );
    } else if (pickupAddress && dropoffAddress) {
      drivingRef.current.search(
        [
          { keyword: pickupAddress },
          { keyword: dropoffAddress },
        ],
        () => {},
      );
    }
  }, [ready, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress]);

  // update / animate driver marker
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const AMap = (window as any).AMap;
    if (driverLat == null || driverLng == null) return;

    const pos = new AMap.LngLat(driverLng, driverLat);
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new AMap.Marker({
        position: pos,
        offset: new AMap.Pixel(-16, -32),
        content: `<div style="width:32px;height:32px;border-radius:50%;background:hsl(24 95% 53%);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.25);font-size:18px;border:3px solid #fff">🚗</div>`,
        zIndex: 200,
      });
      mapRef.current.add(driverMarkerRef.current);
    } else {
      // 平滑移动
      try {
        driverMarkerRef.current.moveTo(pos, { duration: 1200, autoRotation: false });
      } catch {
        driverMarkerRef.current.setPosition(pos);
      }
    }
    mapRef.current.setCenter(pos);
  }, [ready, driverLat, driverLng]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
      <div ref={elRef} style={{ height }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-background/80">
          {error}
        </div>
      )}
      {!error && offlineHint && (
        <div className="absolute top-2 left-2 right-2 text-xs bg-background/90 text-muted-foreground px-3 py-1.5 rounded-lg border border-border shadow-sm">
          {offlineHint}
        </div>
      )}
    </div>
  );
};

export default LiveTripMap;
