# L Cafe site — handoff briefing

You are taking over an in-progress project. You have full read/write access to
the folder `C:\Users\amris\OneDrive\Desktop\Site` on this Windows machine. Read
this whole file before touching anything.

---

## 1. What this is

A two-page static site for **ال کافه / L Cafe**, a cafe in Esfahan, Iran.
Persian, RTL, mobile-first. Live at `https://lcafe-esf.ir` on ParsPack shared
Linux hosting. Git remote: `https://github.com/Lcafee/su.git`.

The real user journey is narrow and confirmed: a customer **already sitting at a
table** scans a QR code, lands on the landing page, taps "مشاهده منو", reads the
menu on their phone over mobile data. That is the whole product. There is no
ordering, no cart, no reservation, no payment — and none of those are to be
built.

State as of handoff: working tree clean, `HEAD` at `b2c467e`, everything pushed
to `origin/main`.

---

## 2. Read these first, in this order

| File | What it holds |
| --- | --- |
| `README.md` | Build and deploy commands. Short. |
| `PRODUCT.md` | Product decisions, audience, brand commitments. Persian. **Has stale claims — see §6.** |
| `DESIGN.md` | Full design-token spec: colors, type scale, spacing, components. |
| `build.py` | The build. Its docstrings are the real architecture documentation. |

The Python scripts in this repo carry unusually detailed docstrings that explain
*why* each decision was made, often with measured numbers. Read them before
changing the code they describe. They are not decoration — several record
failures that already shipped once.

---

## 3. How the build works

The `.dc.html` files are the **source of truth**. They are written and read by a
design-canvas tool ("dc-runtime" / omelette) that uses custom elements
`<x-dc>`, `<helmet>` and `<image-slot>`.

```
Landing Hero Background.dc.html  --build.py-->  index.html
Menu.dc.html + menu.json         --build.py-->  menu.html
```

`build.py` does three things on the way out: strips the canvas runtime so pages
paint from their own HTML instead of waiting ~3s for React; hoists `<helmet>`
contents into `<head>`; and rewrites `<image-slot>` into plain `<img>` /
`<picture>`. The published pages ship no framework at all.

**Commands** (run from the project root):

```bash
py build.py
```

```bash
py optimize_images.py
```

```bash
py deploy.py --dry-run
```

- `py build.py` — after any `.dc.html` or `menu.json` edit.
- `py optimize_images.py` — after adding or replacing a photo.
- `py menu_xlsx.py` — regenerates the price spreadsheet from `menu.json`.
- `py package.py` — builds `lcafe-site.zip` for manual cPanel upload.
- `py deploy.py` — FTPS upload, changed files only, never deletes.

`build.py` and `package.py` take their file list from `package.collect()`, so
both publishing paths always ship the same set.

---

## 4. Hard rules — do not violate these

1. **Never hand-edit `index.html` or `menu.html`.** They are generated. Edit the
   `.dc.html` source and rebuild. Both files carry a generated-by banner.
2. **Never hand-edit `support.js` or `image-slot.js`.** The design-canvas tool
   writes them.
3. **Prices are bare Persian numerals with no unit.** Example: `۶۱۰`. This is a
   deliberate owner decision. Do not add "تومان", thousands separators, or a
   unit footnote. The unit (هزار تومان) is stated once elsewhere on the page.
4. **Invent no content.** No reviews, ratings, awards, branch counts, or quality
   claims exist, and none may be fabricated. A missing value stays visibly
   missing so the owner fills it in. `build.py` enforces this in one place: it
   *fails the build* if the landing photo has no `data-alt`, rather than
   silently shipping `alt=""`.
5. **Text never becomes invisible.** Animations arm only after JavaScript is
   ready and have fallback paths. This is a commitment, not an implementation
   detail.
6. **Ask before editing.** The owner wants proposals confirmed before project
   files are changed. State what you intend to change and why, then wait.

**Brand, fixed:** maroon `#471019`, cream `#F3F1EC`. Headings in **Sahel Bold**
— weight 700 is the *only* weight shipped, never request another. Body in
Vazirmatn. Both self-hosted under `assets/fonts/`, OFL licensed.

---

## 5. Traps that will cost you hours

**`python` is broken on this machine.** It is the Windows Store stub. Use `py`.
For a venv, put it in a temp directory, not in the project.

**The console codepage is cp1256.** Printing Persian text from a Python script
raises `UnicodeEncodeError` and fails a run that had otherwise succeeded. This
is why `build.py` prints `len(alt)` instead of the alt text itself. Keep that
pattern.

**Never use PowerShell `Compress-Archive` for the deploy zip.** PowerShell 5.1
writes ZIP entry names with backslashes, which the format forbids. Windows
tolerates its own output so the archive looks fine locally, but cPanel extracts
on Linux where `assets\menu\opt\x.webp` becomes one filename with no
directories. Pages load, every asset 404s. This already shipped once.
`package.py` uses Python `zipfile` and asserts on entry names.

**`<image-slot>` bakes its crop as percentages of the frame**, computed once
from `clientWidth`/`clientHeight`, and never recomputes. Any change to the
container's aspect ratio stretches the photo instead of re-cropping. Do *not*
try to fix this by calling its private `_applyView()` on resize — that was tried
and is too timing-dependent. The working fix, still present in
`Landing Hero Background.dc.html` around line 643, injects a `<style>` into the
slot's `shadowRoot` pinning the image to `object-fit:cover`, scoped
`:host(:not([data-reframe]))` so the tool's crop UI still works. This only
affects the authoring view; the published pages no longer contain image-slots.

**The canvas runtime injects `<helmet>` styles after mount.** Measuring layout
in `componentDidMount` alone pins the scroll end at 1px and the whole scroll
animation finishes in a few pixels. A `ResizeObserver` on `.hero` plus the
`load` event is what makes it correct.

