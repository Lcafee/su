const faNumber = new Intl.NumberFormat("fa-IR");

function numericRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision > 0 ? revision : 0;
}

function savedRevisionLabel(status) {
  const revision = numericRevision(status?.editRevision);
  return revision ? `نسخه ${faNumber.format(revision)}` : "هنوز ذخیره نشده";
}

function publicRevisionLabel(status) {
  const revision = numericRevision(status?.publishedRevision);
  return revision ? `نسخه ${faNumber.format(revision)}` : "هنوز منتشر نشده";
}

function customerViewMessage(status) {
  const revision = numericRevision(status?.publishedRevision);
  return revision
    ? `مشتریان فعلاً نسخه عمومی ${faNumber.format(revision)} را می‌بینند.`
    : "هنوز نسخه عمومی برای مشتریان ثبت نشده است.";
}

function publishPresentation(status) {
  if (!status) {
    return {
      tone: "neutral",
      title: "وضعیت انتشار",
      message: "در حال دریافت وضعیت نسخه ذخیره‌شده و منوی عمومی…",
      recovery: false,
    };
  }
  if (status.state === "published_status_pending") {
    return {
      tone: "pending",
      title: "منوی عمومی به‌روز شد؛ ثبت وضعیت کامل نیست",
      message: "تغییرات در MySQL ذخیره و فایل عمومی برای مشتریان به‌روز شده است، اما ثبت وضعیت انتشار باید بازیابی شود.",
      recovery: true,
    };
  }
  if (status.state === "failed") {
    return {
      tone: "error",
      title: "تغییرات ذخیره شد؛ منوی عمومی به‌روز نشد",
      message: `${status.error || "انتشار فایل عمومی کامل نشد."} ${customerViewMessage(status)}`,
      recovery: true,
    };
  }
  if (status.state === "not_published") {
    return {
      tone: "neutral",
      title: "هنوز نسخه عمومی وجود ندارد",
      message: numericRevision(status.editRevision)
        ? "ویرایش فعلی در MySQL ذخیره شده است؛ اولین انتشار، نسخه عمومی مشتریان را می‌سازد."
        : "پس از اولین ذخیره و انتشار، نسخه عمومی منو برای مشتریان ساخته می‌شود.",
      recovery: false,
    };
  }
  if (status.state === "pending" || status.publishedRevision < status.editRevision) {
    return {
      tone: "pending",
      title: "تغییرات ذخیره شد؛ انتشار در انتظار است",
      message: `ویرایش جدید در MySQL ذخیره شده است. ${customerViewMessage(status)}`,
      recovery: true,
    };
  }
  return {
    tone: "success",
    title: "نسخه ذخیره‌شده و منوی عمومی هماهنگ‌اند",
    message: `MySQL و منوی عمومی مشتریان هر دو روی نسخه ${faNumber.format(numericRevision(status.publishedRevision))} هستند.`,
    recovery: false,
  };
}

export function PublishPanel({ status, retrying, onRetry, canRetry }) {
  const presentation = publishPresentation(status);
  return (
    <section className={`publish-panel tone-${presentation.tone}`} aria-live="polite">
      <div className="publish-panel-copy">
        <strong>{presentation.title}</strong>
        <p>{presentation.message}</p>
        <dl className="revision-summary" aria-label="نسخه‌های ذخیره و انتشار">
          <div>
            <dt>نسخه ذخیره‌شده در MySQL</dt>
            <dd>{savedRevisionLabel(status)}</dd>
          </div>
          <div>
            <dt>نسخه عمومی ثبت‌شده</dt>
            <dd>{publicRevisionLabel(status)}</dd>
          </div>
        </dl>
        {presentation.recovery && !canRetry ? (
          <p className="cashier-recovery-guidance">
            برای بازیابی انتشار، وضعیت را به مالک اطلاع دهید؛ تلاش دوباره فقط در حساب مالک در دسترس است.
          </p>
        ) : null}
      </div>
      {presentation.recovery && canRetry ? (
        <button type="button" className="quiet-button" onClick={onRetry} disabled={retrying}>
          {retrying ? "در حال تلاش…" : "تلاش دوباره برای انتشار"}
        </button>
      ) : null}
    </section>
  );
}
