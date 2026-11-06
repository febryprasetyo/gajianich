'use client';

import React, { useId } from 'react';

export type SparklineTone = 'emerald' | 'blue' | 'purple' | 'teal' | 'rose' | 'amber';

interface ServerSparklineProps {
  data: number[];
  tone?: SparklineTone;
  height?: number;
  min?: number;
  max?: number;
  className?: string;
}

const TONE_PALETTE: Record<SparklineTone, { stroke: string; fillStart: string; fillEnd: string }> = {
  emerald: {
    stroke: '#059669',
    fillStart: 'rgba(5, 150, 105, 0.20)',
    fillEnd: 'rgba(5, 150, 105, 0.01)',
  },
  blue: {
    stroke: '#2563eb',
    fillStart: 'rgba(37, 99, 235, 0.18)',
    fillEnd: 'rgba(37, 99, 235, 0.01)',
  },
  purple: {
    stroke: '#9333ea',
    fillStart: 'rgba(147, 51, 234, 0.18)',
    fillEnd: 'rgba(147, 51, 234, 0.01)',
  },
  teal: {
    stroke: '#0d9488',
    fillStart: 'rgba(13, 148, 136, 0.18)',
    fillEnd: 'rgba(13, 148, 136, 0.01)',
  },
  rose: {
    stroke: '#e11d48',
    fillStart: 'rgba(225, 29, 72, 0.22)',
    fillEnd: 'rgba(225, 29, 72, 0.01)',
  },
  amber: {
    stroke: '#d97706',
    fillStart: 'rgba(217, 119, 6, 0.20)',
    fillEnd: 'rgba(217, 119, 6, 0.01)',
  },
};

export default function ServerSparkline({
  data,
  tone = 'emerald',
  height = 36,
  min,
  max,
  className = '',
}: ServerSparklineProps) {
  const gradientId = useId();
  const points = Array.isArray(data) && data.length >= 2 ? data : [18, 22, 20, 24, 23, 25, 24];

  const width = 240;
  const padY = 3;
  const usableHeight = height - padY * 2;

  const computedMin = min !== undefined ? min : Math.max(0, Math.min(...points) * 0.75);
  const computedMax = max !== undefined ? max : Math.max(computedMin + 10, Math.max(...points) * 1.18);
  const range = Math.max(1, computedMax - computedMin);

  const coords = points.map((val, idx) => {
    const x = (idx / Math.max(1, points.length - 1)) * width;
    const clamped = Math.min(computedMax, Math.max(computedMin, Number(val) || 0));
    const y = padY + usableHeight - ((clamped - computedMin) / range) * usableHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  // Build smooth cubic bezier path matching Chart.js tension 0.35
  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpx1 = Number((p0.x + (p1.x - p0.x) * 0.4).toFixed(1));
    const cpy1 = p0.y;
    const cpx2 = Number((p1.x - (p1.x - p0.x) * 0.4).toFixed(1));
    const cpy2 = p1.y;
    linePath += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
  }

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const colors = TONE_PALETTE[tone] || TONE_PALETTE.emerald;

  return (
    <div className={`w-full overflow-hidden ${className}`} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full block"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fillStart} />
            <stop offset="100%" stopColor={colors.fillEnd} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

