import * as Knex from 'knex';
import * as debug from 'debug';

import { NS_DB } from './constants';
import * as object from './utils/object';

// interface BatchUpdateOptions {
//   dataSize: number;
//   batchSize: number;
//   log?: (msg: any) => any;
// }

const log = debug(NS_DB);

/**
 * Check if the provided object is a knex connection instance.
 *
 * @param {any} obj
 * @returns {boolean}
 */
export function isKnexInstance(obj: any): obj is Knex {
  return !!(obj.prototype && obj.prototype.constructor && obj.prototype.constructor.name === 'knex');
}

/**
 * Creates a knex database connection instance from
 * the provided database configuration.
 *
 * @param {Knex.Config} dbConfig
 * @returns {Knex}
 */
export function createInstance(dbConfig: Knex.Config): Knex {
  return Knex(dbConfig);
}

/**
 * Check database connection from provided knex params.
 *
 * @param {Knex.Config | Knex | Knex.Transaction} connection
 * @returns {Promise<boolean>}
 */
export async function isValidConnection(connection: Knex.Config | Knex | Knex.Transaction): Promise<boolean> {
  const conn = isKnexInstance(connection) ? connection : createInstance(connection);

  try {
    await conn.raw('SELECT 1');

    return true;
  } catch (err) {
    log('Cannot connect to database', err);

    return false;
  }
}

/**
 * Returns a query builder instance depending on the provided transaction.
 *
 * @param {Knex} connection
 * @param {Knex.Transaction} [trx]
 * @returns {(Knex.Transaction | Knex)}
 */
export function queryBuilder(connection: Knex, trx?: Knex.Transaction): Knex.Transaction | Knex {
  return trx || connection;
}

/**
 * Finds a single record based on the params.
 * Returns null if no results were found.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} [params={}]
 * @param {Knex.Transaction} [trx]
 * @throws {RowNotFoundError}
 * @returns {Knex.QueryBuilder}
 */
export function findFirst<T>(
  connection: Knex,
  table: string,
  params: object = {},
  orderBy: string,
  trx?: Knex.Transaction
): Knex.QueryBuilder {
  return find(connection, table, params, orderBy, trx).limit(1);
}

/**
 * Finds a record based on the params.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} [params={}]
 * @param {Knex.Transaction} [trx]
 * @returns {Knex.QueryBuilder}
 */
export function find<T>(
  connection: Knex,
  table: string,
  params: object = {},
  orderBy: string,
  trx?: Knex.Transaction
): Knex.QueryBuilder {
  let qb = queryBuilder(connection, trx).select('*').from(table).where(object.toSnakeCase(params));

  qb = orderBy ? qb.orderBy(orderBy) : qb;

  return qb;
}
