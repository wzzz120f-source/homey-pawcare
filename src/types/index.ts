/** 热门服务项 */
export interface Service {
  id: string;
  image: string;
  title: string;
  price: string;
  rating: number;
}

/** 技师信息 */
export interface Technician {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  rating: number;
  reviews: number;
  distance: string;
}

/** 宠物类型选项 */
export interface PetType {
  id: string;
  emoji: string;
  label: string;
}

/** 服务类型选项 */
export interface ServiceType {
  id: string;
  label: string;
  price: string;
  icon: string;
}

/** 时间段 */
export type TimeSlot = string;

/** 附近门店 */
export interface NearbyStore {
  id: string;
  name: string;
  address: string;
  distance: string;
  rating: number;
}

/** 底部导航项 */
export interface NavTab {
  path: string;
  icon: React.ComponentType<Record<string, unknown>>;
  label: string;
}
