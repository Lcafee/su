# Marble Brownie

The public seasonal presentation replaces pumpkin with a transparent PNG
cutout derived from the user's first product photograph on 2026-11-08 using
the built-in Imagegen edit tool. The cutout preserves the brownie/cream subject
and removes the cafe, table and tray. It is saved as
`assets/menu/seasonal/marble-cutout.png` (850 × 774, RGBA; corner alpha 0).
The presentation follows the original live site's pumpkin section: its painted
background, maroon/ivory tokens, Doran type, flat canvas, compact badge and
reversible 360px scroll motion. Mobile promotes the PNG with the original flight
and dock behavior; desktop shows a static introduction. The promoted item is
excluded from the public catalog and its category links; its editable Admin
record is retained. Shared stock context
updates the floating stock label from a single poller. The duplicate stock
lines beneath the product were removed at the user's request. No
separate cream panel, rose palette or large display heading is introduced.
Unconfirmed ingredient/price claims are not added.

The floating label shows the actual confirmed remaining count, not the fixed
daily cap. Its numeral and limited-offer seal use the site's existing Peyda
ExtraBold face for the explicitly requested loud treatment. Zero and unconfirmed
availability replace the numeral with words. Floating labels sit above the PNG
and follow the same scroll fade as the original backdrop.

After a separately authorized code deployment, open Admin and the existing
pumpkin row in Desserts. Choose «آماده‌سازی ماربل براونی», review the approved
description and price presets, adjust today's remaining portions, then save/publish.
Preparation replaces pumpkin price/options/description with the approved Marble
content preset and clears the old managed image.
The existing item ID and external code stay intact; the bundled brownie PNG
is used publicly. Both owner and cashier have the daily controls in Simple.

Approved content preset (`src/menu/marbleContent.mjs`):
«کیک داغ با شکلات بلژیکی، کرم پنیر و گردو؛ با بستنی، خوشمزه‌تر هم می‌شه.»
Variants: «ساده» ۴۵۰ and «همراه با بستنی» ۵۴۰. Public production prices still
come from the saved/published Admin document; this preset never overrides
an already configured item or publishes production data by itself.

«ثبت ۱۰ برش برای امروز» confirms a new batch; it changes the draft until saved
and published. Enter zero when sold out. There is no automatic daily reset or
order-driven decrement. Counts are integers 0–10 and expire at Tehran midnight.
An empty count means unconfirmed, never ten. Other metadata remains role protected.

Visible public pages poll current.json every five seconds with cache bypass and
a 4.5-second timeout. Hidden pages pause polling and recheck when visible. Failed
reads, missing/archived products, old dates and absent stock show an unconfirmed
state; previous.json is never used as a live stock source. Publication failure
continues to use the existing admin recovery flow.

Validation: 13 behavior/unit tests; public/Admin production builds; dist guard;
desktop/mobile browser smoke (7 → 0 → offline → recovery, no overflow/page errors);
owner/cashier Admin UI activation/edit/save payload through mocked API responses.
Full real-database API integration remains unverified locally: better-sqlite3
13.0.3 could not compile on Windows without Visual Studio C++ build tools.
Run server-node's API suite in the supported Node 24/Linux environment before
production release. No production data was modified by this task.
