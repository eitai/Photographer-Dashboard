import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupplierNotifications } from '@/hooks/useSupplierNotifications';

export const SupplierNotificationBell = () => {
  const { unreadCount, clearUnread } = useSupplierNotifications();
  const navigate = useNavigate();
  const hasNew = unreadCount > 0;

  return (
    <button
      onClick={() => {
        clearUnread();
        navigate('/supplier/orders');
      }}
      className='relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer'
      aria-label='Order notifications'
    >
      <Bell size={18} className={hasNew ? 'text-foreground' : ''} />
      {hasNew && (
        <>
          <span className='absolute top-0.5 end-0.5 w-2 h-2 rounded-full bg-primary animate-ping' />
          <span className='absolute top-0.5 end-0.5 w-2 h-2 rounded-full bg-primary' />
        </>
      )}
    </button>
  );
};
