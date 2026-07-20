export function parseAcceptHeader(headerValue) {
  return String(headerValue || "")
    .split(",")
    .map((part) => {
      const [typePart, ...params] = part.trim().split(";").map((value) => value.trim());
      let q = 1;
      for (const param of params) {
        const [key, value] = param.split("=").map((item) => item && item.trim());
        if (key && key.toLowerCase() === "q") {
          const parsed = Number(value);
          q = Number.isFinite(parsed) ? parsed : 0;
        }
      }
      return { type: typePart.toLowerCase(), q };
    })
    .filter((item) => item.type);
}

export function acceptsMarkdown(headerValue) {
  return parseAcceptHeader(headerValue).some((item) => {
    if (item.q <= 0) return false;
    return item.type === "text/markdown";
  });
}

export function normalizeRequestPath(pathname) {
  const value = String(pathname || "/").replace(/\/+$/, "") || "/";
  return value === "/index" ? "/" : value;
}

export function resolveMarkdownEntry(pathname, manifest) {
  const normalized = normalizeRequestPath(pathname);
  return manifest.entries.find((entry) => entry.path === normalized) || null;
}
