# Product

<!-- impeccable:product-schema 1 -->

## Platform and users

وب‌سایت فارسی و راست‌به‌چپ ال کافه برای موبایل. مخاطب اصلی مشتری نشسته پشت
میز است که QR را اسکن می‌کند، لندینگ را می‌بیند و سریع وارد `/menu` می‌شود.
مقایسه‌ی آیتم و قیمت بر جلوه‌ی بصری اولویت دارد؛ سفارش، سبد خرید، رزرو و پرداخت
در دامنه‌ی این محصول نیست.

لندینگ اکنون در هدر لینک مستقیم منو دارد و در بخش پایانی نیز لینک منو، نشانی،
ساعت ۷ تا ۲۳، تلفن، اینستاگرام و مسیر نقشه را نمایش می‌دهد. ادعای قدیمیِ نبودن
ساعت/نقشه یا تنها بودن CTA پایین صفحه دیگر معتبر نیست.

## Production architecture

- دامنه‌ی اصلی `https://l-cafe.ir` روی هاست لینوکس اشتراکی پارس‌پک است.
- رابط عمومی React + Vite است و برای اجرا در production به Node نیاز ندارد.
- `/admin/` یک bundle مستقل React است و `/api` با PHP 8.1+/MySQL اجرا می‌شود.
- MySQL منبع حقیقت قابل‌ویرایش منو است. API انتشار، snapshotهای پایدار
  `managed-menu/current.json` و `previous.json` را می‌سازد و صفحه‌ی عمومی فقط
  آن‌ها را می‌خواند.
- `managed-media/`، snapshotها، دیتابیس، config خصوصی، sessionها، آرشیو revision
  و اصل تصاویر state پایدارند و متعلق به release کد نیستند.
- `menu.json` فقط ورودی migration/reference و
  `src/menu/fixtures/current.json` فقط fixture توسعه/preview است؛ هیچ‌کدام منبع
  حقیقت production نیستند.

جزئیات میزبانی و وضعیت زنده در `OPERATIONS.md` و فعال‌سازی اولیه‌ی backend در
`server/HOST-ACTIVATION.md` نگه‌داری می‌شود.

## Public behavior

- `/` لندینگ و `/menu` آدرس canonical منو است؛ `menu.html` جزئیات داخلی build.
- مشتری فقط اطلاعات را می‌بیند. variantهای چندقیمتی ردیف اطلاعاتی‌اند و state
  انتخاب ندارند.
- قیمت به‌صورت عدد فارسی بدون واحد و جداکننده نمایش داده می‌شود؛ «تومان» یا
  واحد دیگری اضافه نشود.
- داده‌ی خالی یا تأییدنشده حدس زده نمی‌شود.
- accessibility موجود شامل RTL، لینک پرش، focus نمایان و
  `prefers-reduced-motion` باید حفظ شود.

## Source and release ownership

- رابط: `src/landing/`, `src/menu/`, `src/admin/` و stylesheetهای `src/styles/`.
- backend: `server/app/`, `server/public/api/`, migrationها و ابزارهای `server/bin/`.
- `index.html`, `menu.html` و `admin/index.html` فقط entryهای سبک Vite هستند.
- `dist/` خروجی disposable محلی است و هرگز release تأییدشده یا deployable نیست.
- فقط `release/current/` که از یک commit کاملِ push‌شده و صریحاً تأییدشده ساخته
  شده، ورودی `package.py` و `deploy.py` است.
- تغییر منوی production از پنل مدیریت و publish انجام می‌شود، نه با build یا
  deploy کد.

## Content and brand constraints

- نام: ال کافه / L Cafe؛ ارزش‌های اعلام‌شده: احترام، سلامت، کیفیت.
- رنگ‌های تثبیت‌شده: زرشکی `#471019` و کرم `#F3F1EC`.
- فونت‌ها: Vazirmatn برای متن و Sahel Bold فقط با وزن ۷۰۰ برای تیتر.
- تلفن: `09130005767` / `+989130005767`؛ اینستاگرام: `@lcafe.esf`.
- نشانی: خیابان چهارباغ بالا، نبش کوچه یحیی خان، مجتمع متروپل.
- هیچ نظر مشتری، امتیاز، جایزه، تعداد شعبه یا ادعای تأییدنشده‌ای ساخته نشود.

## Product principles

1. مسیر QR تا منو کوتاه و موبایل‌محور بماند.
2. قیمت بدون واحد بماند.
3. محتوای تأییدنشده اختراع نشود.
4. source درست ویرایش شود؛ `dist/`، release و state زنده دستی ویرایش نشوند.
5. متن بدون JavaScript، WebGL یا animation قابل مشاهده و استفاده بماند.
