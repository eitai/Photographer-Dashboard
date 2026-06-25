import React, { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

// Shared primitives for the exhibition-white landing page.
// Palette: paper #FFFFFF · ink #111111 · graphite #5C5C66 · hairline #E8E8EC · flag #F5A623

export function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// Small uppercase kicker above section headings.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className='text-xs font-body font-semibold tracking-[0.2em] uppercase text-[#5C5C66] mb-3'>
      {children}
    </p>
  );
}

export function SectionHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-3xl md:text-[2.6rem] leading-tight text-[#111111] ${className}`}>
      {children}
    </h2>
  );
}

// Primary CTA — solid ink button, the only "loud" interactive element.
export function CtaButton({ children, onClick, big = false }: { children: React.ReactNode; onClick: () => void; big?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] text-white font-body font-medium
        transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]
        ${big ? 'px-10 py-4 text-base' : 'px-7 py-3 text-sm'}`}>
      {children}
      <svg className='w-4 h-4 rtl:rotate-180' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24' aria-hidden='true'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M13 7l5 5m0 0l-5 5m5-5H6' />
      </svg>
    </button>
  );
}

// Quiet secondary action.
export function GhostButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a href={href}
      className='inline-flex items-center justify-center px-7 py-3 rounded-full border border-[#E8E8EC] text-sm font-body text-[#5C5C66]
        transition-colors hover:border-[#111111] hover:text-[#111111]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'>
      {children}
    </a>
  );
}

// Amber selection heart — mirrors the client gallery "pick" affordance.
export function FlagHeart({ active, className = '' }: { active: boolean; className?: string }) {
  return (
    <span aria-hidden='true'
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200
        ${active ? 'bg-[#F5A623] text-white scale-100' : 'bg-white/85 text-[#5C5C66] scale-90'} ${className}`}>
      <svg className='w-3.5 h-3.5' viewBox='0 0 24 24' fill={active ? 'currentColor' : 'none'} stroke='currentColor' strokeWidth='2'>
        <path strokeLinecap='round' strokeLinejoin='round'
          d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z' />
      </svg>
    </span>
  );
}
