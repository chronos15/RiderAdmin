export interface RideModel {
  id: string;
  client_id: string;
  driver_id: string;
  status: string;
  final_price: number | null;
  created_at: string;
}
