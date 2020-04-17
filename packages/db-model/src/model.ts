import * as Knex from 'knex';
import * as debug from 'debug';
import { QueryBuilder, Transaction } from 'knex';

import * as db from './db';
import { NS_MODEL } from './constants';
import * as object from './utils/object';
import RowNotFoundError from './RowNotFoundError';
import PaginationParams from './domain/PaginationParams';
import { buildPages } from './utils/pagination';

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
    public static defaultOrderBy: string;
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
     * Finds a single record based on the params.
     *
     * @param {object} [params={}]
     * @param {Knex.Transaction} trx
     * @throws {RowNotFoundError}
     * @returns {Promise<T>}
     */
    public static findFirst<T>(params: object = {}, trx?: Knex.Transaction): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        const [result] = await db.findFirst<T>(this.getConnection(), this.table, params, this.defaultOrderBy, trx);

        if (result) {
          resolve(result);
        } else {
          reject(new RowNotFoundError('No row found with the given parameters.'));
        }
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
      return new Promise<T>(async (resolve, reject) => {
        const qb = db.find<T>(this.getConnection(), this.table, params, this.defaultOrderBy, trx);

        const countQb = qb.clone();
        const count = await countQb.clearSelect().clearOrder().count('*');

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
  };
}

export const Model = createBaseModel();
