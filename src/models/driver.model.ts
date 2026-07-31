export type DriverApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DriverModel {
  id: string;
  user_id: string;
  approval_status: DriverApprovalStatus;
  is_online: boolean;
  rating: number;
  total_trips: number;
}
