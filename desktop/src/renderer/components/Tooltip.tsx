import React from 'react';

/** Styled tooltip that appears on hover — used for truncated text like model names */
export default function Tooltip({ text, children, className = '' }: {
  text: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative group/tip ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover/tip:block
        max-w-xs px-2.5 py-1.5 rounded bg-bg-input border border-border-primary shadow-lg
        text-[11px] font-mono text-text-primary whitespace-nowrap">
        {text}
      </span>
    </span>
  );
}
