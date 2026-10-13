import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string | null;
  variant?: "destructive" | "warning" | "default" | "info";
  icon?: "trash" | "alert" | "logout" | "unlink" | "help" | "info" | "success";
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolver: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: {
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "destructive" | "warning" | "default" | "info";
    icon?: "trash" | "alert" | "logout" | "unlink" | "help" | "info" | "success";
  }) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: {
    title: "Konfirmasi Tindakan",
    description: "Apakah Anda yakin ingin melanjutkan?",
    confirmText: "Ya, Lanjutkan",
    cancelText: "Batal",
    variant: "destructive",
    icon: "alert",
  },
  resolver: null,

  confirm: (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: {
          confirmText: options.confirmText || "Ya, Lanjutkan",
          cancelText: options.cancelText === null ? null : (options.cancelText || "Batal"),
          variant: options.variant || "destructive",
          icon: options.icon || (options.variant === "warning" ? "alert" : "trash"),
          ...options,
        },
        resolver: resolve,
      });
    });
  },

  alert: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: {
          title: options.title,
          description: options.description,
          confirmText: options.confirmText || "Tutup",
          cancelText: null,
          variant: options.variant || "default",
          icon: options.icon || "info",
        },
        resolver: resolve,
      });
    });
  },

  handleConfirm: () => {
    const { resolver } = get();
    if (resolver) resolver(true);
    set({ isOpen: false, resolver: null });
  },

  handleCancel: () => {
    const { resolver } = get();
    if (resolver) resolver(false);
    set({ isOpen: false, resolver: null });
  },
}));

export function useConfirm() {
  return useConfirmStore((state) => state.confirm);
}

export function useAlert() {
  return useConfirmStore((state) => state.alert);
}
