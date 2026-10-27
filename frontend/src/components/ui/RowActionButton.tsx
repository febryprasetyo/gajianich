'use client';

import React from 'react';
import Link from 'next/link';

export type RowActionVariant = 'default' | 'emerald' | 'amber' | 'rose';

export interface RowActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title?: string;
  onClick?: () => void;
  href?: string;
  variant?: RowActionVariant;
  className?: string;
}

const variantStyles: Record<RowActionVariant, string> = {
  default: "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
  emerald: "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50",
  amber: "text-amber-600 hover:text-amber-800 hover:bg-amber-50",
  rose: "text-rose-500 hover:text-rose-700 hover:bg-rose-50",
};

export default function RowActionButton({
  icon: IconComponent,
  label,
  title,
  onClick,
  href,
  variant = "default",
  className = "",
}: RowActionButtonProps) {
  const tooltip = title || label;
  const baseClasses = `p-1.5 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer ${variantStyles[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} title={tooltip} aria-label={label} className={baseClasses}>
        <IconComponent className="w-3.5 h-3.5" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={label}
      className={baseClasses}
    >
      <IconComponent className="w-3.5 h-3.5" />
    </button>
  );
}
