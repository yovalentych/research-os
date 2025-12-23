export function buildArchiveFilter(searchParams: URLSearchParams) {
  const includeArchived = searchParams.get("includeArchived") === "1";
  const archived = searchParams.get("archived") === "1";

  if (includeArchived) {
    return {};
  }

  if (archived) {
    return { archivedAt: { $exists: true } };
  }

  return { archivedAt: { $exists: false } };
}
