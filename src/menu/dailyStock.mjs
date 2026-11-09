export const DAILY_LIMIT = 10;
export function tehranDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function readDailyStock(metadata, now = new Date()) {
  const value = metadata?.dailyRemaining;
  return metadata?.dailyDate === tehranDay(now) && Number.isInteger(value) && value >= 0 && value <= DAILY_LIMIT ? value : null;
}
export function marbleProduct(item) {
  const configured = item.metadata?.marbleBrownie === true;
  return { ...item, name: configured ? item.name : 'ماربل براونی',
    description: configured ? item.description : null,
    price: configured ? item.price : null, options: configured ? item.options : [] };
}
