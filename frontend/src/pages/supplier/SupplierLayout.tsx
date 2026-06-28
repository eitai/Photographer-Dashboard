import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Settings, ShoppingCart, LogOut, Wallet } from 'lucide-react';
import { useSupplierAuth } from '@/hooks/useSupplierAuth';
import { useI18n } from '@/lib/i18n';
import { SupplierNotificationBell } from '@/components/supplier/SupplierNotificationBell';

export const SupplierLayout = () => {
  const { supplier, logout } = useSupplierAuth();
  const { t, dir } = useI18n();
  const navigate = useNavigate();

  // Mirror the violet theme onto <body> so Radix portals (dialogs, selects)
  // inherit it. Cleared on unmount so other routes are unaffected.
  useEffect(() => {
    document.body.setAttribute('data-theme', 'violet');
    return () => document.body.removeAttribute('data-theme');
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/supplier/login');
  };

  const navItems = [
    { to: '/supplier', label: t('supplier.nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/supplier/products', label: t('supplier.nav.products'), icon: Package },
    { to: '/supplier/orders', label: t('supplier.nav.orders'), icon: ShoppingCart },
    { to: '/supplier/settlement', label: t('supplier.nav.settlement'), icon: Wallet },
    { to: '/supplier/settings', label: t('supplier.nav.settings'), icon: Settings },
  ];

  return (
    <div data-theme='violet' className='min-h-screen flex bg-background'>
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 z-30 w-60 flex flex-col bg-card border-e border-border
          ${dir === 'rtl' ? 'right-0' : 'left-0'}
        `}
      >
        {/* Logo */}
        <div className='h-24 px-4 flex items-center justify-center border-b border-border'>
          <img src='/logos/favicon.png' style={{ mixBlendMode: 'multiply' }} alt='LIGHT STUDIO' className='h-60 w-60 object-contain' />
        </div>

        {/* Supplier identity */}
        {supplier && (
          <div className='px-5 py-4 border-b border-border'>
            <p className='text-xs uppercase tracking-widest mb-1 text-muted-foreground'>{t('supplier.login.title')}</p>
            <p className='text-sm font-medium truncate text-foreground'>{supplier.name}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className='flex-1 p-3 space-y-0.5'>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive
                  ? `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                     bg-primary/10 text-primary border-s-2 border-primary ps-[9px]`
                  : `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                     text-muted-foreground hover:bg-muted hover:text-foreground`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className='p-3 border-t border-border'>
          <button
            onClick={handleLogout}
            className='flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            <LogOut size={17} />
            {t('supplier.nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main content — offset by sidebar width */}
      <main className='flex-1 min-h-screen bg-background ms-60'>
        <div className='h-12 px-6 flex items-center justify-end border-b border-border bg-background sticky top-0 z-20'>
          <SupplierNotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
};
