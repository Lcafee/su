import { useId, useState } from "react";

function PrimitiveField({ label, value, onChange }) {
  if (typeof value === "boolean") {
    return (
      <label className="metadata-boolean">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <label className="metadata-field">
        <span>{label}</span>
        <input
          type="number"
          value={value}
          onChange={(event) => {
            if (event.target.value !== "") onChange(Number(event.target.value));
          }}
        />
      </label>
    );
  }

  return (
    <label className="metadata-field">
      <span>{label}</span>
      <input
        dir="auto"
        value={value === null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MetadataValue({ label, value, onChange }) {
  if (Array.isArray(value)) {
    return (
      <fieldset className="metadata-group">
        <legend>{label}</legend>
        {value.length === 0 ? <p className="empty-note">فهرست خالی است.</p> : null}
        {value.map((entry, index) => (
          <MetadataValue
            key={index}
            label={`مقدار ${index + 1}`}
            value={entry}
            onChange={(nextValue) => {
              const next = value.slice();
              next[index] = nextValue;
              onChange(next);
            }}
          />
        ))}
      </fieldset>
    );
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    return (
      <fieldset className="metadata-group">
        <legend>{label}</legend>
        {entries.length === 0 ? <p className="empty-note">اطلاعاتی ثبت نشده است.</p> : null}
        {entries.map(([key, entry]) => (
          <MetadataValue
            key={key}
            label={key}
            value={entry}
            onChange={(nextValue) => onChange({ ...value, [key]: nextValue })}
          />
        ))}
      </fieldset>
    );
  }

  return <PrimitiveField label={label} value={value} onChange={onChange} />;
}

export function MetadataEditor({ metadata, onChange }) {
  const keyListId = useId();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // A list has no names to add to; its values stay editable as they are.
  if (Array.isArray(metadata)) {
    return (
      <section className="metadata-editor" aria-label="اطلاعات تکمیلی">
        <strong>اطلاعات تکمیلی</strong>
        <div className="metadata-fields">
          <MetadataValue label="اطلاعات" value={metadata} onChange={onChange} />
        </div>
      </section>
    );
  }

  const record = metadata && typeof metadata === "object" ? metadata : {};
  // «featured» is the offer switch above, stored by the API on its own.
  const entries = Object.entries(record).filter(([key]) => key !== "featured");
  const key = newKey.trim();
  const keyIssue = key === "featured"
    ? "پیشنهاد ویژه با کلید «پیشنهاد ویژه» تنظیم می‌شود."
    : Object.prototype.hasOwnProperty.call(record, key) ? "این نام ثبت شده است؛ مقدارش را در همان مورد عوض کنید." : null;
  const canAdd = key !== "" && keyIssue === null;

  function add() {
    if (!canAdd) return;
    onChange({ ...record, [key]: newValue.trim() });
    setNewKey("");
    setNewValue("");
  }

  function remove(name) {
    const next = { ...record };
    delete next[name];
    onChange(next);
  }

  function addOnEnter(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  }

  return (
    <section className="metadata-editor" aria-label="اطلاعات تکمیلی">
      <strong>اطلاعات تکمیلی</strong>
      <div className="metadata-fields">
        {entries.length ? (
          <fieldset className="metadata-group">
            <legend>اطلاعات</legend>
            {entries.map(([name, value]) => (
              <div className={`metadata-entry${value !== null && typeof value === "object" ? " is-compound" : ""}`} key={name}>
                <MetadataValue
                  label={name}
                  value={value}
                  onChange={(nextValue) => onChange({ ...record, [name]: nextValue })}
                />
                <button type="button" className="quiet-button danger-button" aria-label={`حذف ${name}`}
                  onClick={() => remove(name)}>حذف</button>
              </div>
            ))}
          </fieldset>
        ) : (
          <p className="empty-note">هنوز اطلاعاتی ثبت نشده است.</p>
        )}
        <div className="metadata-add">
          <label className="metadata-field">
            <span>نام مورد تازه</span>
            <input dir="ltr" list={keyListId} value={newKey} maxLength={64}
              onChange={(event) => setNewKey(event.target.value)} onKeyDown={addOnEnter} />
          </label>
          <label className="metadata-field">
            <span>مقدار</span>
            <input dir="auto" value={newValue} maxLength={1000}
              onChange={(event) => setNewValue(event.target.value)} onKeyDown={addOnEnter} />
          </label>
          <button type="button" className="secondary-button" disabled={!canAdd} onClick={add}>افزودن مورد</button>
          <small role={keyIssue ? "status" : undefined}>
            {keyIssue ?? "برای اتصال به کالای سامانه عملیات، نام «code» و کد کالا را بنویسید."}
          </small>
          <datalist id={keyListId}>
            <option value="code">کد کالا</option>
            <option value="caption">متن تصویر</option>
          </datalist>
        </div>
      </div>
    </section>
  );
}
