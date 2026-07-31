export interface VehicleModel {
  id: string;
  driver_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  plate: string | null;
  category: string | null;
  status: string;
}
