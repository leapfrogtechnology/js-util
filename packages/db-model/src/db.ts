import * as Knex from 'knex';
import * as debug from 'debug';

import { NS_DB } from './constants';
import * as object from './utils/object';
import ModelNotFoundError from './ModelNotFoundError';
import RawBindingParams, { ValueMap } from './domain/RawBindingParams';

interface BatchUpdateOptions {
  dataSize: number;
  batchSize: number;
  log?: (msg: any) => any;
}

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
 * Push 'updated_at' key to params if the column exists in the table being updated.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {any} [params={}]
 * @returns {Promise<any>}
 */
async function withTimestamp(connection: Knex, table: string, params: any = {}): Promise<any> {
  const exists = await connection.schema.hasColumn(table, 'updated_at');

  if (!exists || (exists && params.updatedAt)) {
    return object.toSnakeCase(params);
  }

  return { ...object.toSnakeCase(params), updated_at: connection.fn.now() };
}

/**
 * Finds a record based on the params.
 * Returns null if no results were found.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} [params={}]
 * @param {Knex.Transaction} [trx]
 * @returns {(Promise<T | null>)}
 */
export async function get<T>(
  connection: Knex,
  table: string,
  params: object = {},
  trx?: Knex.Transaction
): Promise<T | null> {
  const [result] = await queryBuilder(connection, trx)
    .select('*')
    .from(table)
    .where(object.toSnakeCase(params))
    .limit(1);

  if (!result) {
    return null;
  }

  return object.toCamelCase(result);
}

/**
 * Find record by it's id.
 * Returns null if not found.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {number} id
 * @returns {(Promise<T | null>)}
 */
export function getById<T>(connection: Knex, table: string, id: number, trx?: Knex.Transaction): Promise<T | null> {
  return get<T>(connection, table, { id }, trx);
}

/**
 * Finds a record based on the params.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} [params={}]
 * @param {Knex.Transaction} [trx]
 * @throws {ModelNotFoundError}
 * @returns {Promise<T>}
 */
export async function find<T>(
  connection: Knex,
  table: string,
  params: object = {},
  trx?: Knex.Transaction
): Promise<T> {
  const result = await get<T>(connection, table, params, trx);

  if (!result) {
    throw new ModelNotFoundError('Model not found');
  }

  return result;
}

/**
 * Find all records based on the params.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} [params={}]
 * @param {Knex.Transaction} [trx]
 * @returns {Promise<T[]>}
 */
export async function findAll<T>(
  connection: Knex,
  table: string,
  params: object = {},
  trx?: Knex.Transaction
): Promise<T[]> {
  const rows = await queryBuilder(connection, trx).select('*').from(table).where(object.toSnakeCase(params));

  return object.toCamelCase(rows);
}

/**
 * Insert all records sent in data object.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {(object | object[])} data
 * @param {Knex.Transaction} [trx]
 * @returns {Promise<T[]>}
 */
export async function insert<T>(
  connection: Knex,
  table: string,
  data: object | object[],
  trx?: Knex.Transaction
): Promise<T[]> {
  const qb = queryBuilder(connection, trx);
  const result = await qb.insert(object.toSnakeCase(data)).into(table).returning('*');

  return object.toCamelCase(result);
}

/**
 * Update records by id.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {(number | number[])} id
 * @param {object} params
 * @param {Knex.Transaction} [trx]
 * @returns {Promise<T[]>}
 */
export async function updateById<T>(
  connection: Knex,
  table: string,
  id: number | number[],
  params: object,
  trx?: Knex.Transaction
): Promise<T[]> {
  const qb = queryBuilder(connection, trx);
  const updateParams = await withTimestamp(connection, table, params);

  const result = await qb
    .update(updateParams)
    .table(table)
    .whereIn('id', Array.isArray(id) ? id : [id])
    .returning('*');

  return object.toCamelCase(result);
}

/**
 * Update records by where condition.
 *
 * @param {object} where
 * @param {object} params
 * @param {Transaction} transaction
 * @returns {Promise<T[]>}
 */
