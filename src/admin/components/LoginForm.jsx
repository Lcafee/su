import { BrandMark } from "./BrandMark";

export function LoginForm({ busy, error, onLogin }) {
  function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const fields = new FormData(event.currentTarget);
    onLogin(fields.get("username").trim(), fields.get("password"));
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <BrandMark />
        <h1 id="login-title">مدیریت منو</h1>
        <p className="login-copy">برای ویرایش منو وارد شوید.</p>

        <form id="admin-login" method="post" onSubmit={handleSubmit} className="login-form">
          <label>
            <span>نام کاربری</span>
            <input
              dir="ltr"
              id="admin-username"
              type="text"
              name="username"
              autoComplete="username"
              disabled={busy}
              required
              autoFocus
            />
          </label>
          <label>
            <span>رمز عبور</span>
            <input
              dir="ltr"
              id="current-password"
              type="password"
              name="password"
              autoComplete="current-password"
              disabled={busy}
              required
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button login-button" type="submit" disabled={busy}>
            {busy ? "در حال ورود…" : "ورود"}
          </button>
        </form>
      </section>
    </main>
  );
}
