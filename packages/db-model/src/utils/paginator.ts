import * as Knex from 'knex';

import * as db from '../db';
import PaginationParams from '../domain/PaginationParams';
import PaginationResult from '../domain/PaginationResult';

interface Count {
  count: number;
}

/**
 * Execute a query with pagination and return the paginated results.
 *
 * TODO: Accept both raw sql query and knex query builder instance.
 *
 * @param {Knex} connection
 * @param {string} query
 * @param {PaginationParams} params
 * @returns {Promise<PaginationResult<T>>}
 */
export async function paginate<T>(
  connection: Knex,
  query: string,
  params: PaginationParams
): Promise<PaginationResult<T>> {
  const limit = params.maxRows || 10;
  const currentPage = !params.currentPage || params.currentPage < 1 ? 1 : params.currentPage;
  const offset = (currentPage - 1) * limit;

  let last = 0;
  const prev = currentPage > 1 ? currentPage - 1 : null;

  let totalCount = 0;
  const totalRecords = await db.query<Count>(connection, params.totalCountQuery, params.boundParams);

  totalCount = totalRecords[0].count;
  last = Math.ceil(totalCount / limit);

  const next = currentPage < last ? currentPage + 1 : null;

  const paginatedQuery = paginateSql(query, offset, limit, params.hasOrderBy);
  const results = await db.query<T>(connection, paginatedQuery, params.boundParams);

  return {
    results,
    totalCount,
    maxRows: limit,
    pages: {
      prev,
      next,
      last,
      first: 1,
      current: currentPage
    }
  };
}

/**
 * Paginate a raw SQL query by adding LIMIT and OFFSET.
 *
 * @param {string} sql
 * @param {number} offset
 * @param {number} limit
 * @returns {string}
 */
function paginateSql(sql: string, offset: number, limit: number, hasOrderBy: boolean = false): string {
  return `${sql} ${hasOrderBy ? '' : 'ORDER BY id'} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY `;
}
