/**
 * Output interface for final response of pagination.
 */
interface PaginationResult<T> {
  totalCount: number;
  maxRows: number;
  records: T[];
}

export default PaginationResult;
