import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { NotificationBell } from './NotificationBell';
import { StorageBar } from './StorageBar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { useMyStorage } from '@/hooks/useQueries';
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
  const { admin } = useAuth();
  const { data: storage, isLoading: storageLoading } = useMyStorage();

  return (
    <div dir={dir} data-theme={theme} className='admin-layout flex h-screen overflow-hidden bg-white'>
      {/* Mobile overlay */}
      {sidebarOpen && <div className='fixed inset-0 z-20 bg-black/40 md:hidden' onClick={() => setSidebarOpen(false)} />}

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className='flex-1 overflow-hidden min-w-0 flex flex-col'>
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
          <div className='flex-1 flex items-center gap-3'>{actions}</div>
          {/* Storage bar — compact, admin role only */}
          {admin?.role === 'admin' && (
            <div className='hidden sm:block w-36'>
              {storageLoading || !storage ? (
                <div className='space-y-1'>
                  <Skeleton className='h-1 w-full rounded-full' />
                  <Skeleton className='h-2.5 w-20' />
                </div>
              ) : (
                <StorageBar
                  usedGB={storage.usedGB}
                  quotaGB={storage.quotaGB}
                  percentUsed={storage.percentUsed}
                  unlimited={storage.unlimited}
                  compact
                />
              )}
            </div>
          )}
          {/* Notification bell */}
          <NotificationBell />
        </div>
        <div className='px-4 md:px-8 pt-3 flex-1 bg-gray-50 overflow-y-auto'>
          <ErrorBoundary label={title || 'page content'}>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
