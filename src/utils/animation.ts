import type { TransitionConfig } from "svelte/transition";
import { cubicOut } from "svelte/easing";

interface FlyAndBlurParams {
  delay?: number;
  duration?: number;
  y?: number;
  blur?: number;
}

export function flyAndBlur(
  node: Element,
  { delay = 0, duration = 420, y = 0, blur = 3 }: FlyAndBlurParams = {},
): TransitionConfig {
  const hasWindow = typeof window !== "undefined";
  const prefersReducedMotion =
    hasWindow &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const initialOpacity =
    hasWindow && typeof getComputedStyle === "function"
      ? Number(getComputedStyle(node).opacity) || 1
      : 1;

  const resolvedDuration = prefersReducedMotion
    ? Math.min(duration, 200)
    : duration;
  const resolvedY = prefersReducedMotion ? 0 : y;
  const resolvedBlur = prefersReducedMotion ? 0 : blur;

  return {
    delay,
    duration: resolvedDuration,
    easing: cubicOut,
    css: (t, u) =>
      `transform: translateY(${resolvedY * u}px); opacity: ${initialOpacity * t}; filter: blur(${resolvedBlur * u}px);`,
  };
}
