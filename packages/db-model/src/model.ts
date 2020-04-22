import * as Knex from 'knex';
import * as debug from 'debug';

import * as db from './db';
import OrderBy from './domain/OrderBy';
import { NS_MODEL } from './constants';
import PaginationParams from './domain/PaginationParams';
import RawBindingParams, { ValueMap } from './domain/RawBindingParams';
import ModelNotFoundError from './ModelNotFoundError';

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
    public static pk = 'id';
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
     * Finds a single record based on the params.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @param {boolean} shouldFailIfNotFound
     * @param {Function} callback
     * @returns {Promise<any>}
     */
    public static findFirst(
      params: object = {},
      shouldFailIfNotFound?: boolean,
      callback?: any,
      trx?: Knex.Transaction
    ): Promise<any> {
      return db
        .findFirst(this.getConnection(), this.table, params, this.defaultOrderBy, callback, trx)
        .then(([result]) => {
          if (!result && shouldFailIfNotFound) throw new ModelNotFoundError('No row found for the given identifier.');

          return result;
        });
    }

    /**
     * Find by primary key
     *
     * @param {string} pk
     * @param {boolean} shouldFailIfNotFound
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Promise<any>}
     */
    public static findByPk(
      pk: string,
      shouldFailIfNotFound?: boolean,
      callback?: any,
      trx?: Knex.Transaction
    ): Promise<any> {
      const pkParams = { [this.pk]: pk };

      return db
        .findFirst(this.getConnection(), this.table, pkParams, this.defaultOrderBy, callback, trx)
        .then(([result]) => {
          if (!result && shouldFailIfNotFound) throw new ModelNotFoundError('No row found for the given identifier.');

          return result;
        });
    }

    /**
     * Finds records based on the params.
     *
     * @param {object} [params={}]
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Promise<any>}
     */
    public static find(params: object = {}, callback?: any, trx?: Knex.Transaction): Promise<any> {
      return db.find(this.getConnection(), this.table, params, this.defaultOrderBy, trx);
    }

    /**
     * Finds records based on the params with records limit.
     *
     * @param {object} [params={}]
     * @param {PaginationParams} pageParams
     * @param {OrderBy[]} sortParams
     * @param {Function} callback
     * @param {Knex.Transaction} trx
     * @returns {Knex.QueryBuilder}
     */
    public static findWithPageAndSort(
      params: any = {},
      pageParams: PaginationParams,
      sortParams: OrderBy[],
      callback?: any,
      trx?: Knex.Transaction
    ): Promise<any> {
      const offset = (pageParams.page - 1) * pageParams.pageSize;
      const qb = db
        .find(this.getConnection(), this.table, params, this.defaultOrderBy, trx)
        .offset(offset)
        .limit(pageParams.pageSize);

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
      const qb = db
        .find(this.getConnection(), this.table, params, this.defaultOrderBy, trx)
        .clearSelect()
        .count('*')
        .clearOrder();

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
     * @returns {Knex.QueryBuilder}
     */
    public static insert(data: object | object[], trx?: Knex.Transaction): Knex.QueryBuilder {
      return db.insert(this.getConnection(), this.table, data, trx);
    }

    /**
     * Update records by primary key.
     *
     * @param {string} pk
     * @param {any} params
     * @param {Transaction} transaction
     * @returns {Knex.QueryBuilder}
     */
    public static updateByPk(pk: string, params: object, trx?: Knex.Transaction): Knex.QueryBuilder {
      const pkParams = { [this.pk]: pk };

      return db.update(this.getConnection(), this.table, pkParams, params, trx);
    }

    /**
     * Update records by where condition.
     *
     * @param {object} where
     * @param {any} params
     * @param {Transaction} transaction
     * @returns {Knex.QueryBuilder}
     */
    public static updateWhere(where: object, params: object, trx?: Knex.Transaction): Knex.QueryBuilder {
      return db.update(this.getConnection(), this.table, where, params, trx);
    }

    /**
     * Delete a row by primary key.
     *
     * @param {string} pk
     * @param {Transaction} transaction
     * @returns {Knex.QueryBuilder}
     */
    public static removeByPk(pk: string, trx?: Knex.Transaction): Knex.QueryBuilder {
      const pkParams = { [this.pk]: pk };

      return db.remove(this.getConnection(), this.table, pkParams, trx);
    }

    /**
     * Delete row in table.
     *
     * @param {object} params
     * @param {Transaction} trx
     * @returns {Knex.QueryBuilder}
     */
    public static deleteWhere(params: object, trx?: Knex.Transaction): Knex.QueryBuilder {
      return db.remove(this.getConnection(), this.table, params, trx);
    }

    /**
     * Execute raw query.
     *
     * @param {string} sql
     * @param {params} Array
     * @param {Knex.Transaction} trx
     * @returns {Knex.Raw}
     */
    public static raw(sql: string, params?: RawBindingParams | ValueMap, trx?: Knex.Transaction): Knex.Raw {
      return db.raw(this.getConnection(), sql, params, trx);
    }

    /**
     * Returns a query builder instance depending on the provided transaction.
     *
     * @param {Knex} connection
     * @param {Knex.Transaction} [trx]
     * @returns {(Knex.Transaction | Knex)}
     */
    public static queryBuilder(connection: Knex, trx?: Knex.Transaction): Knex.Transaction | Knex {
      return db.queryBuilder(this.getConnection(), trx);
    }

    /**
     * Method to perform a transactional query execution.
     *
     * @param {(trx: Transaction) => any} callback
     * @returns {any}
     */
    public static transaction(callback: (trx: Knex.Transaction) => any): any {
      return this.getConnection().transaction(callback);
    }
  };
}

export const Model = createBaseModel();
