import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Session } from '../types/auth';

type AuthState = {
  session: Session | null;
  setSession: (session: Session | null) => void;
  setUserName: (name: string) => void;
};

export const useAuthStore = create<AuthState>()(persist((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  setUserName: (name) => set((state) => (state.session ? {
    session: { ...state.session, user: { ...state.session.user, name } }
  } : state)),
}), {
  name: 'vnc.hrms.auth.v2',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ session: state.session }),
}));
