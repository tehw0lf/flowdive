import { useRef } from 'react';
import { useMotionValue, useSpring, useTransform } from 'framer-motion';

const TILT_MAX = 8;
const SPRING = { stiffness: 300, damping: 30 };

export function useTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [TILT_MAX, -TILT_MAX]), SPRING);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-TILT_MAX, TILT_MAX]), SPRING);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    rawX.set((e.clientX - left) / width - 0.5);
    rawY.set((e.clientY - top) / height - 0.5);
  };

  const onMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return { ref, rotateX, rotateY, onMouseMove, onMouseLeave };
}
