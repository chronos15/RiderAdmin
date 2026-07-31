export type ProfileRole = 'client' | 'driver' | 'admin';
export type ProfileStatus = 'active' | 'blocked' | 'pending';

export interface ProfileModel {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: ProfileRole;
  status: ProfileStatus;
}
