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
  createItem,
  documentChangeCount,
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
import {
  clearMenuEditorViewState,
  menuEditorViewStorageKey,
  MenuEditor,
} from "./components/MenuEditor";
import { PublishPanel } from "./components/PublishPanel";

const faNumber = new Intl.NumberFormat("fa-IR");

function numericRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision > 0 ? revision : 0;
}

function publicationStateText(status, editRevision, publishedRevision, isOwner) {
  if (status?.state === "published_status_pending") {
    return isOwner
      ? "فایل عمومی برای مشتریان به‌روز شده است؛ ثبت وضعیت انتشار را از بخش بالا بازیابی کنید."
      : "فایل عمومی برای مشتریان به‌روز شده است؛ مالک باید ثبت وضعیت انتشار را بازیابی کند.";
  }
  if (
    status?.state === "failed"
    || status?.state === "pending"
    || publishedRevision < editRevision
  ) {
    const audienceState = publishedRevision
      ? `مشتریان فعلاً نسخه عمومی ${faNumber.format(publishedRevision)} را می‌بینند.`
      : "هنوز نسخه عمومی برای مشتریان وجود ندارد.";
    const recovery = isOwner
      ? "بازیابی انتشار از بخش وضعیت انتشار در دسترس است."
      : "برای بازیابی انتشار، وضعیت را به مالک اطلاع دهید.";
    return `${audienceState} ${recovery}`;
  }
  if (status?.state === "not_published" || !publishedRevision) {
    return "هنوز نسخه عمومی برای مشتریان ساخته نشده است.";
  }
  return `مشتریان نسخه عمومی ${faNumber.format(publishedRevision)} را می‌بینند؛ نسخه ذخیره‌شده و عمومی هماهنگ‌اند.`;
}

function saveStatePresentation({
  draft,
  publishStatus,
  hasUnsavedChanges,
  changeCount,
  isOwner,
}) {
  const editRevision = numericRevision(publishStatus?.editRevision ?? draft?.revision);
  const publishedRevision = numericRevision(
    publishStatus?.publishedRevision ?? draft?.publishedRevision,
  );
  const publicationText = publicationStateText(
    publishStatus,
    editRevision,
    publishedRevision,
    isOwner,
  );

  if (hasUnsavedChanges) {
    return {
      tone: "dirty",
      title: `${faNumber.format(changeCount)} بخش فقط روی این صفحه تغییر کرده و هنوز در MySQL ذخیره نشده است.`,
      detail: `آخرین ویرایش ذخیره‌شده نسخه ${faNumber.format(editRevision)} است. ${publicationText}`,
    };
  }
  if (publishStatus?.state === "failed") {
    return {
      tone: "error",
      title: `ویرایش نسخه ${faNumber.format(editRevision)} در MySQL ذخیره شده است.`,
      detail: publicationText,
    };
  }
  if (
    publishStatus?.state === "pending"
    || publishStatus?.state === "published_status_pending"
    || publishedRevision < editRevision
  ) {
    return {
      tone: "pending",
      title: `ویرایش نسخه ${faNumber.format(editRevision)} در MySQL ذخیره شده است.`,
      detail: publicationText,
    };
  }
  return {
    tone: "saved",
    title: `ویرایش نسخه ${faNumber.format(editRevision)} در MySQL ذخیره شده است.`,
    detail: publicationText,
  };
}

