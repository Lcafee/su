import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  getMenuDocument,
  getPublishStatus,
  getSession,
  loginSession,
  logoutSession,
  retryPublish,
  saveMenuDocument,
  uploadMenuMedia,
} from "./api";
import {
  cloneDocument,
  createCategory,
  documentCounts,
  editableSignature,
  firstDocumentIssue,
  moveCategory,
  moveCategoryByOffset,
  moveItem,
  normalizeDocument,
  toSavePayload,
  updateCategory,
  updateItem,
} from "./document";
import { LoginForm } from "./components/LoginForm";
import { MenuEditor } from "./components/MenuEditor";
import { PublishPanel } from "./components/PublishPanel";

function messageForError(error) {
  const messages = {
    invalid_credentials: "نام کاربری یا رمز عبور درست نیست.",
    authentication_required: "نشست شما پایان یافته است. دوباره وارد شوید.",
    csrf_rejected: "نشست امن منقضی شده است. دوباره وارد شوید.",
    origin_rejected: "این درخواست از نشانی مجاز ارسال نشده است.",
    database_unavailable: "پایگاه داده موقتاً در دسترس نیست.",
    configuration_unavailable: "تنظیمات سرویس مدیریت هنوز کامل نشده است.",
    storage_unavailable: "فضای ذخیره‌سازی موقتاً در دسترس نیست.",
    upload_too_large: "حجم تصویر بیشتر از حد مجاز است.",
    image_dimensions_too_large: "ابعاد تصویر بیشتر از حد مجاز است.",
    unsupported_media: "فقط تصویر JPEG، PNG یا WebP قابل استفاده است.",
    upload_failed: "بارگذاری تصویر کامل نشد. دوباره تلاش کنید.",
    validation_error: "بعضی فیلدها کامل یا معتبر نیستند.",
  };
  return messages[error?.type] || "انجام درخواست ممکن نشد. دوباره تلاش کنید.";
}

async function fetchEditorData() {
  const [menu, publishStatus] = await Promise.all([
    getMenuDocument(),
    getPublishStatus(),
  ]);
  return { menu: normalizeDocument(menu), publishStatus };
}

function LoadingScreen() {
  return (
    <main className="system-page" aria-busy="true">
      <div className="loading-mark" aria-hidden="true">L</div>
      <p>در حال آماده‌سازی مدیریت منو…</p>
    </main>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <main className="system-page">
      <div className="system-card">
        <h1>مدیریت منو در دسترس نیست</h1>
        <p>{message}</p>
        <button type="button" className="primary-button" onClick={onRetry}>تلاش دوباره</button>
      </div>
    </main>
  );
}

