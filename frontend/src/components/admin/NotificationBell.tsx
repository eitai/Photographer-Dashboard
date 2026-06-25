import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useGalleries, queryKeys } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { getOrders } from '@/lib/api';
import type { StoreOrder } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

function getDismissedKey(adminId: string) {
  return `notif_dismissed_${adminId}`;
}

function loadDismissed(adminId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getDismissedKey(adminId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(adminId: string, ids: Set<string>) {
  localStorage.setItem(getDismissedKey(adminId), JSON.stringify([...ids]));
}

// ---- Order status seen tracking ----

function getSeenOrderKey(adminId: string) {
  return `koral_seen_order_statuses_${adminId}`;
}

function loadSeenOrders(adminId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getSeenOrderKey(adminId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenOrders(adminId: string, ids: Set<string>) {
  localStorage.setItem(getSeenOrderKey(adminId), JSON.stringify([...ids]));
}

const ORDER_STATUS_DOTS: Record<string, string> = {
  in_production: 'bg-orange-400',
  ready_to_ship: 'bg-indigo-400',
  shipped: 'bg-blue-400',
  delivered: 'bg-green-500',
};

export const NotificationBell = () => {
  const { data: galleries = [] } = useGalleries();
  const { admin } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [seenOrders, setSeenOrders] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Load dismissed IDs for the current admin whenever they change
  useEffect(() => {
    if (admin?.id) {
      setDismissed(loadDismissed(admin.id));
      setSeenOrders(loadSeenOrders(admin.id));
    } else {
      setDismissed(new Set());
      setSeenOrders(new Set());
    }
  }, [admin?.id]);

  // Poll for orders that the supplier has moved to in_production / shipped / delivered
  const { data: inProductionData } = useQuery({
    queryKey: [...queryKeys.orders, { status: 'in_production', limit: 50 }],
    queryFn: () => getOrders({ status: 'in_production', limit: 50 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: shippedData } = useQuery({
    queryKey: [...queryKeys.orders, { status: 'shipped', limit: 50 }],
    queryFn: () => getOrders({ status: 'shipped', limit: 50 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: deliveredData } = useQuery({
    queryKey: [...queryKeys.orders, { status: 'delivered', limit: 50 }],
    queryFn: () => getOrders({ status: 'delivered', limit: 50 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const allStatusOrders: StoreOrder[] = [
    ...(inProductionData?.orders ?? []),
    ...(shippedData?.orders ?? []),
    ...(deliveredData?.orders ?? []),
  ];
  const unseenOrders = allStatusOrders.filter((o) => !seenOrders.has(o.id));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pending = galleries.filter(
    (g) => g.status === 'selection_submitted' && !dismissed.has(g._id)
  );
  const count = pending.length + unseenOrders.length;

  const dismissAll = useCallback(() => {
    if (!admin?.id) return;
    const next = new Set([...dismissed, ...pending.map((g) => g._id)]);
    setDismissed(next);
    saveDismissed(admin.id, next);
  }, [admin?.id, dismissed, pending]);

  const dismissOne = useCallback((id: string) => {
    if (!admin?.id) return;
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    saveDismissed(admin.id, next);
  }, [admin?.id, dismissed]);

  const markOrderSeen = useCallback((orderId: string) => {
    if (!admin?.id) return;
    const next = new Set([...seenOrders, orderId]);
    setSeenOrders(next);
    saveSeenOrders(admin.id, next);
  }, [admin?.id, seenOrders]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl text-warm-gray hover:bg-card hover:text-charcoal transition-colors"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-blush text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 bg-card border border-beige rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-beige flex items-center justify-between">
            <p className="text-sm font-medium font-sans text-charcoal">
              {count === 0 ? 'אין התראות חדשות' : `${count} התראות חדשות`}
            </p>
            {pending.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs font-sans text-warm-gray hover:text-charcoal transition-colors"
              >
                נקה הכל
              </button>
            )}
          </div>

          {count === 0 ? (
            <p className="px-4 py-4 text-sm text-warm-gray text-center">הכל עדכני ✓</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {/* Gallery selection notifications */}
              {pending.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-warm-gray">
                    בחירות גלריה
                  </p>
                  <ul className="divide-y divide-beige">
                    {pending.map((g) => (
                      <li key={g._id}>
                        <Link
                          to={g.clientId?._id ? `/admin/clients/${g.clientId._id}` : '/admin/clients'}
                          onClick={() => { dismissOne(g._id); setOpen(false); }}
                          className="flex flex-col px-4 py-3 hover:bg-ivory transition-colors"
                        >
                          <span className="text-sm text-charcoal font-medium">{g.clientName || g.clientId?.name || g.name}</span>
                          <span className="text-xs text-warm-gray mt-0.5">
                            {g.name} · {new Date(g.updatedAt).toLocaleDateString('he-IL')}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Order status notifications */}
              {unseenOrders.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-warm-gray border-t border-beige">
                    עדכוני הזמנות
                  </p>
                  <ul className="divide-y divide-beige">
                    {unseenOrders.map((order) => (
                      <li key={order.id}>
                        <Link
                          to={order.clientId ? `/admin/clients/${order.clientId}` : `/admin/orders/${order.id}`}
                          onClick={() => { markOrderSeen(order.id); setOpen(false); }}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-ivory transition-colors"
                        >
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${ORDER_STATUS_DOTS[order.status] ?? 'bg-warm-gray'}`}
                          />
                          <span className="flex flex-col min-w-0">
                            <span className="text-sm text-charcoal font-medium truncate">
                              {order.client ? `הזמנה עבור ${order.client.name}` : t('orders.direct_badge')}
                            </span>
                            <span className="text-xs text-warm-gray mt-0.5">
                              {t(`orders.notify.${order.status}` as Parameters<typeof t>[0])} · {new Date(order.updatedAt).toLocaleDateString('he-IL')}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
