"use client";

import { useEffect } from "react";

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutBinding {
  /** Lowercase key (e.g. "enter", "h", "?", "arrowright"). */
  key: string;
  /** Require Cmd (mac) / Ctrl (win/linux). */
  meta?: boolean;
  /** Require Shift. */
  shift?: boolean;
  handler: ShortcutHandler;
  /** When true, fire even if the user is typing in an input/textarea/Monaco. */
  allowInInputs?: boolean;
  /** Disable this binding without unmounting the hook. */
  disabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  // Monaco editor host
  if (target.closest(".monaco-editor")) return true;
  return false;
}

/**
 * Lightweight global keyboard-shortcut hook. Attaches a single keydown listener
 * for the lifetime of the component and dispatches to the first matching binding.
 *
 * Bindings are checked in order; only the first match fires (and the event is
 * preventDefault'd). To avoid surprising the user, bindings are skipped while
 * focus is in an input/textarea/Monaco unless `allowInInputs` is set.
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[]): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const inInput = isTypingTarget(event.target);
      const meta = event.metaKey || event.ctrlKey;
      const k = event.key.toLowerCase();
      for (const b of bindings) {
        if (b.disabled) continue;
        if (b.key.toLowerCase() !== k) continue;
        if (Boolean(b.meta) !== meta) continue;
        if (Boolean(b.shift) !== event.shiftKey) continue;
        if (inInput && !b.allowInInputs) continue;
        event.preventDefault();
        b.handler(event);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings]);
}
