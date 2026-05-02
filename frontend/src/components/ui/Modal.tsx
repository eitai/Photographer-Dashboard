import { type ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  maxWidth?: string;
}

export const Modal = ({ isOpen, onClose, children, maxWidth = 'max-w-sm' }: ModalProps) => {
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4'
      onClick={onClose}
    >
      <div
        className={`bg-card rounded-2xl border border-beige shadow-xl w-full ${maxWidth} p-4 sm:p-6 max-h-[90dvh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