export function AdminApp() {
  const started = useRef(false);
  const [phase, setPhase] = useState("loading");
  const [systemError, setSystemError] = useState("");
  const [session, setSession] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [savedDocument, setSavedDocument] = useState(null);
  const [draft, setDraft] = useState(null);
  const [publishStatus, setPublishStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [uploadingIds, setUploadingIds] = useState(() => new Set());
  const [notice, setNotice] = useState(null);
  const [conflict, setConflict] = useState(null);

  const applyEditorData = useCallback(({ menu, publishStatus: nextStatus }) => {
    setSavedDocument(cloneDocument(menu));
    setDraft(cloneDocument(menu));
    setPublishStatus(nextStatus);
    setConflict(null);
    setNotice(null);
  }, []);

  const initialize = useCallback(async () => {
    setPhase("loading");
    setSystemError("");
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      if (nextSession.authenticated) {
        applyEditorData(await fetchEditorData());
      }
      setPhase("ready");
    } catch (error) {
      setSystemError(messageForError(error));
      setPhase("error");
    }
  }, [applyEditorData]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    initialize();
  }, [initialize]);

  const hasUnsavedChanges = useMemo(() => {
    if (!draft || !savedDocument) return false;
    return editableSignature(draft) !== editableSignature(savedDocument);
  }, [draft, savedDocument]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    function warnBeforeLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const categoryChoiceSignature = draft
    ? draft.categories.map((category) => `${category.id}:${category.title}:${category.archived}`).join("|")
    : "";
  const categoryChoices = useMemo(
    () => draft?.categories.map(({ id, title, archived }) => ({ id, title, archived })) || [],
    [categoryChoiceSignature],
  );
  const counts = useMemo(() => (draft ? documentCounts(draft) : null), [draft]);
  const uploadInProgress = uploadingIds.size > 0;
  const editorDisabled = saving || uploadInProgress || conflict !== null;

  const handleSessionExpiry = useCallback((error) => {
    if (!(error instanceof ApiError) || error.status !== 401) return false;
    setSession({ authenticated: false });
    setSavedDocument(null);
    setDraft(null);
    setPublishStatus(null);
    setLoginError("نشست شما پایان یافته است. دوباره وارد شوید.");
    return true;
  }, []);

  const handleLogin = useCallback(async (username, password) => {
    setLoginBusy(true);
    setLoginError("");
    try {
      const nextSession = await loginSession(username, password);
      const editorData = await fetchEditorData();
      setSession(nextSession);
      applyEditorData(editorData);
    } catch (error) {
      setLoginError(messageForError(error));
    } finally {
      setLoginBusy(false);
    }
  }, [applyEditorData]);

  const mutateDraft = useCallback((updater) => {
    setDraft((current) => updater(current));
    setNotice(null);
  }, []);

  const handleUpdateCategory = useCallback((categoryId, patch) => {
    mutateDraft((current) => updateCategory(current, categoryId, patch));
  }, [mutateDraft]);

  const handleUpdateItem = useCallback((categoryId, itemId, patch) => {
    mutateDraft((current) => updateItem(current, categoryId, itemId, patch));
  }, [mutateDraft]);

  const handleMoveCategory = useCallback((categoryId, overCategoryId) => {
    mutateDraft((current) => moveCategory(current, categoryId, overCategoryId));
  }, [mutateDraft]);

  const handleMoveCategoryByOffset = useCallback((categoryId, offset) => {
    mutateDraft((current) => moveCategoryByOffset(current, categoryId, offset));
  }, [mutateDraft]);

  const handleMoveItem = useCallback((itemId, targetCategoryId, overItemId = null) => {
    mutateDraft((current) => moveItem(current, itemId, targetCategoryId, overItemId));
  }, [mutateDraft]);

  const handleCreateCategory = useCallback(() => {
    mutateDraft((current) => createCategory(current).document);
  }, [mutateDraft]);

  const handleUpload = useCallback(async (categoryId, itemId, file) => {
    setUploadingIds((current) => new Set(current).add(itemId));
    setNotice(null);
    try {
      const response = await uploadMenuMedia(session.csrfToken, file);
      setDraft((current) => updateItem(current, categoryId, itemId, {
        mediaId: response.media.id,
        media: response.media,
      }));
      setNotice({ tone: "success", message: "تصویر آماده است. برای اعمال در منوی عمومی، ذخیره را بزنید." });
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({ tone: "error", message: messageForError(error) });
      }
    } finally {
      setUploadingIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    }
  }, [handleSessionExpiry, session]);

  const handleDiscard = useCallback(() => {
    if (!savedDocument) return;
    setDraft(cloneDocument(savedDocument));
    setConflict(null);
    setNotice({ tone: "neutral", message: "تغییرات ذخیره‌نشده پاک شد." });
  }, [savedDocument]);

  const handleSave = useCallback(async () => {
    if (!draft || !hasUnsavedChanges || uploadInProgress) return;
    const documentIssue = firstDocumentIssue(draft);
    if (documentIssue) {
      setNotice({ tone: "error", message: documentIssue });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const result = await saveMenuDocument(session.csrfToken, toSavePayload(draft));
      const nextDocument = {
        ...draft,
        revision: result.revision,
        publishedRevision: result.published ? result.revision : draft.publishedRevision,
      };
      setDraft(nextDocument);
      setSavedDocument(cloneDocument(nextDocument));
      setConflict(null);
      setPublishStatus({
        editRevision: result.revision,
        publishedRevision: result.published ? result.revision : draft.publishedRevision,
        state: result.publishState,
        error: result.published ? null : "نسخه قبلی منوی عمومی همچنان فعال است.",
      });
      setNotice({
        tone: result.published ? "success" : "pending",
        message: result.published
          ? "تغییرات ذخیره و در منوی عمومی منتشر شد."
          : "تغییرات ذخیره شد، اما انتشار نیاز به تلاش دوباره دارد.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict({ currentRevision: error.details.currentRevision });
      } else if (!handleSessionExpiry(error)) {
        setNotice({ tone: "error", message: messageForError(error) });
      }
    } finally {
      setSaving(false);
    }
  }, [draft, handleSessionExpiry, hasUnsavedChanges, session, uploadInProgress]);

  const handleReloadAfterConflict = useCallback(async () => {
    setSaving(true);
    try {
      applyEditorData(await fetchEditorData());
      setNotice({ tone: "neutral", message: "جدیدترین نسخه منو بارگذاری شد." });
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({ tone: "error", message: messageForError(error) });
      }
    } finally {
      setSaving(false);
    }
  }, [applyEditorData, handleSessionExpiry]);

  const handleRetryPublish = useCallback(async () => {
    setRetrying(true);
    try {
      const status = await retryPublish(session.csrfToken);
      setPublishStatus(status);
      setNotice({
        tone: status.state === "published" ? "success" : "pending",
        message: status.state === "published"
          ? "منوی عمومی با موفقیت منتشر شد."
          : "انتشار هنوز کامل نشده است.",
      });
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({ tone: "error", message: messageForError(error) });
      }
    } finally {
      setRetrying(false);
    }
  }, [handleSessionExpiry, session]);

  const handleLogout = useCallback(async () => {
    if (hasUnsavedChanges && !window.confirm("تغییرات ذخیره‌نشده پاک می‌شود. خارج می‌شوید؟")) return;
    try {
      await logoutSession(session.csrfToken);
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({ tone: "error", message: messageForError(error) });
        return;
      }
    }
    setSession({ authenticated: false });
    setSavedDocument(null);
    setDraft(null);
    setPublishStatus(null);
  }, [handleSessionExpiry, hasUnsavedChanges, session]);

  if (phase === "loading") return <LoadingScreen />;
  if (phase === "error") return <ErrorScreen message={systemError} onRetry={initialize} />;
  if (!session?.authenticated) {
    return <LoginForm busy={loginBusy} error={loginError} onLogin={handleLogin} />;
  }
  if (!draft || !savedDocument) return <LoadingScreen />;

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark small" aria-hidden="true">L</div>
          <div>
            <p className="eyebrow">ال کافه</p>
            <h1>مدیریت منو</h1>
          </div>
        </div>
        <div className="operator-actions">
          <span>{session.user.username}</span>
          <button type="button" className="quiet-button" onClick={handleLogout}>خروج</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="overview" aria-label="خلاصه منو">
          <div><strong>{counts.categories}</strong><span>دسته‌بندی</span></div>
          <div><strong>{counts.activeItems}</strong><span>آیتم فعال</span></div>
          <div><strong>{counts.archivedItems}</strong><span>آیتم آرشیوی</span></div>
          <div><strong>{draft.revision}</strong><span>نسخه ویرایش</span></div>
        </section>

        <PublishPanel status={publishStatus} retrying={retrying} onRetry={handleRetryPublish} />

        {notice ? (
          <p className={`notice tone-${notice.tone}`} role="status">{notice.message}</p>
        ) : null}

        {conflict ? (
          <section className="conflict-panel" role="alert">
            <div>
              <strong>نسخه جدیدتری از منو ذخیره شده است</strong>
              <p>برای جلوگیری از پاک شدن تغییرات جدید، ذخیره متوقف شد. تغییرات فعلی شما تا زمان بارگذاری مجدد روی صفحه می‌ماند.</p>
            </div>
            <button type="button" className="primary-button" onClick={handleReloadAfterConflict} disabled={saving}>
              بارگذاری نسخه جدید و کنار گذاشتن تغییرات من
            </button>
          </section>
        ) : null}

        <MenuEditor
          document={draft}
          categoryChoices={categoryChoices}
          uploadingIds={uploadingIds}
          disabled={editorDisabled}
          onUpdateCategory={handleUpdateCategory}
          onUpdateItem={handleUpdateItem}
          onMoveCategory={handleMoveCategory}
          onMoveCategoryByOffset={handleMoveCategoryByOffset}
          onMoveItem={handleMoveItem}
          onUpload={handleUpload}
          onCreateCategory={handleCreateCategory}
        />
      </main>

      <footer className="save-bar">
        <div className="save-state">
          <span className={`dirty-dot${hasUnsavedChanges ? " is-dirty" : ""}`} aria-hidden="true" />
          <span>{hasUnsavedChanges ? "تغییرات ذخیره‌نشده دارید" : "همه تغییرات ذخیره شده‌اند"}</span>
        </div>
        <div className="save-actions">
          <button
            type="button"
            className="quiet-button"
            onClick={handleDiscard}
            disabled={!hasUnsavedChanges || saving || uploadInProgress || conflict !== null}
          >
            پاک کردن تغییرات
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving || uploadInProgress || conflict !== null}
          >
            {saving ? "در حال ذخیره…" : uploadInProgress ? "منتظر بارگذاری تصویر…" : "ذخیره و انتشار"}
          </button>
        </div>
      </footer>
    </div>
  );
}
