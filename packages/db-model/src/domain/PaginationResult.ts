/**
 * Output interface for final response of pagination.
 */
interface PaginationResult<T> {
  totalCount: number;
  maxRows: number;

  pages: {
    first: number;
    prev: number | null;
    current: number;
    next: number | null;
    last: number;
  };

  results: T[];
}

export default PaginationResult;
