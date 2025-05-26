
import { create } from "zustand";

type UpgradeModalStore = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

export const useUpgradeModal = create<UpgradeModalStore>((set) => ({
  isOpen: false,
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));
