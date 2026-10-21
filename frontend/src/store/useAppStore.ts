import { create } from 'zustand';

type AppState = { sidebarOpen: boolean; toggleSidebar: () => void; notice: string; setNotice: (notice: string) => void };
export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  notice: '',
  setNotice: (notice) => set({ notice }),
}));
