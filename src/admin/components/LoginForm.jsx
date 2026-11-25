import { BrandMark } from "./BrandMark";
import { browserLoginUrl } from "../api";

export function LoginForm({ error }) {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <BrandMark />
        <h1 id="login-title">مدیریت منو</h1>
        <p className="login-copy">برای ویرایش منو وارد شوید.</p>

        <form id="admin-login" method="post" action={browserLoginUrl} className="login-form">
          <label htmlFor="admin-username">
            <span>نام کاربری</span>
            <input
              dir="ltr"
              id="admin-username"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
            />
          </label>
          <label htmlFor="current-password">
            <span>رمز عبور</span>
            <input
              dir="ltr"
              id="current-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button login-button" type="submit">ورود</button>
        </form>
      </section>
    </main>
  );
}
