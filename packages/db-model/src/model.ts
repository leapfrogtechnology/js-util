import * as Knex from 'knex';
import * as debug from 'debug';
import { Transaction } from 'knex';

import * as db from './db';
import OrderBy from './domain/OrderBy';
import { NS_MODEL } from './constants';

import ModelNotFoundError from './ModelNotFoundError';
import RawBindingParams, { ValueMap } from './domain/RawBindingParams';
import PaginationParams from './domain/PaginationParams';
import { any } from 'ramda';

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
    public static defaultOrderBy: OrderBy[] = [{ field: 'id', direction: 'asc' }];
    public static id = 'id';
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
     * @param {Transaction} [trx]
     * @returns {(Knex.Transaction | Knex)}
     */
    public static queryBuilder(trx?: Transaction): Knex.Transaction | Knex {
      return db.queryBuilder(this.getConnection(), trx);
    }

    /**
     * Finds a record based on the params.
     *
     * @param {object} [params={}]
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Knex.QueryBuilder}
     */
    public static find<T>(params: object = {}, callback?: any, trx?: Knex.Transaction): Knex.QueryBuilder {
      return db.find<T>(this.getConnection(), this.table, params, callback, trx);
    }

    /**
     * Finds the first record based on the params.
     *
     * @param {object} [params={}]
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Promise<T | null>}
     */
    public static async findFirst<T>(params: object = {}, callback?: any, trx?: Knex.Transaction): Promise<T | null> {
      return db.findFirst<T>(this.getConnection(), this.table, params, any, trx);
    }

    /**
     * Find record by it's id.
     * Throws an exception if not found.
     *
     * @param {any} id
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Promise<T | null>}
     */
    public static findById<T>(id: any, callback?: any, trx?: Knex.Transaction): Promise<T | null> {
      const idParams = this.buildIdParams(id);

      return db.findFirst<T>(this.getConnection(), this.table, idParams, callback, trx);
    }

    /**
     * Find record by it's id.
     * Throws an exception if not found.
     *
     * @param {any} id
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @throws {ModelNotFoundError}
     * @returns {Promise<T | null>}
     */
    public static findByIdOrFail<T>(id: any, callback?: any, trx?: Knex.Transaction): Promise<T | null> {
      const idParams = this.buildIdParams(id);

      return db.findFirst<T>(this.getConnection(), this.table, idParams, callback, trx).then(result => {
        if (!result) {
          throw new ModelNotFoundError(this.name + ' not found');
        }

        return result;
      });
    }

    /**
     * Finds records based on the params with records limit.
     *
     * @param {object} [params={}]
     * @param {PaginationParams} pageParams
     * @param {OrderBy[]} sortParams
     * @param {Knex.Transaction} trx
     * @param {Function} callback
     * @returns {Knex.QueryBuilder}
     */
    public static findWithPageAndSort(
      params: any = {},
      pageParams: PaginationParams,
      sortParams: OrderBy[],
      callback?: any,
      trx?: Knex.Transaction
    ): Knex.QueryBuilder {
      const offset = (pageParams.page - 1) * pageParams.pageSize;
      const qb = this.find(params, trx).offset(offset).limit(pageParams.pageSize);

      if (sortParams && sortParams.length > 0) {
        qb.clearOrder();

        sortParams.forEach(item => {
          qb.orderBy(item.field, item.direction);
        });
      }

      if (callback) callback(qb);

      return qb;
    }

    /**
     * Count the total records.
     *
     * @param {object} [params={}]
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Knex.QueryBuilder}
     */
    public static count(params: any = {}, callback?: any, trx?: Knex.Transaction): Promise<any> {
      const qb = this.find(params, trx).clearSelect().count('*').clearOrder();

      if (callback) callback(qb);

      return qb.then(([result]) => {
        return result.count;
      });
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
    public static updateById<T>(id: any | number[], params: object, trx?: Transaction): Promise<T[]> {
      const idParams = this.buildIdParams(id);

      return db.update<T>(this.getConnection(), this.table, idParams, params, trx);
    }

    /**
     * Update records by where condition.
     *
     * @param {object} where
     * @param {object} params
     * @param {Transaction} transaction
     * @returns {Promise<T[]>}
     */
    public static update<T>(where: object, params: object, trx?: Transaction): Promise<T[]> {
      return db.update<T>(this.getConnection(), this.table, where, params, trx);
    }

    /**
     * Delete row in table.
     *
     * @param {object} params
     * @param {Transaction} trx
     * @returns {Promise<T[]>}
     */
    public static deleteById<T>(id: any, trx?: Transaction): Promise<T[]> {
      const idParams = this.buildIdParams(id);

      return db.remove<T>(this.getConnection(), this.table, idParams, trx);
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

    /**
     * Build param object for given id.
     *
     * @param {any} id
     * @returns {object}
     */
    static buildIdParams(id: any) {
      if (typeof id === 'number' || typeof id === 'string') {
        return { [this.id]: id };
      }

      return id;
    }
  };
}

export const Model = createBaseModel();
