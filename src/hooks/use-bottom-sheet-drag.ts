"use client";

import { useState, useRef, useCallback } from "react";

export interface UseBottomSheetDragOptions {
  onClose: () => void;
  disabled?: boolean;
  threshold?: number; // Jarak drag minimal (pixel) untuk menutup (default: 80)
  velocityThreshold?: number; // Kecepatan flick minimal (px/ms) untuk menutup (default: 0.35)
}

/**
 * Hook untuk gesture slide-down / swipe-to-close pada bottom sheet mobile modal.
 * Mendukung touch gesture natural dengan tracking 1:1, rubber-band resistance ke atas,
 * micro-haptic feedback visual, dan snap-back/close physics.
 */
export function useBottomSheetDrag({
  onClose,
  disabled = false,
  threshold = 80,
  velocityThreshold = 0.35,
}: UseBottomSheetDragOptions) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isClosingRef = useRef(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const startDrag = useCallback(
    (clientY: number, isTouchEvent: boolean) => {
      if (disabledRef.current || isClosingRef.current) return;

      // Pada viewport desktop (>640px) dengan mouse, nonaktifkan drag agar interaksi desktop tetap standar
      if (!isTouchEvent && typeof window !== "undefined" && window.innerWidth >= 640) {
        return;
      }

      startYRef.current = clientY;
      currentYRef.current = clientY;
      startTimeRef.current = Date.now();
      isDraggingRef.current = true;
      setIsDragging(true);

      const handleMove = (e: TouchEvent | MouseEvent) => {
        if (!isDraggingRef.current) return;
        const curY = "touches" in e ? e.touches[0].clientY : e.clientY;
        currentYRef.current = curY;
        const delta = curY - startYRef.current;

        if (delta > 0) {
          // Bergerak ke bawah: ikuti jari secara 1:1
          setDragY(delta);
        } else {
          // Bergerak ke atas: berikan efek hambatan pegas karet (rubber-band resistance)
          const resisted = -Math.pow(Math.abs(delta), 0.7);
          setDragY(Math.max(resisted, -25));
        }
      };

      const handleEnd = () => {
        window.removeEventListener("touchmove", handleMove);
        window.removeEventListener("touchend", handleEnd);
        window.removeEventListener("touchcancel", handleEnd);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleEnd);

        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        const deltaY = currentYRef.current - startYRef.current;
        const deltaTime = Date.now() - startTimeRef.current;
        const velocity = deltaTime > 0 ? deltaY / deltaTime : 0;

        // Cek apakah ditarik melebihi ambang batas jarak ATAU flick cepat ke bawah
        if (deltaY > threshold || (deltaY > 30 && velocity > velocityThreshold)) {
          isClosingRef.current = true;
          setIsClosing(true);
          const screenHeight = typeof window !== "undefined" ? window.innerHeight : 800;
          setDragY(screenHeight);

          setTimeout(() => {
            onCloseRef.current();
            isClosingRef.current = false;
            setIsClosing(false);
            setDragY(0);
          }, 220);
        } else {
          // Snap back kembali ke posisi semula (0px)
          setDragY(0);
        }
      };

      window.addEventListener("touchmove", handleMove, { passive: true });
      window.addEventListener("touchend", handleEnd, { passive: true });
      window.addEventListener("touchcancel", handleEnd, { passive: true });
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
    },
    [threshold, velocityThreshold]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        startDrag(e.touches[0].clientY, true);
      }
    },
    [startDrag]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Hanya tombol mouse utama (kiri) yang memicu drag
      if (e.button === 0) {
        startDrag(e.clientY, false);
      }
    },
    [startDrag]
  );

  // Props yang dipasang pada drag handle atau header modal
  const dragHandleProps = {
    onTouchStart,
    onMouseDown,
    style: { touchAction: "none" as const },
  };

  // Inline style untuk form modal sheet
  const modalStyle: React.CSSProperties = {
    transform:
      isClosing || isDragging || dragY > 0
        ? `translateY(${dragY}px)`
        : undefined,
    transition: isDragging
      ? "none"
      : "transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1)",
  };

  // Inline style opacity untuk backdrop overlay
  const backdropStyle: React.CSSProperties = {
    opacity: isClosing
      ? 0
      : isDragging && dragY > 0
      ? Math.max(0.1, 1 - dragY / 280)
      : undefined,
    transition: isDragging ? "none" : "opacity 0.22s ease-out",
  };

  return {
    dragY,
    isDragging,
    isClosing,
    dragHandleProps,
    modalStyle,
    backdropStyle,
  };
}
