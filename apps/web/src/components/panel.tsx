import { cn } from "cn";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  clampPanelWidth,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  type PanelSide,
  usePreferences,
} from "@/stores/preferences";

type Props = { side: PanelSide; children: ReactNode; label: string; wide?: boolean };

const KEY_STEP = 16;

export function Panel({ side, children, label, wide }: Props) {
  const storedWidth = usePreferences((state) => state.panelWidths?.[side]);
  const setPanelWidth = usePreferences((state) => state.setPanelWidth);
  const [dragWidth, setDragWidth] = useState<number>();
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number; latest: number } | undefined>(
    undefined,
  );
  const width = dragWidth ?? storedWidth ?? (wide ? 448 : 320);

  // why: the header sits outside the panel and reads the same variable, so both resize in the same frame
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty(`--panel-${side}-width`, `${width}px`);
    return () => {
      root.removeProperty(`--panel-${side}-width`);
    };
  }, [side, width]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, latest: width };
    setDragWidth(width);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = side === "left" ? event.clientX - drag.startX : drag.startX - event.clientX;
    const next = clampPanelWidth(drag.startWidth + delta, window.innerWidth);
    drag.latest = next;
    setDragWidth(next);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setDragWidth(undefined);
    setPanelWidth(side, drag.latest);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const grow = (side === "left" && event.key === "ArrowRight") || (side === "right" && event.key === "ArrowLeft");
    setPanelWidth(side, clampPanelWidth(width + (grow ? KEY_STEP : -KEY_STEP), window.innerWidth));
  };

  return (
    <section
      aria-label={label}
      className={cn(
        "surface animate-in fade-in animation-duration-200 absolute bottom-0 flex max-w-full flex-col overflow-hidden max-sm:inset-x-0 max-sm:top-auto max-sm:max-h-[45dvh] max-sm:w-auto max-sm:border-x-0 max-sm:border-b-0",
        side === "left"
          ? "left-0 border-b-0 border-l-0 slide-in-from-left-2 sm:top-[calc(2.5rem-1px)] sm:w-(--panel-left-width) sm:pointer-coarse:top-[calc(2.75rem-1px)]"
          : "right-0 border-b-0 border-r-0 slide-in-from-right-2 sm:top-0 sm:border-t-0 sm:w-(--panel-right-width)",
      )}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} panel`}
        aria-valuemin={MIN_PANEL_WIDTH}
        aria-valuemax={MAX_PANEL_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={onKeyDown}
        className={cn(
          "group/resize absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none focus-visible:outline-none max-sm:hidden",
          "after:absolute after:inset-y-0 after:w-px after:bg-transparent after:transition-[width,background-color] after:duration-150 hover:after:w-0.5 hover:after:bg-ring focus-visible:after:w-0.5 focus-visible:after:bg-ring",
          dragWidth !== undefined && "after:w-0.5 after:bg-ring",
          side === "left" ? "right-0 after:right-0" : "left-0 after:left-0",
        )}
      />
    </section>
  );
}
