import * as Knex from 'knex';
import * as debug from 'debug';

import * as db from './db';
import { NS_MODEL } from './constants';
import PaginationParams from './domain/PaginationParams';
import { buildPages } from './utils/pagination';
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
    public static defaultOrderBy = 'id';
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
     * @returns {Promise<T>}
     */
    public static findFirst<T>(params: object = {}, trx?: Knex.Transaction): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        const [result] = await db.findFirst<T>(this.getConnection(), this.table, params, this.defaultOrderBy, trx);

        resolve(result);
      });
    }

    /**
     * Find by primary key
     *
     * @param {string} pk
     * @param {Knex.Transaction} trx
     * @returns {Promise<T>}
     */
    public static findByPk<T>(pk: string, trx?: Knex.Transaction): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        const pkParams: { [key: string]: any } = {};
        pkParams[this.pk] = pk;

        const [result] = await db.findFirst<T>(this.getConnection(), this.table, pkParams, this.defaultOrderBy, trx);

        resolve(result);
      });
    }

    /**
     * Finds records based on the params.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @returns {Promise<T>}
     */
    public static find<T>(params: object = {}, trx?: Knex.Transaction): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        const result = await db.find<T>(this.getConnection(), this.table, params, this.defaultOrderBy, trx);

        resolve(result);
      });
    }

    /**
     * Finds records based on the params with records limit.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @throws {ModelNotFoundError}
     * @returns {Promise<T>}
     */
    public static findWithPagination<T>(
      params: object = {},
      pageParams: PaginationParams,
      trx?: Knex.Transaction
    ): Promise<T> {
      return new Promise<any>(async (resolve, reject) => {
        const qb = db.find<T>(this.getConnection(), this.table, params, this.defaultOrderBy, trx);

        const countQb = qb.clone();
        const countResult = await countQb.clearSelect().clearOrder().count('*');
        const count = countResult[0].count;

        const offset = (pageParams.page - 1) * pageParams.pageSize;
        const records = await qb.offset(offset).limit(pageParams.pageSize);

        const result = {
          totalCount: count,
          maxRows: pageParams.pageSize,

          pages: buildPages(pageParams.page, pageParams.pageSize, count),

          results: records
        };

        resolve(result);
      });
    }

    /**
     * Insert all records sent in data object.
     *
     * @param {(object | object[])} data
     * @param {Transaction} [trx]
     * @returns {Promise<T[]>}
     */
    public static insert<T>(data: object | object[], trx?: Knex.Transaction): Promise<T[]> {
      return db.insert<T>(this.getConnection(), this.table, data, trx);
    }

    /**
     * Update records by primary key.
     *
     * @param {string} pk
     * @param {any} params
     * @param {Transaction} transaction
     * @returns {Knex.QueryBuilder}
     */
    public static updateByPk<T>(pk: string, params: object, trx?: Knex.Transaction): Promise<T[]> {
      const pkParams: { [key: string]: any } = {};
      pkParams[this.pk] = pk;

      return db.update<T>(this.getConnection(), this.table, pkParams, params, trx);
    }

    /**
     * Update records by where condition.
     *
     * @param {object} where
     * @param {any} params
     * @param {Transaction} transaction
     * @returns {Knex.QueryBuilder}
     */
    public static updateWhere<T>(where: object, params: object, trx?: Knex.Transaction): Promise<T[]> {
      return db.update<T>(this.getConnection(), this.table, where, params, trx);
    }

    /**
     * Delete a row by primary key.
     *
     * @param {string} pk
     * @param {Transaction} transaction
     * @returns {Knex.QueryBuilder}
     */
    public static deleteByPk<T>(pk: string, trx?: Knex.Transaction): Promise<T[]> {
      const pkParams: { [key: string]: any } = {};
      pkParams[this.pk] = pk;

      return db.remove<T>(this.getConnection(), this.table, pkParams, trx);
    }

    /**
     * Delete row in table.
     *
     * @param {object} params
     * @param {Transaction} trx
     * @returns {Promise<T[]>}
     */
    public static deleteWhere<T>(params: object, trx?: Knex.Transaction): Promise<T[]> {
      return db.remove<T>(this.getConnection(), this.table, params, trx);
    }

    /**
     * Execute raw query.
     *
     * @param {string} sql
     * @param {params} Array
     * @param {Knex.Transaction} trx
     * @returns {Knex.QueryBuilder}
     */
    public static query<T>(sql: string, params?: RawBindingParams | ValueMap, trx?: Knex.Transaction): Promise<T[]> {
      return db.query<T>(this.getConnection(), sql, params, trx);
    }
  };
}

export const Model = createBaseModel();
