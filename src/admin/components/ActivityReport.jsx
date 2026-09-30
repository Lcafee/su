import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getCashierActivity } from "../api";

const fields = {
  title: "نام دسته", intro: "توضیح دسته", layout: "نوع نمایش", archived: "آرشیو",
  sortOrder: "ترتیب", categoryId: "دسته", name: "نام آیتم", description: "توضیح",
  price: "قیمت", mediaId: "تصویر", metadata: "تنظیمات پیشرفته", options: "گزینه‌های قیمت",
};
const operations = { create: "افزودن", update: "ویرایش", delete: "حذف" };
const dateFormat = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });

function valueText(value, field) {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (field === "options") return value.map((option) => `${option.label}: ${option.price}`).join(" / ") || "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function ActivityReportComponent({ revision, onSessionExpiry }) {
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async (before = null) => {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const result = await getCashierActivity(before);
      if (id !== requestId.current) return;
      setEntries((current) => before ? [...current, ...result.entries] : result.entries);
      setCursor(result.nextCursor);
    } catch (failure) {
      if (id !== requestId.current) return;
      if (!onSessionExpiry(failure)) setError("گزارش دریافت نشد. دوباره تلاش کنید.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [onSessionExpiry]);
  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load, revision]);

  return (
    <section className="activity-report" aria-labelledby="activity-title" aria-busy={busy}>
      <div className="editor-toolbar">
        <div><h2 id="activity-title">گزارش تغییرات صندوق‌دار</h2>
          <p>تغییرات ذخیره‌شده و بارگذاری تصاویر با نام کاربر و زمان ثبت می‌شوند.</p></div>
        <button className="quiet-button" type="button" disabled={busy} onClick={() => load()}>{busy ? "در حال دریافت…" : "به‌روزرسانی گزارش"}</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!entries.length && !busy && !error ? <p>هنوز تغییری از صندوق‌دار ثبت نشده است.</p> : null}
      <div className="activity-list">
        {entries.map((entry) => (
          <details className="activity-entry" key={entry.id}>
            <summary><strong>{entry.username}</strong>
              <span>{entry.action === "menu.save" ? `ذخیره منو · نسخه ${entry.revision}` : "بارگذاری تصویر"}</span>
              <time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time>
            </summary>
            {entry.action === "media.upload" ? <p>شناسه تصویر: <bdi>{entry.details.mediaId}</bdi></p> : (
              <div className="activity-changes">
                {entry.details.changes.length === 0 ? <p>منو بدون تغییر محتوا ذخیره شد.</p> : null}
                {entry.details.changes.map((change) => (
                  <div key={change.id}><h3>{operations[change.operation]} {change.type === "category" ? "دسته" : "آیتم"} «{change.name}»</h3>
                    <dl>{change.fields.map((item) => (
                      <div key={item.field}><dt>{fields[item.field] || item.field}</dt>
                        <dd><span>قبل: <bdi>{item.beforeLabel ?? valueText(item.before, item.field)}</bdi></span>
                          <span>بعد: <bdi>{item.afterLabel ?? valueText(item.after, item.field)}</bdi></span></dd></div>
                    ))}</dl>
                  </div>
                ))}
              </div>
            )}
          </details>
        ))}
      </div>
      {cursor ? <button type="button" className="secondary-button" disabled={busy} onClick={() => load(cursor)}>گزارش‌های قدیمی‌تر</button> : null}
    </section>
  );
}

export const ActivityReport = memo(ActivityReportComponent);
