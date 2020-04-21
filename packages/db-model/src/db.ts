import * as Knex from 'knex';
import * as debug from 'debug';

import OrderBy from './domain/OrderBy';
import { NS_DB } from './constants';
import RawBindingParams, { ValueMap } from './domain/RawBindingParams';

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
 * @returns {Knex.QueryBuilder}
 */
export function findFirst(
  connection: Knex,
  table: string,
  params: object = {},
  orderBy: OrderBy[],
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
export function find(
  connection: Knex,
  table: string,
  params: object = {},
  orderBy: OrderBy[],
  trx?: Knex.Transaction
): Knex.QueryBuilder {
  let qb = queryBuilder(connection, trx).select('*').from(table).where(params);

  orderBy.forEach(item => {
    qb = qb.orderBy(item.field, item.direction);
  });

  return qb;
}

/**
 * Insert a record into the table
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {(object | object[])} data
 * @param {Knex.Transaction} [trx]
 * @returns {Knex.QueryBuilder}
 */
export function insert(connection: Knex, table: string, data: object, trx?: Knex.Transaction): Knex.QueryBuilder {
  const qb = queryBuilder(connection, trx);

  return qb.insert(data).into(table).returning('*');
}

/**
 * Update records by where condition.
 *
 * @param {object} where
 * @param {object} params
 * @param {Transaction} transaction
 * @returns {Knex.QueryBuilder}
 */
export function update(
  connection: Knex,
  table: string,
  where: object,
  params: object,
  trx?: Knex.Transaction
): Knex.QueryBuilder {
  const qb = queryBuilder(connection, trx);

  return qb.update(params).table(table).where(where).returning('*');
}

/**
 * Delete row in table.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} params
 * @param {Transaction} trx
 * @returns {Knex.QueryBuilder}
 */
export function remove(connection: Knex, table: string, params: object, trx?: Knex.Transaction): Knex.QueryBuilder {
  const qb = queryBuilder(connection, trx);

  return qb.where(params).from(table).del().returning('*');
}

/**
 * Execute SQL raw query and return results.
 *
 * @param {Knex} connection
 * @param {string} sql
 * @param {RawBindingParams | ValueMap} [params]
 * @param {Knex.Transaction} [trx]
 * @returns {Knex.Raw}
 */
export function raw(
  connection: Knex,
  sql: string,
  params?: RawBindingParams | ValueMap,
  trx?: Knex.Transaction
): Knex.Raw {
  const conn = queryBuilder(connection, trx);

  return params ? conn.raw(sql, params) : conn.raw(sql);
}

/**
 * Batch inserts the given data.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object[]} data
 * @param {number} chunkSize
 * @param {Knex.Transaction} [trx]
 * @returns {Knex.QueryBuilder}
 */
export function batchInsert(
  connection: Knex,
  table: string,
  data: object[],
  chunkSize: number,
  trx?: Knex.Transaction
): Knex.QueryBuilder {
  const qb = queryBuilder(connection, trx);

  return qb.batchInsert(table, data, chunkSize).returning('*');
}
