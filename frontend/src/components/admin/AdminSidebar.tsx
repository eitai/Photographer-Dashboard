import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { LayoutDashboard, Users, BookOpen, Settings, LogOut, Camera, Languages, Star, Shield, Mail } from 'lucide-react';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AdminSidebar = ({ isOpen, onClose }: AdminSidebarProps) => {
  const { admin, logout } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();

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
      fixed inset-y-0 right-0 z-30 w-60 bg-card border-l border-beige flex flex-col
      transition-transform duration-200
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      md:static md:translate-x-0 md:border-r md:border-l-0
    `}
    >
      {/* Logo */}
      <div className='p-6 border-b border-beige flex items-center gap-3'>
        <Camera size={22} className='text-blush' />
        <div>
          <p className=' text-charcoal  text-sm font-semibold leading-tight'>Koral</p>
          <p className='text-xs text-warm-gray'>{t('admin.sidebar.studio')}</p>
        </div>
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
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className='flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-sans text-warm-gray hover:bg-ivory hover:text-charcoal transition-colors duration-150 mb-1'
        >
          <Languages size={17} />
          {lang === 'he' ? 'English' : 'עברית'}
        </button>
        <button
          onClick={handleLogout}
          className='flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-sans text-warm-gray hover:bg-ivory hover:text-charcoal transition-colors duration-150'
        >
          <LogOut size={17} />
          {t('admin.nav.logout')}
        </button>
      </div>
    </aside>
  );
};
