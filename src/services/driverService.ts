import { supabase } from './supabaseService';

export const driverService = {
  listPending: () => supabase.from('drivers').select('*, profiles(name, phone)').eq('approval_status', 'pending'),
  approve: (driverId: string) => supabase.rpc('admin_review_driver_rpc', {
    p_driver_id: driverId,
    p_status: 'approved',
    p_reason: null,
  }),
  reject: (driverId: string, reason = 'Cadastro reprovado pela administração.') => supabase.rpc('admin_review_driver_rpc', {
    p_driver_id: driverId,
    p_status: 'rejected',
    p_reason: reason,
  }),
};
