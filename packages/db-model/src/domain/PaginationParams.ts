/**
 * Parameters required for Paginator util module while calling it.
 */
interface PaginationParams {
  maxRows: number;
  boundParams?: any;
  currentPage: number;
  hasOrderBy?: boolean;
  totalCountQuery: string;
}

export default PaginationParams;