**In RTL, `margin-inline-start` is the *right* side.** The landing photo's inset
is on the right, leaving a strip of background at the reading origin.

**Two menu items share names across categories.** «اپل پارادایس» and «پیچ بلک»
each exist twice — a hot tea in «نوشیدنی گرم» and a different cold drink in
«هربال‌تی», with different prices and descriptions. Matching by item name alone
silently cross-contaminates them. Always key on (category, item).

**`img.l-cafe.ir` cannot be fetched with Python `urllib` here** — the sandbox
proxy presents a certificate that fails validation. Use `curl`.

**`git status` will lie to you about modified files.** `core.autocrlf` is `true`
here, so the checkout writes CRLF while `build.py` writes LF (`newline="\n"`,
deliberately). After `py build.py`, `index.html` and `menu.html` always show as
modified even though the content is byte-identical. Confirm with
`git diff --ignore-cr-at-eol --numstat` — empty output means nothing really
changed. Do not "fix" the build over this; the build is deterministic and its
output matches what is committed. A stale stat cache can also show unrelated
files as modified until the next `git status` refreshes it.

**A hidden browser preview pane freezes timers.** `requestAnimationFrame`,
IntersectionObserver and timers all stop when the pane is not visible, so
"nothing happened" in a background preview proves nothing about the code.

---

## 6. Documentation that is currently WRONG

Verified against the code at handoff time. Do not trust these lines:

1. **`PRODUCT.md` says 13 prices are still `[قیمت]` placeholders.** False.
   `menu.json` now has 14 categories, 96 items, 19 option chips, and **zero**
   empty prices, zero empty descriptions, zero empty category intros. The only
   items without descriptions are the 7 in «افزودنی», which is by design — they
   are modifiers rendered as a plain text list, not products.

2. **`PRODUCT.md` says the host must have PHP and "the site is no longer purely
   static".** False today. There is not one `.php` file in the repo. The admin
   panel it refers to was a decision, not an implementation. The site is fully
   static.

3. **`PRODUCT.md`'s "Operating Context" still says the site is served on GitHub
   Pages.** Superseded further down in the same file: the host is ParsPack, and
   GitHub Pages is the older of the two.

4. **`build.py` line ~41 comment** claims the landing photo "is the only image
   whose frame changes SHAPE between phone and desktop". Stale as of commit
   `b2c467e` — line ~217 of the same file and `optimize_images.py` both state
   the frame now takes the photograph's own 1920×1220 ratio and nothing is
   cropped at any width. The comment survived the change that invalidated it.

If you fix any of these, fix them in the file — do not just note them in chat.

---

## 7. What this folder does and does not contain

This is a full git clone of the project at commit `b2c467e`, plus `.claude/`
copied in by hand. `origin` points at `https://github.com/Lcafee/su.git`, and
the whole commit history came along — the commit messages are written as prose
and are worth reading.

Verified before delivery: `py build.py` runs here and reproduces the committed
`index.html` and `menu.html` byte-for-byte.

**Deliberately excluded — you must not ask for these in chat:**

- **`.deploy.ini` — the host FTP password.** Not in this folder and never in
  the git history (checked). To deploy, copy `.deploy.ini.example` to
  `.deploy.ini` and have the owner fill it in on their own machine. Never print
  it, never paste it into a chat, never commit it. `deploy.py` aborts if git
  starts tracking it.

**Excluded because they are regenerated, not authored:**

- `.deploy-state.json` — hashes of what was last uploaded. Per-machine; a fresh
  copy has uploaded nothing, so the first `py deploy.py` sends the whole set.
- `menu-products.xlsx` — rebuilt from `menu.json` by `py menu_xlsx.py`. Editing
  the spreadsheet does nothing; the route back into the site is `menu.json`, by
  hand. The sheet's own guide tab says so.
- `lcafe-site.zip` — rebuilt by `py package.py`.
- `graphify-out/`, `.thumbnail`, `__pycache__/` — local tooling output.
- `uploads/IMG_7751.jpeg` — a 3.5 MB source photo no page references.

---

## 8. Open work

- **The main known problem:** on a 375×812 phone the "مشاهده منو" button sits
  at y≈1933px — 2.38 viewports down. A customer who scanned a QR to see the menu
  must scroll ~1446px before the only route to it appears. `PRODUCT.md` calls
  this open issue number one. It is a conflict between the landing's design
  ambition and the confirmed user journey, and it has not been resolved.
- **Alt text:** of ~90 image slots, only the landing photo has a real
  accessible name. The menu photos ship `alt=""` deliberately (each sits beside
  an `<h3>` naming the item), so this is a decision on record, not a gap — but
  it should be re-examined if the menu layout ever changes.
- **Confirmed but not yet on the site:** opening hours ۷ to ۲۳ are known and
  usable. A map location exists but no link or coordinates have been supplied.
  More interior photos exist, but the owner explicitly said availability alone
  is not a reason to use them — adding them needs a separate decision.
- **Analytics:** wanted, self-hosted on the same host, so data stays in-country.
  Page views only. Not built.
- **Admin panel:** decided, not built. The design split that makes it possible
  is already in place — `.dc.html` owns how a tile looks, `menu.json` owns what
  it says, and neither writes the other's half.

---

## 9. Working style the owner expects

Propose before you edit. Verify by measurement rather than by reading code and
guessing — this project has a history of wrong alarms raised from grep-and-infer
that measurement then disproved. When you find a rule, write it where it
persists (a docstring, `PRODUCT.md`) rather than patching the single broken
instance. Persian text in terminal output scrambles when ASCII digits,
punctuation or bare Latin words are mixed into an RTL line; keep them on
separate lines or in code fences.
