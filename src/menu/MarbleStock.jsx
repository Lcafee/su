import { createContext, useContext, useEffect, useState } from 'react';
import { readDailyStock } from './dailyStock.mjs';
import { findSeasonalProduct } from './seasonalFeature.mjs';
import { sitePath } from '../sitePath';
const StockContext = createContext({ remaining: null, connected: false });
const fa = value => new Intl.NumberFormat('fa-IR').format(value);
export function MarbleStockProvider({ item, snapshotSource, children }) {
  const [inventory, setInventory] = useState({ metadata: item?.metadata, connected: snapshotSource === 'current' });
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    if (!item) return undefined;
    let stopped = false;
    let timer;
    let controller;
    let busy = false;
    async function refresh() {
      if (stopped || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(sitePath('managed-menu/current.json'), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) throw new Error('Inventory unavailable');
        const snapshot = await response.json();
        if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.categories)) throw new Error('Invalid snapshot');
        const fresh = findSeasonalProduct(snapshot.categories);
        if (!stopped) setInventory({ metadata: fresh?.metadata, connected: true });
      } catch {
        if (!stopped) setInventory(current => ({ ...current, connected: false }));
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!stopped) setClock(new Date());
      }
    }
    const visible = () => { if (!document.hidden) { setInventory(current => ({ ...current, connected: false })); refresh(); } };
    refresh();
    timer = setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    const offline = () => setInventory(current => ({ ...current, connected: false }));
    window.addEventListener('offline', offline);
    return () => { stopped = true; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', visible); window.removeEventListener('offline', offline); };
  }, [item?.id]);
  const remaining = inventory.connected ? readDailyStock(inventory.metadata, clock) : null;
  return <StockContext.Provider value={{remaining, connected: inventory.connected}}>{children}</StockContext.Provider>;
}
export function FloatingMarbleStock() {
  const { remaining } = useContext(StockContext);
  return <span className="seasonal-floating-note seasonal-floating-count" role="status" aria-live="polite" aria-atomic="true" data-stock={remaining === null ? 'unknown' : remaining === 0 ? 'empty' : 'available'}>
    {remaining === null ? <span className="seasonal-count-message">موجودی رو<br />از کافه بپرس!</span>
      : remaining === 0 ? <span className="seasonal-count-message">این سری<br />تموم شد!</span>
      : <><span className="seasonal-count-only">فقط</span><strong>{fa(remaining)}</strong><span className="seasonal-count-caption">برش مونده!</span></>}
  </span>;
}
