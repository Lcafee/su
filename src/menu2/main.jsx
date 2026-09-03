import { sitePath } from "../sitePath";

const canonicalMenuPath = sitePath(
  import.meta.env.BASE_URL === "/" ? "menu" : "menu/",
);

window.location.replace(`${canonicalMenuPath}${window.location.hash}`);
