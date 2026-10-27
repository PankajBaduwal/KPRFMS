import mongoose, { Connection, Model, Schema } from 'mongoose';
import { requireTenant } from './context.js';
import { isTenantDbName, platformDbName } from './dbNames.js';

/**
 * Tenant-aware models.
 *
 * Every institutional model file exports `tenantModel(name, schema)` instead of
 * `mongoose.model(name, schema)`. The export is a proxy: each use (User.find, new User(...),
 * Publication.aggregate, ...) is routed to the model compiled on the *current tenant's* database,
 * which shares the single connection pool through `useDb`. Existing services keep importing and
 * using models exactly as before. With no tenant context the call fails closed — there is no
 * default database.
 */

const tenantSchemas = new Map<string, Schema>();
const prepared = new WeakSet<Connection>();

function connectionFor(dbName: string): Connection {
  return mongoose.connection.useDb(dbName, { useCache: true });
}

/** The current tenant's database connection (all tenant models registered on it). */
export function tenantConnection(): Connection {
  const { dbName } = requireTenant();
  // Defence in depth: the context can only hold registry-generated names, but never touch others
  if (!isTenantDbName(dbName)) throw new Error(`Refusing to use non-tenant database "${dbName}"`);
  const conn = connectionFor(dbName);
  if (!prepared.has(conn)) {
    // Register every tenant schema so populate() refs resolve inside the same tenant
    for (const [name, schema] of tenantSchemas) if (!conn.models[name]) conn.model(name, schema);
    prepared.add(conn);
  }
  return conn;
}

/** The platform database (institution registry, platform accounts, platform audit). */
export function platformConnection(): Connection {
  return connectionFor(platformDbName());
}

function modelProxy<M>(resolve: () => Model<any>): M {
  // A function target so `new Model()` and typeof checks behave like a real model
  const target = function TenantModel() {} as unknown as object;
  return new Proxy(target, {
    get(_t, prop) {
      const model = resolve() as any;
      const value = model[prop];
      return typeof value === 'function' && prop !== 'prototype' ? value.bind(model) : value;
    },
    set(_t, prop, value) {
      (resolve() as any)[prop] = value;
      return true;
    },
    has(_t, prop) {
      return prop in (resolve() as any);
    },
    construct(_t, args) {
      const Ctor = resolve() as unknown as new (...a: unknown[]) => object;
      return new Ctor(...args);
    },
    apply(_t, _this, args) {
      return (resolve() as any)(...args);
    },
  }) as M;
}

export function tenantModel<T, M extends Model<any> = Model<T>>(name: string, schema: Schema): M {
  if (tenantSchemas.has(name)) throw new Error(`Tenant model "${name}" registered twice`);
  tenantSchemas.set(name, schema);
  return modelProxy<M>(() => {
    const conn = tenantConnection();
    // A model file imported after this connection was prepared is registered on first use
    return conn.models[name] ?? conn.model(name, schema);
  });
}

/** Names of all tenant models (used to build indexes when a tenant is provisioned). */
export function tenantModelNames(): string[] {
  return [...tenantSchemas.keys()];
}

const platformSchemas = new Map<string, Schema>();

export function platformModel<T, M extends Model<any> = Model<T>>(name: string, schema: Schema): M {
  platformSchemas.set(name, schema);
  return modelProxy<M>(() => {
    const conn = platformConnection();
    return conn.models[name] ?? conn.model(name, platformSchemas.get(name)!);
  });
}
