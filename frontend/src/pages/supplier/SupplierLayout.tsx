import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, LogOut } from 'lucide-react';
import { useSupplierAuth } from '@/hooks/useSupplierAuth';
import { useI18n } from '@/lib/i18n';

export const SupplierLayout = () => {
  const { supplier, logout } = useSupplierAuth();
  const { t, dir } = useI18n();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/supplier/login');
  };

  const navItems = [
    { to: '/supplier/products', label: t('supplier.nav.products'), icon: Package },
    { to: '/supplier/orders', label: t('supplier.nav.orders'), icon: ShoppingCart },
  ];

  return (
    <div className='min-h-screen bg-ivory flex'>
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 z-30 w-60 bg-white flex flex-col border-zinc-200
          ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'}
        `}
      >
        {/* Logo */}
        <div className='h-16 px-6 border-b border-zinc-200 flex items-center'>
          <img
            src='/logos/03_logo_horizontal_transparent.png'
            alt='LIGHT STUDIO'
            className='h-full w-full object-contain py-2'
          />
        </div>

        {/* Supplier name */}
        {supplier && (
          <div className='px-5 py-4 border-b border-zinc-100'>
            <p className='text-xs text-zinc-400 uppercase tracking-widest mb-0.5'>
              {t('supplier.login.title')}
            </p>
            <p className='text-sm font-medium text-charcoal truncate'>{supplier.name}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className='flex-1 p-4 space-y-1'>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-colors duration-150 ${
                  isActive
                    ? 'bg-blush/20 text-charcoal font-medium'
                    : 'text-zinc-500 hover:bg-ivory hover:text-charcoal'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className='p-4 border-t border-zinc-100'>
          <button
            onClick={handleLogout}
            className='flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-sans text-zinc-500 hover:bg-ivory hover:text-charcoal transition-colors duration-150'
          >
            <LogOut size={17} />
            {t('supplier.nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main content — offset by sidebar width */}
      <main className={`flex-1 ${dir === 'rtl' ? 'me-60' : 'ms-60'}`}>
        <Outlet />
      </main>
    </div>
  );
};
