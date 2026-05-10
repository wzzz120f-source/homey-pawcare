// 高德地图 SDK 加载器：从 edge function `amap-config` 拿 Key（仅登录用户可获取），
// 不再在前端源码硬编码。多次调用会复用同一份加载 Promise。
import AMapLoader from "@amap/amap-jsapi-loader";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

let loadPromise: Promise<any> | null = null;

export async function loadAMap(plugins: string[] = [
  "AMap.Geolocation",
  "AMap.Geocoder",
  "AMap.AutoComplete",
  "AMap.Driving",
  "AMap.PlaceSearch",
  "AMap.Marker",
  "AMap.Polyline",
]): Promise<any> {
  if (typeof window === "undefined") throw new Error("AMap requires browser");
  if (window.AMap?.Map) return window.AMap;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("amap-config");
    if (error || !data?.key) {
      loadPromise = null;
      throw new Error(error?.message || "无法获取地图配置，请先登录");
    }
    if (data.securityJsCode) {
      window._AMapSecurityConfig = { securityJsCode: data.securityJsCode };
    }
    const AMap = await AMapLoader.load({
      key: data.key,
      version: "2.0",
      plugins,
    });
    window.AMap = AMap;
    return AMap;
  })();

  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    throw e;
  }
}
