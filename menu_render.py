# -*- coding: utf-8 -*-
"""Render the menu's <main> from menu.json using the markup already in Menu.dc.html.

The templates are not written here. They are lifted out of the .dc.html at build
time by replacing the first real item's structural fields with placeholders - so
the design-canvas tool stays the owner of the markup, and a change it makes to a
tile is picked up on the next build instead of drifting away from a copy kept here.

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


def _match_once(text, pattern, field, kind):
    """Return one structural match, rejecting missing or ambiguous markup."""
    matches = list(re.finditer(pattern, text, re.S))
    if len(matches) != 1:
        raise SystemExit(
            "menu_render: expected exactly one %s while building the %s template, found %d.\n"
            "The markup in Menu.dc.html changed shape - update this file to match."
            % (field, kind, len(matches)))
    return matches[0]


def _replace_field(text, pattern, placeholder, field, kind):
    """Replace capture group 2 of one structural match with a placeholder."""
    match = _match_once(text, pattern, field, kind)
    return text[:match.start(2)] + placeholder + text[match.end(2):]


def _item_template(block, kind, priced):
    """Turn one real <article> into a template without consulting menu copy."""
    slot_match = _match_once(
        block, r'(<image-slot\b[^>]*>)(.*?)(</image-slot>)', "image-slot", kind)
    slot = slot_match.group(0)
    slot = _replace_field(slot, r'(\sid=")([^"]*)(")', "{slotId}",
                          "image-slot id", kind)
    slot = _replace_field(slot, r'(\splaceholder=")([^"]*)(")', "{caption}",
                          "image-slot placeholder", kind)
    slot = _replace_field(slot, r'(\sdata-src="assets/menu/opt/)([^"]*)(")', "{photo}",
                          "image-slot photo path", kind)
    t = block[:slot_match.start()] + slot + block[slot_match.end():]
    t = _replace_field(t, r'(<h3>)(.*?)(</h3>)', "{name}", "<h3>", kind)
    t = _replace_field(t, r'(<p>)(.*?)(</p>)', "{desc}", "<p>", kind)
    if priced:
        t = _replace_field(t, r'(<strong>)(.*?)(</strong>)', "{price}",
                           "<strong>", kind)
    return t


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
    opted = next(a for a in articles if '<dl class="opts">' in a)

    tpl_priced = _item_template(priced, "priced item", priced=True)
    tpl_opted = _item_template(opted, "option item", priced=False)

    # the row shape is shared by option chips and the add-on list: both are a
    # label and the price of that label, which is why both are description lists
    row = re.search(r'<div><dt>.*?</dt><dd>.*?</dd></div>', body, re.S).group(0)
    tpl_row = re.sub(r'<dt>.*?</dt>', '<dt>{label}</dt>', row, flags=re.S)
    tpl_row = re.sub(r'<dd>.*?</dd>', '<dd>{price}</dd>', tpl_row, flags=re.S)

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

    addons_sec = next((s for s in sections if '<dl class="addons">' in s), None)

    # --- render ------------------------------------------------------------
    out = []
    for c in cats:
        if c["layout"] == "addons":
            rows = "\n".join(tpl_row.format(label=i["name"], price=i["price"])
                             for i in c["items"])
            sec = addons_sec
            aid = re.search(r'aria-labelledby="([^"]+)"', sec).group(1)
            sec = re.sub(r'(<dl class="addons">).*?(</dl>)',
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
                t = re.sub(r'(<dl class="opts">).*?(</dl>)',
                           lambda m: m.group(1) + "\n" + rows + "\n" + m.group(2), t, flags=re.S)
                items.append(t.format(slotId=it["slotId"], caption=it["caption"],
                                      photo=photo, name=it["name"], desc=it["desc"]))
            else:
                items.append(tpl_priced.format(slotId=it["slotId"], caption=it["caption"],
                                               photo=photo, name=it["name"],
                                               desc=it["desc"], price=it["price"]))
        out.append(head_tpl.format(id=c["id"], title=c["title"], intro=c["intro"],
                                   items="\n\n".join(items)))

    return "\n\n" + "\n\n".join(([prelude] if prelude else []) + out) + "\n\n"


def apply(dc_html):
    """Swap the hand-written items for the ones in menu.json."""
    path = os.path.join(HERE, "menu.json")
    if not os.path.exists(path):
        return dc_html
    data = json.load(io.open(path, encoding="utf-8"))
    new_main = build_main(dc_html, data)
    return MAIN.sub(lambda m: m.group(1) + new_main.replace("\\", "\\\\") + m.group(3),
                    dc_html, count=1)
