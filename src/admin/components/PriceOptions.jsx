export function PriceOptions({ options, advanced, disabled, onChange }) {
  if (!advanced && options.length === 0) return null;
  function update(id, patch) {
    onChange(options.map((option) => option.id === id ? { ...option, ...patch } : option));
  }
  return (
    <fieldset className="price-options" disabled={disabled}>
      <legend>گزینه‌های قیمت</legend>
      {options.length ? <p>هر گزینه با نام و قیمت خودش در منو نمایش داده می‌شود.</p> : null}
      {options.map((option) => (
        <div className="price-option-row" key={option.id}>
          <label><span>نام گزینه</span>
            <input dir="auto" value={option.label} maxLength="191" readOnly={!advanced}
              onChange={(event) => update(option.id, { label: event.target.value })} />
          </label>
          <label><span>قیمت گزینه</span>
            <input dir="auto" value={option.price} maxLength="64"
              onChange={(event) => update(option.id, { price: event.target.value })} />
          </label>
          {advanced ? <>
            <label><span>کد گزینه (اختیاری)</span>
              <input dir="auto" value={option.code ?? ""} maxLength="64"
                onChange={(event) => update(option.id, { code: event.target.value || null })} />
            </label>
            <button type="button" className="quiet-button danger-button" aria-label={`حذف گزینه ${option.label || "بدون نام"}`}
              onClick={() => onChange(options.filter((entry) => entry.id !== option.id))}>حذف گزینه</button>
          </> : null}
        </div>
      ))}
      {advanced ? <button type="button" className="secondary-button" disabled={options.length >= 50}
        onClick={() => onChange([...options, { id: crypto.randomUUID(), label: "", price: "", code: null }])}>افزودن گزینه قیمت</button> : null}
    </fieldset>
  );
}
