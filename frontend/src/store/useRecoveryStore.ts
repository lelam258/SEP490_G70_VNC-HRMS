import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StoredRecovery } from '../types/auth';

type RecoveryState = { challenge: StoredRecovery | null; setChallenge: (challenge: StoredRecovery | null) => void };
export const useRecoveryStore = create<RecoveryState>()(persist((set) => ({
  challenge: null,
  setChallenge: challenge => set({ challenge }),
}), {
  name: 'vnc.hrms.recovery.v2',
  storage: createJSONStorage(() => sessionStorage),
  partialize: state => ({ challenge: state.challenge }),
}));
