import { authService } from '../services/authService';

export const authController = {
  login(email: string, password: string) {
    return authService.signIn(email, password);
  },
  logout() {
    return authService.signOut();
  },
};
