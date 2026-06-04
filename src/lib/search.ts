export function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function titleStartsWithQuery(title: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;

  return normalizeSearchText(title).startsWith(normalizedQuery);
}
