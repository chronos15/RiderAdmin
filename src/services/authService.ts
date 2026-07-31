import { supabase } from './supabaseService';

export const authService = {
  signIn: (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) => supabase.auth.onAuthStateChange(callback),
  async getAdminProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('profiles').select('id, name, phone, avatar_url, role, status').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  },
};