export async function updateWhere<T>(
  connection: Knex,
  table: string,
  where: object,
  params: object,
  trx?: Knex.Transaction
): Promise<T[]> {
  const qb = queryBuilder(connection, trx);
  const updateParams = await withTimestamp(connection, table, params);

  const result = await qb.update(updateParams).table(table).where(object.toSnakeCase(where)).returning('*');

  return object.toCamelCase(result);
}

/**
 * Delete row in table.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object} params
 * @param {Transaction} trx
 * @returns {Promise<T[]>}
 */
export async function remove<T>(connection: Knex, table: string, params: object, trx?: Knex.Transaction): Promise<T[]> {
  const qb = queryBuilder(connection, trx);
  const result = await qb.where(object.toSnakeCase(params)).from(table).del().returning('*');

  return object.toCamelCase(result);
}

/**
 * Execute SQL raw query and return results.
 *
 * @param {Knex} connection
 * @param {string} sql
 * @param {RawBindingParams | ValueMap} [params]
 * @param {Knex.Transaction} [trx]
 * @returns {Promise<T[]>}
 */
export async function query<T>(
  connection: Knex,
  sql: string,
  params?: RawBindingParams | ValueMap,
  trx?: Knex.Transaction
): Promise<T[]> {
  const conn = queryBuilder(connection, trx);
  const result = params ? await conn.raw(sql, params) : await conn.raw(sql);

  return object.toCamelCase(result);
}

/**
 * Batch inserts the given data.
 *
 * @param {Knex} connection
 * @param {string} table
 * @param {object[]} data
 * @param {number} chunkSize
 * @param {Knex.Transaction} [trx]
 * @returns {Promise<T[]>}
 */
export async function batchInsert<T>(
  connection: Knex,
  table: string,
  data: object[],
  chunkSize: number,
  trx?: Knex.Transaction
): Promise<T[]> {
  const qb = queryBuilder(connection, trx);
  const result = await qb.batchInsert(table, object.toSnakeCase(data), chunkSize).returning('*');

  return object.toCamelCase(result);
}

/**
 * Execute SQL raw query returning a scalar value.
 *
 * Example:
 *  const count:number = await db.getValue<number>(
 *    connection,
 *    'SELECT count(id) FROM jobs WHERE is_active = 1'
 *  );
 *
 * @param {Knex} connection
 * @param {string} sql
 * @param {any} params
 * @param {Knex.Transaction} trx
 * @returns {Promise<T | null>}
 */
export async function getValue<T>(
  connection: Knex,
  sql: string,
  params?: any,
  trx?: Knex.Transaction
): Promise<T | null> {
  const qb = queryBuilder(connection, trx);
  const [data] = await qb.raw(sql, params);

  if (!data) {
    return null;
  }

  const [value] = Object.values<T>(data);

  return value;
}

/**
 * Execute SQL raw query returning a boolean result.
 *
 * Example:
 *  const result:boolean = await db.check(
 *    connection,
 *    'SELECT is_active FROM jobs WHERE id = :jobId'
 *  );
 *
 * @param {Knex} connection
 * @param {string} sql
 * @param {any} params
 * @param {Knex.Transaction} trx
 * @returns {Promise<boolean>}
 */
export async function check(connection: Knex, sql: string, params?: any, trx?: Knex.Transaction): Promise<boolean> {
  const value = await getValue<boolean>(connection, sql, params, trx);

  return !!value;
}

/**
 * Execute SQL raw query returning a JSON encoded result
 * and produce the parsed object.
 *
 * Example:
 *
 *  const result:JobDetail = await db.getJson<JobDetail>(
 *    connection,
 *    'SELECT * FROM jobs WHERE id = :jobId FOR JSON AUTO'
 *  );
 *
 * @param {Knex} connection
 * @param {string} sql
 * @param {any} params
 * @param {Knex.Transaction} trx
 * @returns {Promise<T | null>}
 */
