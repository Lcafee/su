import symbol from "../../../assets/brand/l-cafe-symbol-122.png";

export function BrandMark({ small = false }) {
  return <img className={`admin-brand-symbol${small ? " small" : ""}`} src={symbol} width="58" height="76" alt="نشان ال کافه" />;
}
