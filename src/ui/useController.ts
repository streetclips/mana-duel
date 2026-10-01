import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameController } from '../app/controller';

export function useControllerVersion(controller: GameController): number {
  const [version, setVersion] = useState(0);
  useEffect(() => controller.subscribe(() => setVersion((value) => value + 1)), [controller]);
  return version;
}

export function useSubscription(source: { subscribe(listener: () => void): () => void } | undefined): number {
  const [version, setVersion] = useState(0);
  useEffect(() => source?.subscribe(() => setVersion((value) => value + 1)), [source]);
  return version;
}

export interface PressHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
}

export function usePress(onTap: () => void, onLongPress: () => void, delay = 450): PressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clear = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      longPressed.current = false;
      clear();
      timer.current = setTimeout(() => {
        longPressed.current = true;
        onLongPress();
      }, delay);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: (event) => {
      clear();
      if (longPressed.current) {
        longPressed.current = false;
        event.preventDefault();
        return;
      }
      onTap();
    },
    onContextMenu: (event) => {
      event.preventDefault();
      if (longPressed.current) return;
      clear();
      longPressed.current = true;
      onLongPress();
    },
  };
}
