function publishPresentation(status) {
  if (!status) {
    return { tone: "neutral", title: "وضعیت انتشار", message: "در حال دریافت وضعیت…", retry: false };
  }
  if (status.state === "published_status_pending") {
    return {
      tone: "pending",
      title: "منو منتشر شد",
      message: "فایل عمومی به‌روز شده، اما ثبت وضعیت انتشار نیاز به تلاش دوباره دارد.",
      retry: true,
    };
  }
  if (status.state === "failed") {
    return {
      tone: "error",
      title: "تغییرات ذخیره شد؛ انتشار انجام نشد",
      message: status.error || "نسخه قبلی منوی عمومی همچنان فعال است.",
      retry: true,
    };
  }
  if (status.state === "pending" || status.publishedRevision < status.editRevision) {
    return {
      tone: "pending",
      title: "انتشار در انتظار است",
      message: "تغییرات در پایگاه داده ذخیره شده‌اند و می‌توان انتشار را دوباره انجام داد.",
      retry: true,
    };
  }
  if (status.state === "not_published") {
    return {
      tone: "neutral",
      title: "هنوز نسخه‌ای منتشر نشده",
      message: "پس از اولین ذخیره، نسخه عمومی منو ساخته می‌شود.",
      retry: false,
    };
  }
  return {
    tone: "success",
    title: "منوی عمومی به‌روز است",
    message: `نسخه ${status.publishedRevision} منتشر شده است.`,
    retry: false,
  };
}

export function PublishPanel({ status, retrying, onRetry }) {
  const presentation = publishPresentation(status);
  return (
    <section className={`publish-panel tone-${presentation.tone}`} aria-live="polite">
      <div>
        <strong>{presentation.title}</strong>
        <p>{presentation.message}</p>
      </div>
      {presentation.retry ? (
        <button type="button" className="quiet-button" onClick={onRetry} disabled={retrying}>
          {retrying ? "در حال تلاش…" : "تلاش دوباره برای انتشار"}
        </button>
      ) : null}
    </section>
  );
}
