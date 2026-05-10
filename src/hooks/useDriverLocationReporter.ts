// 司机端实时定位上报 Hook：在订单进行中时通过浏览器 Geolocation 上报真实 GPS。
// - 阈值过滤：移动 < 30 米的更新跳过写库
// - 节流：最少 10 秒一次
// - 失败静默：不打断驾驶
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Options {
  /** 是否启用上报。比如订单状态非进行中时设 false */
  enabled: boolean;
  /** 订单 ID */
  orderId: string | null | undefined;
  /** 当前阶段（可选） */
  stage?: string | null;
  /** 最小移动距离（米），默认 30 */
  minMoveMeters?: number;
  /** 最小间隔（毫秒），默认 10000 */
  minIntervalMs?: number;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function useDriverLocationReporter({
  enabled,
  orderId,
  stage,
  minMoveMeters = 30,
  minIntervalMs = 10000,
}: Options) {
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = async (lat: number, lng: number, speed: number | null, heading: number | null) => {
      try {
        await supabase.functions.invoke("report-location", {
          body: {
            order_id: orderId,
            lat,
            lng,
            speed,
            heading,
            stage: stage ?? null,
          },
        });
      } catch (e) {
        console.warn("[reporter] failed", e);
      }
    };

    const onPos = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, speed, heading } = pos.coords;
      const now = Date.now();
      const last = lastSentRef.current;
      if (last) {
        if (now - last.ts < minIntervalMs) return;
        if (haversine(last.lat, last.lng, lat, lng) < minMoveMeters) return;
      }
      lastSentRef.current = { lat, lng, ts: now };
      void send(lat, lng, typeof speed === "number" ? speed : null, typeof heading === "number" ? heading : null);
    };

    const onErr = (err: GeolocationPositionError) => {
      console.warn("[reporter] geo error", err.code, err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, orderId, stage, minMoveMeters, minIntervalMs]);
}
