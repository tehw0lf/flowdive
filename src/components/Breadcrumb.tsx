import { ChevronRight, Home } from 'lucide-react';
import type { BreadcrumbItem } from '../types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (index: number) => void;
}

const levelColors: Record<string, string> = {
  orchestrator: 'text-blue-400',
  workflow: 'text-teal-400',
  job: 'text-green-400',
  step: 'text-amber-400',
};

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm font-mono">
      <button
        onClick={() => onNavigate(0)}
        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-400/10"
      >
        <Home size={14} />
        <span className="hidden sm:inline">ROOT</span>
      </button>

      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={12} className="text-gray-600" />
          <button
            onClick={() => onNavigate(i + 1)}
            className={`px-2 py-1 rounded transition-colors hover:bg-white/5 ${
              i === items.length - 1
                ? `${levelColors[item.level]} font-semibold`
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
