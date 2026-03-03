import { useQuery } from "@tanstack/react-query";
import type { Service, Technician } from "@/types";
import { SERVICES, TECHNICIANS } from "@/config/services";

/**
 * 模拟 API 延迟，后续可替换为真实 fetch 调用
 */
function simulateApi<T>(data: T, delayMs = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delayMs));
}

/** 获取热门服务列表 */
export function useServices() {
  return useQuery<readonly Service[]>({
    queryKey: ["services"],
    queryFn: () => simulateApi([...SERVICES]),
    staleTime: 5 * 60 * 1000,
  });
}

/** 获取附近技师列表 */
export function useTechnicians() {
  return useQuery<readonly Technician[]>({
    queryKey: ["technicians"],
    queryFn: () => simulateApi([...TECHNICIANS]),
    staleTime: 5 * 60 * 1000,
  });
}
