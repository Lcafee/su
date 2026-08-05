# -*- coding: utf-8 -*-
"""Render the menu's <main> from menu.json using the markup already in Menu.dc.html.

The templates are not written here. They are lifted out of the .dc.html at build
time by matching the first real item against its own entry in menu.json - so the
design-canvas tool stays the owner of the markup, and a change it makes to a tile
is picked up on the next build instead of drifting away from a copy kept here.

Split of ownership:
  Menu.dc.html  - what a tile looks like
  menu.json     - what the tiles say
Neither file writes the other's half, which is the whole reason the admin panel
can edit content without fighting the design tool.
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PLACEHOLDER = "item-placeholder.webp"

MAIN = re.compile(r'(<main id="menu">)(.*?)(</main>)', re.S)
SECTION = re.compile(r'<section class="cat" aria-labelledby="[^"]+">.*?</section>', re.S)
ARTICLE = re.compile(r'<article class="item">.*?</article>', re.S)


def _sub_once(text, old, new, what):
    """Replace exactly one literal occurrence, or say which one went missing.

    Silent no-ops are how a template quietly stops carrying a field, so a miss
    is an error rather than a slightly wrong page nobody notices for a month.
    """
    if text.count(old) != 1:
        raise SystemExit(
            "menu_render: expected exactly one %r while building the %s template, found %d.\n"
            "The markup in Menu.dc.html changed shape - update this file to match."
            % (old, what, text.count(old)))
    return text.replace(old, new)


def _item_template(block, item, kind):
    """Turn one real <article> into a template by swapping its own values out."""
    t = block
    if "slotId" in item:
        t = _sub_once(t, 'id="%s"' % item["slotId"], 'id="{slotId}"', kind)
        t = _sub_once(t, 'placeholder="%s"' % item["caption"], 'placeholder="{caption}"', kind)
        if item.get("photo"):
            t = _sub_once(t, 'data-src="assets/menu/opt/%s"' % item["photo"],
                          'data-src="assets/menu/opt/{photo}"', kind)
    t = _sub_once(t, "<h3>%s</h3>" % item["name"], "<h3>{name}</h3>", kind)
    t = _sub_once(t, "<p>%s</p>" % item["desc"], "<p>{desc}</p>", kind)
    if "price" in item:
        t = _sub_once(t, "<strong>%s</strong>" % item["price"], "<strong>{price}</strong>", kind)
    return t


def _find(cats, pred):
    for c in cats:
        for i in c["items"]:
            if pred(i):
                return c, i
    raise SystemExit("menu_render: menu.json has no item matching a required template shape")


def build_main(dc_html, data):
    """Return the replacement <main> body, rendered from data."""
    cats = data["categories"]
    body = MAIN.search(dc_html).group(2)
    sections = SECTION.findall(body)
    if not sections:
        raise SystemExit("menu_render: no <section class=\"cat\"> found in Menu.dc.html")

    # Whatever <main> opens with before the first category belongs to the page,
    # not to menu.json, so it survives the render. Without this the rebuilt
    # <main> is categories and nothing else, and the sr-only <h1> that names the
    # page is dropped on every build - silently, because its .sr-only rule lives
    # in the <style> and still ships, so the page looks untouched while the
    # document loses its only h1 and starts its outline at h2.
    prelude = body[:body.index(sections[0])].strip()

    # --- lift the templates out of the real markup -------------------------
    articles = ARTICLE.findall(body)
    priced = next(a for a in articles if "<strong>" in a)
    opted = next(a for a in articles if '<ul class="opts">' in a)

    grid_cats = [c for c in cats if c["layout"] == "grid"]
    _, first_priced = _find(grid_cats, lambda i: "price" in i)
    _, first_opted = _find(grid_cats, lambda i: "options" in i)

    tpl_priced = _item_template(priced, first_priced, "priced item")
    tpl_opted = _item_template(opted, first_opted, "option item")

    # the <li> shape is shared by option chips and the add-on list
    row = re.search(r'<li><span>.*?</span><b>.*?</b></li>', body, re.S).group(0)
    tpl_row = re.sub(r'<span>.*?</span>', '<span>{label}</span>', row, flags=re.S)
    tpl_row = re.sub(r'<b>.*?</b>', '<b>{price}</b>', tpl_row, flags=re.S)

    # a whole <section> minus its items, so the head markup stays the tool's
    head_tpl = SECTION.search(body).group(0)
    head_tpl = ARTICLE.sub("{items}", head_tpl, count=len(articles))
    head_tpl = re.sub(r'(<div class="grid">)\s*(?:\{items\}\s*)+', r'\1\n{items}\n', head_tpl)
    src_id = re.search(r'aria-labelledby="([^"]+)"', head_tpl).group(1)
    src_title = re.search(r'<h2 id="[^"]+">(.*?)</h2>', head_tpl, re.S).group(1)
    src_intro = re.search(r'<h2 id="[^"]+">.*?</h2>\s*<p>(.*?)</p>', head_tpl, re.S).group(1)
    head_tpl = (head_tpl.replace('aria-labelledby="%s"' % src_id, 'aria-labelledby="{id}"')
                        .replace('<h2 id="%s">' % src_id, '<h2 id="{id}">')
                        .replace("%s</h2>" % src_title, "{title}</h2>")
                        .replace("<p>%s</p>" % src_intro, "<p>{intro}</p>", 1))

    addons_sec = next((s for s in sections if '<ul class="addons">' in s), None)

    # --- render ------------------------------------------------------------
    out = []
    for c in cats:
        if c["layout"] == "addons":
            rows = "\n".join(tpl_row.format(label=i["name"], price=i["price"])
                             for i in c["items"])
            sec = addons_sec
            aid = re.search(r'aria-labelledby="([^"]+)"', sec).group(1)
            sec = re.sub(r'(<ul class="addons">).*?(</ul>)',
                         lambda m: m.group(1) + "\n" + rows + "\n" + m.group(2), sec, flags=re.S)
            out.append(sec)
            continue

        items = []
        for it in c["items"]:
            photo = it.get("photo") or PLACEHOLDER
            if "options" in it:
                t = tpl_opted
                rows = "\n".join(tpl_row.format(label=o["label"], price=o["price"])
                                 for o in it["options"])
                t = re.sub(r'(<ul class="opts">).*?(</ul>)',
                           lambda m: m.group(1) + "\n" + rows + "\n" + m.group(2), t, flags=re.S)
                items.append(t.format(slotId=it["slotId"], caption=it["caption"],
                                      photo=photo, name=it["name"], desc=it["desc"]))
            else:
                items.append(tpl_priced.format(slotId=it["slotId"], caption=it["caption"],
                                               photo=photo, name=it["name"],
                                               desc=it["desc"], price=it["price"]))
        out.append(head_tpl.format(id=c["id"], title=c["title"], intro=c["intro"],
                                   items="\n\n".join(items)))

    return "\n\n" + "\n\n".join([prelude] + out if prelude else out) + "\n\n"


def apply(dc_html):
    """Swap the hand-written items for the ones in menu.json."""
    path = os.path.join(HERE, "menu.json")
    if not os.path.exists(path):
        return dc_html
    data = json.load(io.open(path, encoding="utf-8"))
    new_main = build_main(dc_html, data)
    return MAIN.sub(lambda m: m.group(1) + new_main.replace("\\", "\\\\") + m.group(3),
                    dc_html, count=1)
