import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { NotificationBell } from './NotificationBell';
import { useAuthStore } from '@/store/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useI18n } from '@/lib/i18n';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export const AdminLayout = ({ children, title, actions }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = useAuthStore((s) => s.theme);
  const { dir } = useI18n();

  return (
    <div dir={dir} data-theme={theme} className='admin-layout flex min-h-screen bg-white'>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 z-20 bg-black/40 md:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className='flex-1 overflow-auto min-w-0 flex flex-col'>
        {/* Top bar — visually extends the sidebar logo section */}
        <div className='h-16 flex items-center gap-4 px-6 bg-white border-b border-gray-100 shrink-0'>
          {/* Hamburger — mobile only */}
          <button
            className='md:hidden p-2 rounded-xl text-warm-gray hover:bg-beige/30 transition-colors shrink-0'
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          {/* Title */}
          {title && <h1 className='text-base font-semibold text-charcoal shrink-0'>{title}</h1>}
          {/* Actions (search + buttons) — fills remaining space */}
          <div className='flex-1 flex items-center gap-3'>
            {actions}
          </div>
          {/* Notification bell */}
          <NotificationBell />
        </div>
        <div className='px-4 md:px-8 py-6 flex-1 bg-gray-50'>
          <ErrorBoundary label={title || 'page content'}>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
