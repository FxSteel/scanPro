export type UserRole = 'admin' | 'driver';

export type PackageStatus = 'retirado' | 'en_bodega' | 'en_ruta' | 'entregado' | 'reprogramado';

export type RouteStatus = 'pending' | 'in_progress' | 'completed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
}

export interface Package {
  id: string;
  internal_id: string; // DE-XXXXXX
  qr_data: string;
  recipient_name: string;
  address: string;
  comuna: string;
  store_origin: string;
  status: PackageStatus;
  route_id?: string;
  driver_id?: string;
  scanned_by: string;
  scanned_at: string;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  driver_id: string;
  date: string;
  status: RouteStatus;
  zona?: string;
  created_at: string;
  packages?: Package[];
  driver?: User;
}

export interface DeliveryConfirmation {
  id: string;
  package_id: string;
  photo_url: string;
  receiver_name: string;
  receiver_rut?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  delivered_at: string;
  delivered_by: string;
}
