import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGalleries } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';

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

export const NotificationBell = () => {
  const { data: galleries = [] } = useGalleries();
  const { admin } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Load dismissed IDs for the current admin whenever they change
  useEffect(() => {
    if (admin?.id) setDismissed(loadDismissed(admin.id));
    else setDismissed(new Set());
  }, [admin?.id]);

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
  const count = pending.length;

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-warm-gray hover:bg-card hover:text-charcoal transition-colors"
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
              {count === 0 ? 'אין בחירות חדשות' : `${count} בחירות ממתינות לאישור`}
            </p>
            {count > 0 && (
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
            <ul className="max-h-64 overflow-y-auto divide-y divide-beige">
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
          )}
        </div>
      )}
    </div>
  );
};
