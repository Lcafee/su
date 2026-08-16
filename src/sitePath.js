const baseUrl = import.meta.env.BASE_URL;

export function sitePath(path) {
  return `${baseUrl}${path.replace(/^\/+/, "")}`;
}
