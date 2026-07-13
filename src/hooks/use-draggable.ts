import { useEffect, useRef, type RefObject } from "react";
import type { PanelPosition } from "@/stores/instantTradeStore";

interface UseDraggableParams {
  /** The element being moved (position: fixed). */
  elementRef: RefObject<HTMLElement | null>;
  /** The grab handle; pointer-down here starts a drag. */
  handleRef: RefObject<HTMLElement | null>;
  /** Committed position, used as the starting point for each drag. */
  position: PanelPosition;
  /** Called once, on pointer-up, with the final position. */
  onCommit: (position: PanelPosition) => void;
  enabled?: boolean;
}

/**
 * Pointer-driven dragging that keeps the panel fixed-positioned via inline
 * `left`/`top` on the element. For 60fps without React churn we mutate the DOM
 * node directly on every `pointermove` (rAF-batched) and only push the final
 * value into the store on `pointerup` — so a drag causes exactly one re-render.
 */
export function useDraggable({
  elementRef,
  handleRef,
  position,
  onCommit,
  enabled = true,
}: UseDraggableParams) {
  // Keep the latest committed position without re-subscribing the listeners.
  const positionRef = useRef(position);
  positionRef.current = position;

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    const handle = handleRef.current;
    const el = elementRef.current;
    if (!enabled || !handle || !el) return;

    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let latest = positionRef.current;
    let rafId = 0;
    let dragging = false;

    const clamp = (x: number, y: number): PanelPosition => {
      const maxX = window.innerWidth - el.offsetWidth;
      const maxY = window.innerHeight - el.offsetHeight;
      return {
        x: Math.min(Math.max(0, x), Math.max(0, maxX)),
        y: Math.min(Math.max(0, y), Math.max(0, maxY)),
      };
    };

    const paint = () => {
      rafId = 0;
      el.style.left = `${latest.x}px`;
      el.style.top = `${latest.y}px`;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      latest = clamp(originX + (e.clientX - startX), originY + (e.clientY - startY));
      if (!rafId) rafId = requestAnimationFrame(paint);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafId) cancelAnimationFrame(rafId);
      onCommitRef.current(latest);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Ignore drags that start on interactive controls inside the handle.
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originX = positionRef.current.x;
      originY = positionRef.current.y;
      latest = positionRef.current;
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
