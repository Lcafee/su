import { DAILY_LIMIT, tehranDay } from '../../menu/dailyStock.mjs';
import { MARBLE_DESCRIPTION, MARBLE_OPTIONS } from '../../menu/marbleContent.mjs';
import '../daily-stock.css';

export function DailyStockEditor({ item, disabled, onChange }) {
  const metadata = item.metadata && !Array.isArray(item.metadata) ? item.metadata : {};
  const activated = metadata.marbleBrownie === true;
  return <fieldset disabled={disabled} className="daily-stock-editor">
    <legend>ماربل براونی · موجودی روزانه</legend>
    {!activated ? <>
      <p>جایگزینی پامکین با ماربل براونی؛ توضیحات و قیمت‌ها را قبل از انتشار بررسی کنید.</p>
      <button type="button" className="quiet-button" onClick={() => onChange({ name: 'ماربل براونی', description: MARBLE_DESCRIPTION, price: null,
        options: MARBLE_OPTIONS.map(option => ({ ...option, id: crypto.randomUUID(), code: null })), mediaId: null, media: null,
        metadata: { ...metadata, marbleBrownie: true, dailyRemaining: 10, dailyDate: tehranDay() } })}>آماده‌سازی ماربل براونی</button>
    </> : <>
      <label>تعداد باقی‌مانده امروز (۰ تا ۱۰)
        <input type="number" min="0" max={DAILY_LIMIT} step="1" inputMode="numeric"
          value={metadata.dailyDate === tehranDay() ? metadata.dailyRemaining ?? '' : ''}
          onChange={event => {
            const value = event.target.value;
            if (value === '') { onChange({ metadata: { ...metadata, dailyRemaining: null, dailyDate: tehranDay() } }); return; }
            const number = Number(value);
            if (Number.isInteger(number) && number >= 0 && number <= DAILY_LIMIT) onChange({ metadata: { ...metadata, dailyRemaining: number, dailyDate: tehranDay() } });
          }} />
      </label>
      <button type="button" className="quiet-button" onClick={() => onChange({ metadata: { ...metadata, dailyRemaining: 10, dailyDate: tehranDay() } })}>ثبت ۱۰ برش برای امروز</button>
      <p>بعد از تغییر، «ذخیره و انتشار» را بزنید. موجودی خودکار شارژ نمی‌شود.</p>
    </>}
  </fieldset>;
}
