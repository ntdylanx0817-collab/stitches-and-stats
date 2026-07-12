"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Animated stat counter that counts up from 0 to the target value
 * with a spring animation — like a scoreboard flipping.
 */
export function AnimatedCounter({
  value,
  duration = 0.8,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0.3 });
  const display = useTransform(spring, (latest) => {
    return `${prefix}${latest.toFixed(decimals)}${suffix}`;
  });
  const [text, setText] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      setText(v);
    });
    return () => unsubscribe();
  }, [display]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {text}
    </motion.span>
  );
}

/**
 * Hook version for inline use — returns the animated string.
 */
export function useAnimatedValue(value: number, decimals: number = 0, duration: number = 0.8): string {
  const [display, setDisplay] = useState("0");
  const ref = useRef({ current: 0, target: value, startTime: 0, raf: 0 });

  useEffect(() => {
    const start = performance.now();
    const startVal = ref.current.current;
    const endVal = value;
    ref.current.startTime = start;

    const animate = (now: number) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      ref.current.current = current;
      setDisplay(current.toFixed(decimals));
      if (progress < 1) {
        ref.current.raf = requestAnimationFrame(animate);
      }
    };

    ref.current.raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current.raf);
  }, [value, decimals, duration]);

  return display;
}
