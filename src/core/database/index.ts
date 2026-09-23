/**
 * Database Manager
 * Handles database operations and schema management
 */

import { neon } from '@neondatabase/serverless';

export interface EntityConfig {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    defaultValue?: any;
  }>;
  indexes?: string[];
}

export class DatabaseManager {
  private sql: any;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async setupDatabase(entities: EntityConfig[]): Promise<void> {
    // Create users table
    await this.sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        name TEXT,
        email TEXT,
        subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'cancelled')),
        plan TEXT DEFAULT 'free',
        free_todos_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create entity tables
    for (const entity of entities) {
      await this.createEntityTable(entity);
    }
  }

  private async createEntityTable(entity: EntityConfig): Promise<void> {
    const fields = entity.fields.map(field => {
      let fieldDef = `${field.name} ${this.getSqlType(field.type)}`;
      if (field.required) fieldDef += ' NOT NULL';
      if (field.defaultValue !== undefined) {
        fieldDef += ` DEFAULT ${field.defaultValue === 'CURRENT_TIMESTAMP' ? 'CURRENT_TIMESTAMP' : `'${field.defaultValue}'`}`;
      }
      return fieldDef;
    }).join(', ');

    // Check if created_at and updated_at are already defined in entity fields
    const hasCreatedAt = entity.fields.some(field => field.name === 'created_at');
    const hasUpdatedAt = entity.fields.some(field => field.name === 'updated_at');

    let additionalFields = '';
    if (!hasCreatedAt) {
      additionalFields += ', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    }
    if (!hasUpdatedAt) {
      additionalFields += ', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    }

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${entity.name} (
        id SERIAL PRIMARY KEY,
        ${fields},
        user_id TEXT NOT NULL${additionalFields}
      )
    `;

    await this.sql(createTableSQL);

    // Create indexes
    if (entity.indexes) {
      for (const index of entity.indexes) {
        await this.sql(index);
      }
    }
  }

  private getSqlType(type: string): string {
    switch (type) {
      case 'string': return 'TEXT';
      case 'text': return 'TEXT';
      case 'number': return 'INTEGER';
      case 'boolean': return 'BOOLEAN';
      case 'timestamp': return 'TIMESTAMP';
      default: return 'TEXT';
    }
  }

  async create(entityName: string, data: any, userId: string): Promise<any> {
    const result = await this.sql`
      INSERT INTO ${entityName} (${Object.keys(data).join(', ')}, user_id)
      VALUES (${Object.values(data).join(', ')}, ${userId})
      RETURNING *
    `;
    return result[0];
  }

  async list(entityName: string, userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    return await this.sql`
      SELECT * FROM ${entityName}
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async get(entityName: string, id: number, userId: string): Promise<any> {
    const result = await this.sql`
      SELECT * FROM ${entityName}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return result[0];
  }

  async update(entityName: string, id: number, data: any, userId: string): Promise<any> {
    const setClause = Object.keys(data).map(key => `${key} = ${data[key]}`).join(', ');
    const result = await this.sql`
      UPDATE ${entityName}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    return result[0];
  }

  async delete(entityName: string, id: number, userId: string): Promise<boolean> {
    const result = await this.sql`
      DELETE FROM ${entityName}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return result.length > 0;
  }
}
