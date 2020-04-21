/**
 * Build the pages for PaginationResult.
 *
 * @param {number} page
 * @param {number} pageSize
 * @param {number} count
 * @returns {Object}
 */
export function buildPages(page: number, pageSize: number, count: number) {
  const first = 1;
  const prev = page <= 1 ? 1 : page - 1;
  const current = page;
  const last = Math.ceil(count / pageSize);
  const next = current >= last ? last : current + 1;

  return { first, prev, current, next, last };
}
