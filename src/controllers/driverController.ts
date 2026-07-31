import { driverService } from '../services/driverService';

export const driverController = {
  listPending: () => driverService.listPending(),
  approve: (id: string) => driverService.approve(id),
  reject: (id: string) => driverService.reject(id),
};
