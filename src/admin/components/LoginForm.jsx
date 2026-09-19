import { useState } from "react";

export function LoginForm({ busy, error, onLogin }) {
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onLogin(password);
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">L</div>
        <p className="eyebrow">ال کافه</p>
        <h1 id="login-title">مدیریت منو</h1>
        <p className="login-copy">برای ویرایش منو وارد شوید.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>رمز عبور</span>
            <input
              dir="ltr"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
              autoFocus
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
