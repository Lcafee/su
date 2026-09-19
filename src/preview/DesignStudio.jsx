import { useEffect, useLayoutEffect, useState } from "react";
import { MenuJourney } from "../menu/MenuJourney";
import "./design-studio.css";

const MENU_BACKGROUNDS = [
  { id: "journey", name: "The Art of Pause", label: "هنر مکث", description: "نقاشی پیوسته‌ای از نور، معماری و اشیای ال کافه — طرح فعلی تولید" },
  { id: "atrium", name: "Amber Atrium", label: "آتریوم کهربایی", description: "برداشتی انتزاعی از نور معلق، بافت دست‌ساز و خطوط معماری" },
  { id: "limestone", name: "Limestone Atelier", label: "آتلیه سنگ", description: "گچ روشن، نور عصر و سایه‌های معماری" },
  { id: "nocturne", name: "Bronze Nocturne", label: "شب برنزی", description: "ابریشم تیره، برنز و فضای شام" },
  { id: "garden", name: "Garden Folio", label: "باغ روی کاغذ", description: "حکاکی سرو و انار روی کاغذ سبز روشن" },
  { id: "original", name: "Original", label: "طرح پایه", description: "پس‌زمینه خوشنویسی برای مقایسه" },
];

const DEFAULT_BACKGROUND = "journey";

function readBackground() {
  const id = new URLSearchParams(window.location.search).get("background");
  return MENU_BACKGROUNDS.some((option) => option.id === id) ? id : DEFAULT_BACKGROUND;
}

// The studio drives the real menu underneath it; only the background changes.
export function DesignStudio() {
  const [background, setBackground] = useState(readBackground);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (background === "original") delete document.documentElement.dataset.menuBackground;
    else document.documentElement.dataset.menuBackground = background;
    return () => { delete document.documentElement.dataset.menuBackground; };
  }, [background]);

  useEffect(() => {
    const sync = () => setBackground(readBackground());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const select = (id) => {
    const url = new URL(window.location.href);
    url.searchParams.set("background", id);
    window.history.replaceState(window.history.state, "", url);
    setBackground(id);
  };

  return (
    <>
      {background === "journey" && <MenuJourney />}
      <aside className="background-studio" aria-label="استودیو طراحی منو" dir="rtl">
        <button className="background-studio-toggle" type="button" aria-expanded={open}
          aria-controls="background-studio-panel" onClick={() => setOpen(!open)}>
          {open ? "بستن استودیو" : "طرح‌های پس‌زمینه"}
        </button>
        {open && (
          <div className="background-studio-panel" id="background-studio-panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                event.currentTarget.previousElementSibling.focus();
              }
            }}>
            <fieldset>
              <legend>انتخاب فضای منو</legend>
              {MENU_BACKGROUNDS.map((option) => (
                <label className="background-studio-option" key={option.id}>
                  <input type="radio" name="menu-background" value={option.id}
                    checked={background === option.id} onChange={() => select(option.id)} />
                  <span className="background-studio-swatch" data-swatch={option.id} aria-hidden="true" />
                  <span><strong>{option.label}</strong><span lang="en" dir="ltr">{option.name}</span><small>{option.description}</small></span>
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </aside>
    </>
  );
}
