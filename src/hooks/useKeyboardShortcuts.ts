import { useEffect, useCallback } from "react";

// ============================================================
// TYPES
// ============================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

// ============================================================
// KEYBOARD SHORTCUTS HOOK
// ============================================================

/**
 * Hook to handle keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (preventDefault) {
            event.preventDefault();
          }
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled, preventDefault]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

// ============================================================
// GAME-SPECIFIC SHORTCUTS
// ============================================================

/**
 * Common game keyboard shortcuts
 */
export function useGameShortcuts(handlers: {
  onPause?: () => void;
  onResume?: () => void;
  onSpeedUp?: () => void;
  onSlowDown?: () => void;
  onToggleLog?: () => void;
  onHelp?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: " ",
      description: "Pause/Resume game",
      action: () => {
        handlers.onPause?.() ?? handlers.onResume?.();
      },
      enabled: !!handlers.onPause || !!handlers.onResume,
    },
    {
      key: "+",
      description: "Speed up game",
      action: () => handlers.onSpeedUp?.(),
      enabled: !!handlers.onSpeedUp,
    },
    {
      key: "-",
      description: "Slow down game",
      action: () => handlers.onSlowDown?.(),
      enabled: !!handlers.onSlowDown,
    },
    {
      key: "l",
      description: "Toggle game log",
      action: () => handlers.onToggleLog?.(),
      enabled: !!handlers.onToggleLog,
    },
    {
      key: "?",
      shift: true,
      description: "Show keyboard shortcuts",
      action: () => handlers.onHelp?.(),
      enabled: !!handlers.onHelp,
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts.filter((s) => s.enabled !== false);
}

// ============================================================
// NAVIGATION SHORTCUTS
// ============================================================

/**
 * Navigation keyboard shortcuts
 */
export function useNavigationShortcuts(handlers: {
  onHome?: () => void;
  onPlay?: () => void;
  onAnalytics?: () => void;
  onGames?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "h",
      alt: true,
      description: "Go to Home",
      action: () => handlers.onHome?.(),
      enabled: !!handlers.onHome,
    },
    {
      key: "p",
      alt: true,
      description: "Go to Play",
      action: () => handlers.onPlay?.(),
      enabled: !!handlers.onPlay,
    },
    {
      key: "a",
      alt: true,
      description: "Go to Analytics",
      action: () => handlers.onAnalytics?.(),
      enabled: !!handlers.onAnalytics,
    },
    {
      key: "g",
      alt: true,
      description: "Go to Games",
      action: () => handlers.onGames?.(),
      enabled: !!handlers.onGames,
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts.filter((s) => s.enabled !== false);
}

// ============================================================
// KEYBOARD HINTS COMPONENT
// ============================================================

/**
 * Format a shortcut key for display
 */
export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.meta) parts.push("⌘");

  // Format special keys
  let key = shortcut.key;
  if (key === " ") key = "Space";
  if (key === "ArrowUp") key = "↑";
  if (key === "ArrowDown") key = "↓";
  if (key === "ArrowLeft") key = "←";
  if (key === "ArrowRight") key = "→";
  if (key === "Enter") key = "↵";
  if (key === "Escape") key = "Esc";

  parts.push(key.toUpperCase());

  return parts.join(" + ");
}