function saveResultNotice(result, isOwner) {
  const revision = faNumber.format(result.revision);
  if (result.publishState === "published_status_pending") {
    return {
      tone: "pending",
      message: isOwner
        ? `ویرایش نسخه ${revision} در MySQL ذخیره و فایل عمومی به‌روز شد؛ ثبت وضعیت انتشار را از بخش بالا بازیابی کنید.`
        : `ویرایش نسخه ${revision} در MySQL ذخیره و فایل عمومی به‌روز شد؛ مالک باید ثبت وضعیت انتشار را بازیابی کند.`,
    };
  }
  if (result.published && result.publishState === "published") {
    return {
      tone: "success",
      message: `ویرایش نسخه ${revision} در MySQL ذخیره و در منوی عمومی منتشر شد.`,
    };
  }
  return {
    tone: result.publishState === "failed" ? "error" : "pending",
    message: isOwner
      ? `ویرایش نسخه ${revision} در MySQL ذخیره شد؛ منوی عمومی به‌روز نشد و از بخش وضعیت انتشار قابل بازیابی است.`
      : `ویرایش نسخه ${revision} در MySQL ذخیره شد؛ منوی عمومی به‌روز نشد و مالک باید انتشار را بازیابی کند.`,
  };
}

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
    permission_denied: "این بخش فقط در دسترس مالک است.",
    immutable_identifier: "شناسه‌های ثابت منو قابل تغییر نیستند.",
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
  const [undoState, setUndoState] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);

  const applyEditorData = useCallback(({ menu, publishStatus: nextStatus }) => {
    setSavedDocument(cloneDocument(menu));
    setDraft(cloneDocument(menu));
    setPublishStatus(nextStatus);
    setConflict(null);
    setNotice(null);
    setUndoState(null);
    setFocusTarget(null);
  }, []);

  const initialize = useCallback(async () => {
    setPhase("loading");
    setSystemError("");
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      if (nextSession.authenticated) {
        applyEditorData(await fetchEditorData());
      } else {
        clearMenuEditorViewState();
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
  const changeCount = useMemo(
    () => documentChangeCount(draft, savedDocument),
    [draft, savedDocument],
  );
  const uploadInProgress = uploadingIds.size > 0;
  const editorDisabled = saving || conflict !== null;
  const isOwner = session?.user?.role === "owner";
  const menuEditorStorageKey = menuEditorViewStorageKey(session?.user);
  const savePresentation = saveStatePresentation({
    draft,
    publishStatus,
    hasUnsavedChanges,
    changeCount,
    isOwner,
  });

  const handleSessionExpiry = useCallback((error) => {
    if (!(error instanceof ApiError) || error.status !== 401) return false;
    clearMenuEditorViewState(menuEditorStorageKey);
    setSession({ authenticated: false });
    setSavedDocument(null);
    setDraft(null);
    setPublishStatus(null);
    setLoginError("نشست شما پایان یافته است. دوباره وارد شوید.");
    return true;
  }, [menuEditorStorageKey]);

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
    setUndoState(null);
  }, []);

  const handleUpdateCategory = useCallback((categoryId, patch) => {
    if (Object.prototype.hasOwnProperty.call(patch, "archived") && draft) {
      const category = draft.categories.find((candidate) => candidate.id === categoryId);
      if (!category) return;
      const activeItemCount = category.items.filter((item) => !item.archived).length;
      if (
        patch.archived
        && activeItemCount > 0
        && !window.confirm(`با آرشیو این دسته، ${new Intl.NumberFormat("fa-IR").format(activeItemCount)} آیتم فعال از منوی عمومی پنهان می‌شود. ادامه می‌دهید؟`)
      ) {
        return;
      }
      setUndoState({
        document: cloneDocument(draft),
        message: patch.archived ? `دسته «${category.title}» آرشیو شد.` : `دسته «${category.title}» بازگردانده شد.`,
      });
      setDraft(updateCategory(draft, categoryId, patch));
      setNotice(null);
      return;
    }
    mutateDraft((current) => updateCategory(current, categoryId, patch));
  }, [draft, mutateDraft]);

  const handleUpdateItem = useCallback((categoryId, itemId, patch) => {
    if (Object.prototype.hasOwnProperty.call(patch, "archived") && draft) {
      const category = draft.categories.find((candidate) => candidate.id === categoryId);
      const item = category?.items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      setUndoState({
        document: cloneDocument(draft),
        message: patch.archived ? `آیتم «${item.name}» آرشیو شد.` : `آیتم «${item.name}» بازگردانده شد.`,
      });
      setDraft(updateItem(draft, categoryId, itemId, patch));
      setNotice(null);
      return;
    }
    mutateDraft((current) => updateItem(current, categoryId, itemId, patch));
  }, [draft, mutateDraft]);

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
    if (!draft) return;
    const result = createCategory(draft);
    setDraft(result.document);
    setFocusTarget({ type: "category", id: result.categoryId });
    setNotice(null);
    setUndoState(null);
  }, [draft]);

  const handleCreateItem = useCallback((categoryId) => {
    if (!draft) return;
    const result = createItem(draft, categoryId);
    setDraft(result.document);
    setFocusTarget({ type: "item", id: result.itemId, categoryId });
    setNotice(null);
    setUndoState(null);
  }, [draft]);

  const handleUpload = useCallback(async (categoryId, itemId, file) => {
    setUploadingIds((current) => new Set(current).add(itemId));
    setNotice(null);
    try {
      const response = await uploadMenuMedia(session.csrfToken, file);
      setDraft((current) => updateItem(current, categoryId, itemId, {
        mediaId: response.media.id,
        media: response.media,
      }));
      setNotice({
        tone: "success",
        message: "تصویر آماده است. برای ذخیره در MySQL و اعمال در منوی عمومی، ذخیره و انتشار را بزنید.",
      });
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
    if (!window.confirm(`همه ${new Intl.NumberFormat("fa-IR").format(changeCount)} تغییر ذخیره‌نشده پاک شود؟`)) return;
    setDraft(cloneDocument(savedDocument));
    setConflict(null);
    setUndoState(null);
    setFocusTarget(null);
    setNotice({ tone: "neutral", message: "تغییرات ذخیره‌نشده پاک شد." });
  }, [changeCount, savedDocument]);

  const handleUndo = useCallback(() => {
    if (!undoState) return;
    setDraft(cloneDocument(undoState.document));
    setUndoState(null);
    setNotice({ tone: "neutral", message: "آخرین تغییر برگردانده شد." });
  }, [undoState]);

  const handleSave = useCallback(async () => {
    if (!draft || !hasUnsavedChanges) return;
    if (uploadInProgress) {
      setNotice({ tone: "pending", message: "پس از پایان بارگذاری تصویرها می‌توانید ذخیره کنید." });
      return;
    }
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
      setUndoState(null);
      setPublishStatus({
        editRevision: result.revision,
        publishedRevision: result.published ? result.revision : draft.publishedRevision,
        state: result.publishState,
        error: result.published ? null : "نسخه قبلی منوی عمومی همچنان فعال است.",
      });
      setNotice(saveResultNotice(result, isOwner));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict({ currentRevision: error.details.currentRevision });
      } else if (!handleSessionExpiry(error)) {
        setNotice({ tone: "error", message: messageForError(error) });
      }
    } finally {
      setSaving(false);
    }
  }, [draft, handleSessionExpiry, hasUnsavedChanges, isOwner, session, uploadInProgress]);

  useEffect(() => {
    function handleSaveShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      handleSave();
    }
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [handleSave]);

  const handleReloadAfterConflict = useCallback(async () => {
    if (!window.confirm("نسخه جدید بارگذاری شود؟ تغییرات فعلی شما از صفحه کنار گذاشته می‌شود؛ در صورت نیاز ابتدا نسخه خود را دانلود کنید.")) return;
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

  const handleDownloadConflictDraft = useCallback(() => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(toSavePayload(draft), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `l-cafe-menu-local-revision-${draft.revision}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ tone: "neutral", message: "یک نسخه از تغییرات فعلی شما دانلود شد." });
  }, [draft]);

  const handleRetryPublish = useCallback(async () => {
    setRetrying(true);
    try {
      const status = await retryPublish(session.csrfToken);
      setPublishStatus(status);
      setNotice({
        tone: status.state === "published" ? "success" : "pending",
        message: status.state === "published"
          ? "نسخه ذخیره‌شده و منوی عمومی مشتریان دوباره هماهنگ شدند."
          : "بازیابی انتشار هنوز کامل نشده است؛ وضعیت نسخه عمومی در بخش بالا نمایش داده می‌شود.",
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
    clearMenuEditorViewState(menuEditorStorageKey);
    setSession({ authenticated: false });
    setSavedDocument(null);
    setDraft(null);
    setPublishStatus(null);
  }, [handleSessionExpiry, hasUnsavedChanges, menuEditorStorageKey, session]);

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
            <h1>مدیریت منو</h1>
          </div>
        </div>
        <div className="operator-actions">
          <span>{session.user.username} · {isOwner ? "مالک" : "صندوق‌دار"}</span>
          <button type="button" className="quiet-button" onClick={handleLogout}>خروج</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="owner-workspace role-workspace" aria-labelledby="role-workspace-title">
          <div className="owner-workspace-heading">
            <div>
              <h2 id="role-workspace-title">{isOwner ? "کنترل مالک" : "کار روزانه صندوق‌دار"}</h2>
              <p>
                {isOwner
                  ? "ویرایش کامل منو، تنظیمات پیشرفته و بازیابی انتشار در دسترس مالک است."
                  : "عملیات روزانه منو و ذخیره و انتشار در دسترس است؛ تنظیمات پیشرفته و بازیابی انتشار فقط با مالک انجام می‌شود."}
              </p>
            </div>
            <span className="role-chip">{isOwner ? "دسترسی کامل" : "عملیات روزانه"}</span>
          </div>
          {isOwner ? (
            <section className="overview" aria-label="خلاصه منو">
              <div><strong>{counts.categories}</strong><span>دسته‌بندی</span></div>
              <div><strong>{counts.activeItems}</strong><span>آیتم فعال</span></div>
              <div><strong>{counts.archivedItems}</strong><span>آیتم آرشیوی</span></div>
              <div><strong>{draft.revision}</strong><span>نسخه ویرایش</span></div>
            </section>
          ) : null}

          <PublishPanel
            status={publishStatus}
            retrying={retrying}
            onRetry={handleRetryPublish}
            canRetry={isOwner}
          />
        </section>

        {notice ? (
          <p className={`notice tone-${notice.tone}`} role="status">{notice.message}</p>
        ) : null}

        {undoState ? (
          <section className="undo-panel" role="status">
            <span>{undoState.message}</span>
            <button type="button" className="quiet-button" onClick={handleUndo}>واگردانی</button>
          </section>
        ) : null}

        {conflict ? (
          <section className="conflict-panel" role="alert">
            <div>
              <strong>نسخه جدیدتری از منو ذخیره شده است</strong>
              <p>ذخیره متوقف شد و تغییرات شما روی همین صفحه حفظ شده است. پیش از بارگذاری نسخه جدید می‌توانید یک نسخه از کار خود دانلود کنید.</p>
            </div>
            <div className="conflict-actions">
              <button type="button" className="quiet-button" onClick={handleDownloadConflictDraft} disabled={saving}>
                دانلود تغییرات من
              </button>
              <button type="button" className="primary-button" onClick={handleReloadAfterConflict} disabled={saving}>
                بارگذاری نسخه جدید
              </button>
            </div>
          </section>
        ) : null}

        <MenuEditor
          key={menuEditorStorageKey}
          document={draft}
          categoryChoices={categoryChoices}
          uploadingIds={uploadingIds}
          disabled={editorDisabled}
          advanced={isOwner}
          storageKey={menuEditorStorageKey}
          focusTarget={focusTarget}
          onUpdateCategory={handleUpdateCategory}
          onUpdateItem={handleUpdateItem}
          onMoveCategory={handleMoveCategory}
          onMoveCategoryByOffset={handleMoveCategoryByOffset}
          onMoveItem={handleMoveItem}
          onUpload={handleUpload}
          onCreateCategory={handleCreateCategory}
          onCreateItem={handleCreateItem}
        />
      </main>

      <footer className="save-bar">
        <div className="save-state">
          <span className={`dirty-dot is-${savePresentation.tone}`} aria-hidden="true" />
          <span className="save-state-copy">
            <strong>{savePresentation.title}</strong>
            <span>{savePresentation.detail}</span>
          </span>
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
            title="ذخیره و انتشار (Ctrl+S)"
          >
            {saving
              ? "در حال ذخیره و انتشار…"
              : uploadInProgress
                ? `در حال بارگذاری ${faNumber.format(uploadingIds.size)} تصویر…`
                : "ذخیره و انتشار"}
          </button>
        </div>
      </footer>
    </div>
  );
}
