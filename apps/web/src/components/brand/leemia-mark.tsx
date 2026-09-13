'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface LeemiaMarkProps {
  className?: string;
  size?: number;
  title?: string;
}

export function LeemiaMark({ className, size = 128, title }: LeemiaMarkProps) {
  const rawId = useId().replace(/:/g, '');
  const clipId = `leemia-clip-${rawId}`;
  const labelled = Boolean(title);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      fill="none"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <g className="leemia-mark" transform="translate(4 14)">
        <rect className="leemia-fill" x="4" y="4" width="112" height="92" rx="4" fill="#05070A" />
        <clipPath id={clipId}>
          <rect x="4" y="4" width="112" height="92" rx="4" />
        </clipPath>
        <g
          className="leemia-waves"
          clipPath={`url(#${clipId})`}
          stroke="#34C3DD"
          strokeWidth="7"
          strokeLinecap="round"
        >
          <path className="leemia-wave" d="M 4 38 C 22 25, 41 29, 58 44 C 75 59, 98 55, 116 38" />
          <path className="leemia-wave" d="M 4 66 C 23 53, 44 57, 62 71 C 78 83, 99 81, 116 64" />
          <path className="leemia-wave" d="M 40 4 C 52 22, 54 40, 44 56 C 34 72, 34 84, 42 96" />
          <path className="leemia-wave" d="M 78 4 C 90 22, 88 40, 76 55 C 64 70, 67 84, 76 96" />
        </g>
        <rect
          className="leemia-frame"
          x="4"
          y="4"
          width="112"
          height="92"
          rx="4"
          stroke="#34C3DD"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
