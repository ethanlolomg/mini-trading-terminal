import { useEffect, useRef, type RefObject } from "react";
import {
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  type PanelSize,
} from "@/stores/instantTradeStore";

interface UseResizableParams {
  /** The element being resized. */
  elementRef: RefObject<HTMLElement | null>;
  /** The bottom-right resize grip. */
  handleRef: RefObject<HTMLElement | null>;
  /** Committed size, used as the starting point for each resize. */
  size: PanelSize;
  /** Called once, on pointer-up, with the final size. */
  onCommit: (size: PanelSize) => void;
  enabled?: boolean;
}

/**
 * Pointer-driven resizing from a bottom-right grip. Same performance contract as
 * {@link useDraggable}: width/height are written straight to the DOM node during
 * the gesture (rAF-batched) and only committed to the store on release.
 */
export function useResizable({
  elementRef,
  handleRef,
  size,
  onCommit,
  enabled = true,
}: UseResizableParams) {
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    const handle = handleRef.current;
    const el = elementRef.current;
    if (!enabled || !handle || !el) return;

    let startX = 0;
    let startY = 0;
    let originW = 0;
    let originH = 0;
    let latest = sizeRef.current;
    let rafId = 0;
    let resizing = false;

    const clamp = (w: number, h: number): PanelSize => {
      const maxW = window.innerWidth - el.offsetLeft;
      const maxH = window.innerHeight - el.offsetTop;
      return {
        width: Math.min(Math.max(PANEL_MIN_WIDTH, w), maxW),
        height: Math.min(Math.max(PANEL_MIN_HEIGHT, h), maxH),
      };
    };

    const paint = () => {
      rafId = 0;
      el.style.width = `${latest.width}px`;
      el.style.height = `${latest.height}px`;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!resizing) return;
      latest = clamp(originW + (e.clientX - startX), originH + (e.clientY - startY));
      if (!rafId) rafId = requestAnimationFrame(paint);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!resizing) return;
      resizing = false;
      handle.releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafId) cancelAnimationFrame(rafId);
      onCommitRef.current(latest);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      originW = el.offsetWidth;
      originH = el.offsetHeight;
      latest = { width: originW, height: originH };
      handle.setPointerCapture?.(e.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    return () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [elementRef, handleRef, enabled]);
}
