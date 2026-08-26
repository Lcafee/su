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
  const isEmpty = Array.isArray(metadata)
    ? metadata.length === 0
    : Object.keys(metadata || {}).length === 0;

  return (
    <details className="metadata-editor">
      <summary>اطلاعات تکمیلی</summary>
      <div className="metadata-fields">
        {isEmpty ? (
          <p className="empty-note">این آیتم اطلاعات تکمیلی قابل ویرایش ندارد.</p>
        ) : (
          <MetadataValue label="اطلاعات" value={metadata} onChange={onChange} />
        )}
      </div>
    </details>
  );
}
