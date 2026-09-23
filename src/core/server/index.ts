/**
 * Universal MCP Server
 * Configurable MCP server that can handle any entity configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AuthManager, AuthConfig } from '../auth/index.js';
import { DatabaseManager, EntityConfig } from '../database/index.js';
import { ToolFactory, ToolDefinition } from '../tools/index.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Token storage functions
const TOKEN_FILE = join(process.cwd(), '.auth-token');

function saveToken(token: string): void {
  writeFileSync(TOKEN_FILE, token);
}

function getStoredToken(): string | null {
  if (existsSync(TOKEN_FILE)) {
    return readFileSync(TOKEN_FILE, 'utf8');
  }
  return null;
}

function clearToken(): void {
  if (existsSync(TOKEN_FILE)) {
    const fs = require('fs');
    fs.unlinkSync(TOKEN_FILE);
  }
}

export interface AppConfig {
  name: string;
  version: string;
  description: string;
  entities: EntityConfig[];
  auth: AuthConfig;
  database: {
    url: string;
  };
  billing: {
    freeLimit: number;
    entityName: string;
  };
}

export class UniversalMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private databaseManager: DatabaseManager;
  private toolFactory: ToolFactory;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.authManager = new AuthManager(config.auth);
    this.databaseManager = new DatabaseManager(config.database.url);
    this.toolFactory = new ToolFactory(this.authManager, this.databaseManager);
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolFactory.generateTools(this.config.entities);
      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Handle authentication tools
        if (name === 'login') {
          return {
            content: [
              {
                type: 'text',
                text: `Please visit: ${this.config.auth.issuerUrl}/oauth2/auth?client_id=${this.config.auth.clientId}&redirect_uri=${this.config.auth.redirectUrl}&response_type=code&scope=openid profile email offline&state=login`
              }
            ]
          };
        }

        if (name === 'save_token') {
          saveToken(args.token);
          return {
            content: [
              {
                type: 'text',
                text: 'Token saved successfully!'
              }
            ]
          };
        }

        if (name === 'logout') {
          clearToken();
          return {
            content: [
              {
                type: 'text',
                text: 'Logged out successfully!'
              }
            ]
          };
        }

        if (name === 'refresh_billing_status') {
          const token = getStoredToken();
          if (!token) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ No authentication token found. Please login first.'
                }
              ]
            };
          }

          // Decode and validate JWT token
          let decoded;
          try {
            decoded = jwt.decode(token) as any;
            if (!decoded || !decoded.sub) {
              return {
                content: [
                  {
                    type: 'text',
                    text: '❌ Invalid token format. Please login again.'
                  }
                ]
              };
            }
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ Error decoding token. Please login again.'
                }
              ]
            };
          }

          const billingStatus = await this.authManager.getBillingStatus(decoded.sub, token);
          
          return {
            content: [
              {
                type: 'text',
                text: `📊 Billing Status:\nPlan: ${billingStatus.plan}\nFeatures: ${JSON.stringify(billingStatus.features)}\nCan Create: ${billingStatus.canCreate}\nReason: ${billingStatus.reason || 'N/A'}`
              }
            ]
          };
        }

        // Handle CRUD operations
        const token = getStoredToken();
        if (!token) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ No authentication token found. Please login first.'
              }
            ]
          };
        }

        // Decode and validate JWT token
        let decoded;
        try {
          decoded = jwt.decode(token) as any;
          if (!decoded || !decoded.sub) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ Invalid token format. Please login again.'
                }
              ]
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Error decoding token. Please login again.'
              }
            ]
          };
        }

        const userId = decoded.sub;

        // Check billing status for create operations
        if (name.startsWith('create_')) {
          const billingStatus = await this.authManager.getBillingStatus(userId, token);
          if (!billingStatus.canCreate) {
            return {
              content: [
                {
                  type: 'text',
                  text: `❌ ${billingStatus.reason}\n\nPlease upgrade your plan at: ${this.config.auth.issuerUrl}/portal`
                }
              ]
            };
          }
        }

        // Execute CRUD operation
        const result = await this.toolFactory.executeTool(name, args, userId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ]
        };
      }
    });
  }

  async initializeDatabase(): Promise<void> {
    await this.databaseManager.setupDatabase(this.config.entities);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log(`🚀 ${this.config.name} MCP server starting...`);
    console.log(`📋 Available entities: ${this.config.entities.map(e => e.name).join(', ')}`);
    console.log(`🔧 Available tools: ${this.toolFactory.generateTools(this.config.entities).map(t => t.name).join(', ')}`);
    console.log(`${this.config.name} MCP server running on stdio`);
  }
}

export function createMCPServer(config: AppConfig): UniversalMCPServer {
  return new UniversalMCPServer(config);
}
