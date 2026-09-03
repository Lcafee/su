import { memo } from "react";

import { sitePath } from "../sitePath";

export const MenuBrandMark = memo(function MenuBrandMark() {
  return (
    <img
      className="menu-brand-mark"
      src={sitePath("assets/brand/l-cafe-symbol-122.png")}
      width="91"
      height="122"
      alt=""
      aria-hidden="true"
    />
  );
});
