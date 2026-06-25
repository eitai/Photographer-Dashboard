import { useEffect, useRef, useState } from 'react';
import { useSupplierOrders } from './useQueries';

const playNotificationSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* AudioContext blocked until user interaction */
  }
};

export const useSupplierNotifications = () => {
  const { data } = useSupplierOrders({ status: 'sent_to_supplier', limit: 1 });
  const currentCount = data?.total ?? 0;
  const prevCountRef = useRef<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (prevCountRef.current === null) {
      prevCountRef.current = currentCount;
      return;
    }
    const diff = currentCount - prevCountRef.current;
    if (diff > 0) {
      setUnreadCount((n) => n + diff);
      playNotificationSound();
    }
    prevCountRef.current = currentCount;
  }, [currentCount]);

  const clearUnread = () => setUnreadCount(0);

  return { unreadCount, clearUnread };
};
