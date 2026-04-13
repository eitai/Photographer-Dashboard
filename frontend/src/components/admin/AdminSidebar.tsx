import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { LayoutDashboard, Users, BookOpen, Settings, LogOut, Languages, Star, Shield, Mail } from 'lucide-react';
import { useMyStorage } from '@/hooks/useQueries';
import { StorageBar } from '@/components/admin/StorageBar';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AdminSidebar = ({ isOpen, onClose }: AdminSidebarProps) => {
  const { admin, logout } = useAuth();
  const { t, lang, dir, toggleLang } = useI18n();
  const navigate = useNavigate();
  const { data: storage } = useMyStorage();

  const NAV_ITEMS =
    admin?.role === 'superadmin'
      ? [{ to: '/admin/users', label: t('admin.nav.users'), icon: Shield }]
      : [
          { to: '/admin/dashboard', label: t('admin.nav.dashboard'), icon: LayoutDashboard },
          { to: '/admin/clients', label: t('admin.nav.clients'), icon: Users },
          { to: '/admin/showcase', label: t('admin.nav.showcase'), icon: Star },
          { to: '/admin/blog', label: t('admin.nav.blog'), icon: BookOpen },
          { to: '/admin/contact', label: t('admin.nav.contact'), icon: Mail },
          { to: '/admin/settings', label: t('admin.nav.settings'), icon: Settings },
        ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  return (
    <aside
      className={`
      fixed inset-y-0 z-30 w-60 bg-white flex flex-col
      transition-transform duration-200
      ${dir === 'rtl' ? 'right-0 border-l border-gray-200' : 'left-0 border-r border-gray-200'}
      ${isOpen ? 'translate-x-0' : dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'}
      md:static md:translate-x-0
    `}
    >
      {/* Logo */}
      <div className='h-16 px-6 border-b border-gray-100 flex items-center'>
        <img src='/logos/03_logo_horizontal_transparent.png' alt='Koral Light Studio' className='h-full w-full object-contain py-2 transition-transform duration-200 hover:scale-110' />
      </div>

      {/* Navigation */}
      <nav className='flex-1 p-4 space-y-1'>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-colors duration-150 ${
                isActive ? 'bg-blush/20 text-charcoal font-medium' : 'text-warm-gray hover:bg-ivory hover:text-charcoal'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className='p-4 border-t border-beige'>
        <div className='mb-3 px-3'>
          <p className='text-xs font-medium text-charcoal truncate'>{admin?.name}</p>
          <p className='text-xs text-warm-gray truncate'>{admin?.email}</p>
        </div>
        {/* Storage bar — only for non-superadmin users */}
        {admin?.role === 'admin' && storage && (
          <div className='px-3 mb-3'>
            <StorageBar
              usedGB={storage.usedGB}
              quotaGB={storage.quotaGB}
              percentUsed={storage.percentUsed}
              compact
            />
          </div>
        )}
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className='flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-sans text-warm-gray hover:bg-ivory hover:text-charcoal transition-colors duration-150 mb-1'
        >
          <Languages size={17} />
          {lang === 'he' ? 'English' : 'עברית'}
        </button>
        <button
          onClick={handleLogout}
          className='flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-sans text-warm-gray hover:bg-ivory hover:text-charcoal transition-colors duration-150'
        >
          <LogOut size={17} />
          {t('admin.nav.logout')}
        </button>
      </div>
    </aside>
  );
};
