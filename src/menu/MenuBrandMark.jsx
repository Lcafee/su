import { memo } from "react";

import { sitePath } from "../sitePath";

export const MenuBrandMark = memo(function MenuBrandMark() {
  return (
    <img
      className="menu-brand-mark"
      src={sitePath("assets/brand/l-cafe-symbol.png")}
      width="6000"
      height="8044"
      alt=""
      aria-hidden="true"
    />
  );
});
