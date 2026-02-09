import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Smart auto-scroll hook: auto-scrolls to bottom when the user is already
 * near the bottom, but stops auto-scrolling when the user scrolls up to
 * read earlier content. Re-engages when the user scrolls back to the bottom
 * (or clicks "scroll to bottom").
 */
export function useSmartScroll<T>(dep: T) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Threshold in pixels: if the user is within this distance of the bottom,
  // we consider them "at the bottom" and keep auto-scrolling.
  const THRESHOLD = 60;

  const checkIfAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  // Listen for user scroll events to detect manual scroll-up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkIfAtBottom, { passive: true });
    return () => el.removeEventListener('scroll', checkIfAtBottom);
  }, [checkIfAtBottom]);

  // Auto-scroll when dependency changes, but only if user is at bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [dep]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  return { scrollRef, showScrollButton, scrollToBottom };
}