export async function getJson<T>(
  connection: Knex,
  sql: string,
  params?: any,
  trx?: Knex.Transaction
): Promise<T | null> {
  const value = await getValue<string>(connection, sql, params, trx);

  if (value) {
    return object.fromJson<T>(value);
  }

  return null;
}

/**
 * Invoke a scalar-valued function and return results.
 *
 * Example usage:
 *
 *  const username = await db.invoke<string>(con, 'dbo.can_user_access_object', { userId: 10, objectId: 15 });
 *
 *  // => Runs SQL: SELECT dbo.can_user_access_object(:userId, :objectId)
 *  // => Binds params: { userId: 10, objectId: 15 }
 *
 * @param {(Knex | Knex.Transaction)} connection
 * @param {string} objectName
 * @param {(RawBindingParams | ValueMap)} [params]
 * @returns {(Promise<T | null>)}
 */
export async function invoke<T>(
  connection: Knex | Knex.Transaction,
  objectName: string,
  params?: RawBindingParams | ValueMap
): Promise<T | null> {
  const { procName, expr } = getProcParamsExpr(objectName, params);

  log(`Invoke function '${procName}' with: [${expr}]`);

  // TODO: This returns just a scalar-valued functions right now.
  // Improve it later to support TVP and other advanced functions.
  const sql = `SELECT ${procName}(${expr})`;
  const [result] = await query<T>(connection, sql, params);

  return result;
}

/**
 * Execute a procedure and return the results returned (if any).
 *
 * Example usage:
 *
 *  await db.exec<string>(trx, 'dbo.update_top_recommendations', { userId: 10, type });
 *
 *  // => Runs SQL: EXEC dbo.update_top_recommendations :userId, :type
 *  // => Binds params: { userId: 10, type }
 *
 * @param {(Knex | Knex.Transaction)} connection
 * @param {string} objectName
 * @param {(RawBindingParams | ValueMap)} [params]
 * @returns {Promise<T[]>}
 */
export async function exec<T>(
  connection: Knex | Knex.Transaction,
  objectName: string,
  params?: RawBindingParams | ValueMap
): Promise<T[]> {
  const { procName, expr } = getProcParamsExpr(objectName, params);

  log(`Execute procedure '${procName}' with: [${expr}]`);

  const sql = `EXEC ${procName} ${expr}`;

  return query<T>(connection, sql, params);
}

/**
 * Extract parameter binding expression for procedure or a function.
 *
 * @param {string} objectName
 * @param {(RawBindingParams | ValueMap)} [params]
 * @returns {{ procName: string, expr: string }}
 */
export function getProcParamsExpr(
  objectName: string,
  params?: RawBindingParams | ValueMap
): { procName: string; expr: string } {
  const procName = objectName && objectName.trim && objectName.trim();

  if (!procName) {
    throw new Error(`Invalid function or procedure name '${procName}'.`);
  }

  const expr = params
    ? Object.keys(params)
        .map(key => ':' + key)
        .join(', ')
    : '';

  return { procName, expr };
}

/**
 * Run updates in batch via given query. The query supplied should have an UPDATE TOP
 * statement, as it is the preferred method of updating given N rows.
 *
 * Example usage:
 *
 *  await db.batchUpdateViaQuery(trx, UPDATE_QUERY, { dataSize: 1000, batchSize: 100 });
 *
 *  // => Runs the query and binds params: { batchSize: 100 }
 *
 * @param {Knex.Transaction} trx
 * @param {string} updateQuery
 * @param {BatchUpdateOptions} options
 */
export async function batchUpdateViaQuery(trx: Knex.Transaction, updateQuery: string, options: BatchUpdateOptions) {
  const { dataSize, batchSize } = options;
  const writeLog = options.log || log;

  const totalBatch = Math.ceil(dataSize / batchSize);

  for (let currentBatch = 1; currentBatch <= totalBatch; currentBatch++) {
    writeLog(`Processing batch ${currentBatch} of ${totalBatch}`);

    await trx.raw(updateQuery, { batchSize });
  }
}
