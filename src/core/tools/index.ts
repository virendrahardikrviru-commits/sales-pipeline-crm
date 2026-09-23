/**
 * Universal MCP Tool Factory
 * Generates MCP tools dynamically based on entity configurations
 */

import { AuthManager } from '../auth/index.js';
import { DatabaseManager, EntityConfig } from '../database/index.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

export class ToolFactory {
  constructor(
    private authManager: AuthManager,
    private databaseManager: DatabaseManager
  ) {}

  generateTools(entities: EntityConfig[]): ToolDefinition[] {
    const tools: ToolDefinition[] = [
      {
        name: 'login',
        description: 'Get authentication URL for login',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'save_token',
        description: 'Save authentication token for the current session',
        inputSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token from Kinde authentication'
            }
          },
          required: ['token'],
          additionalProperties: false
        }
      },
      {
        name: 'logout',
        description: 'Log out the current user',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'refresh_billing_status',
        description: 'Check current billing status and usage',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    ];

    // Generate CRUD tools for each entity
    for (const entity of entities) {
      tools.push(...this.generateEntityTools(entity));
    }

    return tools;
  }

  private generateEntityTools(entity: EntityConfig): ToolDefinition[] {
    const entityName = entity.name;
    const capitalizedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);

    return [
      {
        name: `create_${entityName}`,
        description: `Create a new ${entityName}`,
        inputSchema: {
          type: 'object',
          properties: this.generateFieldSchema(entity.fields),
          required: entity.fields.filter(f => f.required).map(f => f.name),
          additionalProperties: false
        }
      },
      {
        name: `list_${entityName}`,
        description: `List all ${entityName}s for the current user`,
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              default: 50,
              description: 'Maximum number of items to return'
            },
            offset: {
              type: 'number',
              default: 0,
              description: 'Number of items to skip'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: `get_${entityName}`,
        description: `Get a specific ${entityName} by ID`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'ID of the item to retrieve'
            }
          },
          required: ['id'],
          additionalProperties: false
        }
      },
      {
        name: `update_${entityName}`,
        description: `Update an existing ${entityName}`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'ID of the item to update'
            },
            ...this.generateFieldSchema(entity.fields)
          },
          required: ['id'],
          additionalProperties: false
        }
      },
      {
        name: `delete_${entityName}`,
        description: `Delete a ${entityName}`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'ID of the item to delete'
            }
          },
          required: ['id'],
          additionalProperties: false
        }
      }
    ];
  }

  private generateFieldSchema(fields: any[]): any {
    const schema: any = {};
    for (const field of fields) {
      schema[field.name] = {
        type: this.getJsonSchemaType(field.type),
        description: `${field.name} field`
      };
      if (field.defaultValue !== undefined) {
        schema[field.name].default = field.defaultValue;
      }
    }
    return schema;
  }

  private getJsonSchemaType(type: string): string {
    switch (type) {
      case 'string':
      case 'text':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'timestamp':
        return 'string';
      default:
        return 'string';
    }
  }

  async executeTool(toolName: string, args: any, userId: string): Promise<any> {
    if (toolName.startsWith('create_')) {
      const entityName = toolName.replace('create_', '');
      return await this.databaseManager.create(entityName, args, userId);
    }
    
    if (toolName.startsWith('list_')) {
      const entityName = toolName.replace('list_', '');
      return await this.databaseManager.list(entityName, userId, args.limit || 50, args.offset || 0);
    }
    
    if (toolName.startsWith('get_')) {
      const entityName = toolName.replace('get_', '');
      return await this.databaseManager.get(entityName, args.id, userId);
    }
    
    if (toolName.startsWith('update_')) {
      const entityName = toolName.replace('update_', '');
      const { id, ...updateData } = args;
      return await this.databaseManager.update(entityName, id, updateData, userId);
    }
    
    if (toolName.startsWith('delete_')) {
      const entityName = toolName.replace('delete_', '');
      return await this.databaseManager.delete(entityName, args.id, userId);
    }
    
    throw new Error(`Unknown tool: ${toolName}`);
  }
}
