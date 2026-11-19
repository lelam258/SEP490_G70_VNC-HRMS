import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Session } from '../types/auth';

function normalizeSession(session: Session | null): Session | null {
  if (!session) return null;
  if (session.user.role.trim().toLowerCase() !== 'medical_staff') return session;
  return { ...session, user: { ...session.user, role: 'employee' } };
}

type AuthState = {
  session: Session | null;
  setSession: (session: Session | null) => void;
  setUserName: (name: string) => void;
};

export const useAuthStore = create<AuthState>()(persist((set) => ({
  session: null,
  setSession: (session) => set({ session: normalizeSession(session) }),
  setUserName: (name) => set((state) => (state.session ? {
    session: { ...state.session, user: { ...state.session.user, name } }
  } : state)),
}), {
  name: 'vnc.hrms.auth.v3',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ session: state.session }),
  merge: (persisted, current) => {
    const incoming = persisted as Partial<AuthState> | undefined;
    return {
      ...current,
      session: normalizeSession(incoming?.session ?? null),
    };
  },
}));
