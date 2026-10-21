import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Session } from '../types/auth';

type AuthState = {
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthState>()(persist((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}), {
  name: 'vnc.hrms.auth.v2',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ session: state.session }),
}));
