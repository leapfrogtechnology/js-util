import * as debug from 'debug';
import * as Knex from 'knex';
import { QueryBuilder, Transaction } from 'knex';

import * as db from './db';
import * as object from './utils/object';
import * as paginator from './utils/paginator';
import { NS_MODEL } from './constants';

import ModelNotFoundError from './ModelNotFoundError';
import PaginationParams from './domain/PaginationParams';
import PaginationResult from './domain/PaginationResult';
import RawBindingParams, { ValueMap } from './domain/RawBindingParams';

const log = debug(NS_MODEL);

export type ConnectionResolver = () => Knex;

/**
 * Create Model for different connection
 *
 * @param {ConnectionResolver} [resolver]
 * @returns {typeof BaseModel}
 */
export function createBaseModel(resolver?: ConnectionResolver) {
  return class BaseModel {
    public static table: string;
    public static connection?: Knex;

    /**
     * Binds a database connection to the model.
     *
     * @param {Knex} connection
     * @returns {void}
     */
    public static bindConnection(connection: Knex): void {
      log('Binding database connection to the model (Lazy)');

      this.connection = connection;
    }

    /**
     * Binds a database connection to the model (chainable version of bindConnection()).
     *
     * @param {Knex} connection
     * @returns {any}
     */
    public static bind(connection: Knex): any {
      this.bindConnection(connection);

      return this;
    }

    /**
     * Resolves a database connection.
     *
     * Note: It would throw an Error on the run time if it couldn't resolve the
     * connection by the time any DB methods are invoked on it.
     * @returns {Knex}
     */
    public static getConnection(): Knex {
      if (this.connection) {
        return this.connection;
      }

      // Note: We need to resolve db connection everytime.
      if (resolver) {
        return resolver();
      }

      throw new Error('Cannot resolve the database connection.');
    }

    /**
     * Generic query builder.
     *
     * @param {(qb: Knex | Transaction) => QueryBuilder} callback
     * @param {Transaction} [trx]
     * @returns {Promise<T[]>}
     */
    public static async buildQuery<T>(
      callback: (qb: Knex | Transaction) => QueryBuilder,
      trx?: Transaction
    ): Promise<T[]> {
      const qb = db.queryBuilder(this.getConnection(), trx);
      const result = await callback(qb);

      return object.toCamelCase<T[]>(result);
    }

    /**
     * Finds a record based on the params.
     * Returns null if no results were found.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @returns {Promise<T | null>}
     */
    public static get<T>(params: object = {}, trx?: Knex.Transaction): Promise<T | null> {
      return db.get<T>(this.getConnection(), this.table, params, trx);
    }

    /**
     * Find record by it's id.
     * Returns null if not found.
     *
     * @param {number} id
     * @param {Knex.Transaction} trx
     * @returns {Promise<T | null>}
     */
    public static getById<T>(id: number, trx?: Knex.Transaction): Promise<T | null> {
      return db.getById<T>(this.getConnection(), this.table, id, trx);
    }

    /**
     * Finds a record based on the params.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @throws {ModelNotFoundError}
     * @returns {Promise<T>}
     */
    public static async find<T>(params: object = {}, trx?: Knex.Transaction): Promise<T> {
      const result = await this.get<T>(params, trx);

      if (!result) {
        throw new ModelNotFoundError(this.name + ' not found');
      }

      return result;
    }

    /**
     * Find record by it's id.
     * Throws an exception if not found.
     *
     * @param {number} id
     * @param {Knex.Transaction} trx
     * @throws {ModelNotFoundError}
     * @returns {Promise<T>}
     */
    public static findById<T>(id: number, trx?: Knex.Transaction): Promise<T> {
      return this.find<T>({ id }, trx);
    }

    /**
     * Find all records based on the params.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @returns {Promise<T[]>}
     */
    public static async findAll<T>(params: object = {}, trx?: Knex.Transaction): Promise<T[]> {
      return db.findAll<T>(this.getConnection(), this.table, params, trx);
    }

    /**
     * Insert all records sent in data object.
     *
     * @param {(object | object[])} data
     * @param {Transaction} [trx]
     * @returns {Promise<T[]>}
     */
    public static insert<T>(data: object | object[], trx?: Transaction): Promise<T[]> {
      return db.insert<T>(this.getConnection(), this.table, data, trx);
    }

    /**
     * Update records by id.
     *
     * @param {number} id
     * @param {object} params
     * @param {Transaction} transaction
     * @returns {Promise<object>}
     */
    public static updateById<T>(id: number | number[], params: object, trx?: Transaction): Promise<T[]> {
      return db.updateById<T>(this.getConnection(), this.table, id, params, trx);
    }

    /**
     * Update records by where condition.
     *
     * @param {object} where
     * @param {object} params
     * @param {Transaction} transaction
     * @returns {Promise<T[]>}
     */
    public static updateWhere<T>(where: object, params: object, trx?: Transaction): Promise<T[]> {
      return db.updateWhere<T>(this.getConnection(), this.table, where, params, trx);
    }

    /**
     * Delete row in table.
     *
     * @param {object} params
     * @param {Transaction} trx
     * @returns {Promise<T[]>}
     */
    public static delete<T>(params: object, trx?: Transaction): Promise<T[]> {
      return db.remove<T>(this.getConnection(), this.table, params, trx);
    }

    /**
     * Execute SQL raw query and return results.
     *
     * @param {string} sql
     * @param {RawBindingParams | ValueMap} params
     * @param {Transaction} trx
     * @returns {Promise<T[]>}
     */
    public static query<T>(sql: string, params?: RawBindingParams | ValueMap, trx?: Transaction): Promise<T[]> {
      return db.query<T>(this.getConnection(), sql, params, trx);
    }

    /**
     * Execute a query with pagination and return the paginated results.
     * TODO: Accept both raw sql query and knex query builder instance.
     *
     * @param {string} query
     * @param {PaginationParams} params
     * @returns {Promise<PaginationResult<T>>}
     */
    public static paginate<T>(query: string, params: PaginationParams): Promise<PaginationResult<T>> {
      return paginator.paginate<T>(this.getConnection(), query, params);
    }

    /**
     * Method to perform a transactional query execution.
     *
     * @param {(trx: Transaction) => any} callback
     * @returns {any}
     */
    public static transaction<T>(callback: (trx: Transaction) => any): any {
      return this.getConnection().transaction(callback);
    }

    /**
     * Batch insert rows of data.
     *
     * @param {object[]} data
     * @param {Transaction} [trx]
     * @param {number} [chunksize=30]
     * @returns {Promise<T[]>}
     */
    public static batchInsert<T>(data: object[], trx?: Transaction, chunksize: number = 30): Promise<T[]> {
      return db.batchInsert<T>(this.getConnection(), this.table, data, chunksize, trx);
    }

    /**
     * Execute SQL raw query and return scalar value.
     *
     * @param {string} sql
     * @param {any} params
     * @param {Transaction} trx
     * @returns {Promise<T | null>}
     */
    public static getValue<T>(sql: string, params?: any, trx?: Transaction): Promise<T | null> {
      return db.getValue<T>(this.getConnection(), sql, params, trx);
    }

    /**
     * Execute SQL raw query returning a boolean result.
     *
     * @param {string} sql
     * @param {*} [params]
     * @param {Transaction} [trx]
     * @returns {Promise<boolean>}
     */
    public static check(sql: string, params?: any, trx?: Transaction): Promise<boolean> {
      return db.check(this.getConnection(), sql, params, trx);
    }

    /**
     * Execute SQL raw query returning a JSON encoded result
     * and produce the parsed object.
     *
     * @param {string} sql
     * @param {*} [params]
     * @param {Transaction} [trx]
     * @returns {(Promise<T | null>)}
     */
    public static getJson<T>(sql: string, params?: any, trx?: Transaction): Promise<T | null> {
      return db.getJson<T>(this.getConnection(), sql, params, trx);
    }

    /**
     * Invoke a scalar-valued function and return results.
     *
     * Example usage:
     *
     *  const username = await User.invoke<string>('dbo.can_user_access_object', { userId: 10, objectId: 15 });
     *
     *  // => Runs SQL: SELECT dbo.can_user_access_object(:userId, :objectId)
     *  // => Binds params: { userId: 10, objectId: 15 }
     *
     * @param {string} objectName
     * @param {RawBindingParams | ValueMap} [params]
     * @param {Knex.Transaction} [trx]
     * @returns {Promise<T | null>}
     */
    public static invoke<T>(objectName: string, params?: any, trx?: Transaction): Promise<T | null> {
      return db.invoke<T>(trx || this.getConnection(), objectName, params);
    }

    /**
     * Execute a procedure and return the results returned (if any).
     *
     * Example usage:
     *
     *  await Recommendation.exec<string>('dbo.update_top_recommendations', { userId: 10, type });
     *
     *  // => Runs SQL: EXEC dbo.update_top_recommendations :userId, :type
     *  // => Binds params: { userId: 10, type }
     *
     * @param {string} objectName
     * @param {RawBindingParams | ValueMap} [params]
     * @param {Knex.Transaction} [trx]
     * @returns {Promise<T[]>}
     */
    public static exec<T>(objectName: string, params?: any, trx?: Transaction): Promise<T[]> {
      return db.exec<T>(trx || this.getConnection(), objectName, params);
    }
  };
}

export const Model = createBaseModel();
