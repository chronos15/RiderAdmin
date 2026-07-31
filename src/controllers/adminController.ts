import { adminService } from '../services/adminService';

export const adminController = {
  loadDashboard: () => adminService.dashboard(),
};
