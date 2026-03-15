import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { NotificationBell } from './NotificationBell';
import { useAuthStore } from '@/store/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = useAuthStore((s) => s.theme);

  return (
    <div dir='rtl' data-theme={theme} className='flex min-h-screen bg-ivory'>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 z-20 bg-black/40 md:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className='flex-1 overflow-auto min-w-0'>
        {/* Top bar */}
        <div className='flex items-center justify-between px-4 md:px-8 pt-4 md:pt-8 pb-2'>
          <div className='flex items-center gap-3'>
            {/* Hamburger — mobile only */}
            <button
              className='md:hidden p-2 rounded-lg text-warm-gray hover:bg-beige/30 transition-colors'
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            {title && <h1 className='text-xl md:text-2xl font-sans text-charcoal'>{title}</h1>}
          </div>
          <NotificationBell />
        </div>
        <div className='px-4 md:px-8 pb-8'>
          <ErrorBoundary label={title || 'page content'}>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
