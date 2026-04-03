import { motion, AnimatePresence } from 'framer-motion';
import type { DrillState } from '../types';

interface RippleOverlayProps {
  visible: boolean;
  origin: { x: number; y: number };
}

const levelColors = {
  orchestrator: '#3b82f6',
  workflow: '#14b8a6',
  job: '#22c55e',
  step: '#f59e0b',
};

export function RippleOverlay({ visible, origin }: RippleOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ripple"
          className="fixed inset-0 pointer-events-none z-50"
          style={{ overflow: 'hidden' }}
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2"
              style={{
                left: origin.x,
                top: origin.y,
                borderColor: '#3b82f6',
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ width: '300vmax', height: '300vmax', opacity: 0 }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: '#020408' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0] }}
            transition={{ duration: 0.6, times: [0, 0.5, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CardPoolWrapperProps {
  children: React.ReactNode;
  drillKey: string;
  level: DrillState['level'];
}

export function CardPoolWrapper({ children, drillKey, level }: CardPoolWrapperProps) {
  const color = levelColors[level];

  return (
    <motion.div
      key={drillKey}
      className="w-full"
      initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.97 }}
      animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.02 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ '--level-color': color } as React.CSSProperties}
    >
      {children}
    </motion.div>
  );
}
