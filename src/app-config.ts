import dotenv from 'dotenv';
import { AppConfig } from './core/server';
import { EntityConfig } from './core/database';

// Load environment variables first
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'KINDE_ISSUER_URL', 
  'KINDE_CLIENT_ID',
  'KINDE_CLIENT_SECRET',
  'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const contactsEntity: EntityConfig = {
  name: 'contactss',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'text' },
    { name: 'created_at', type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_contactss_created_at ON contactss(created_at)'
  ]
};

const dealsEntity: EntityConfig = {
  name: 'dealss',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'text' },
    { name: 'created_at', type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_dealss_created_at ON dealss(created_at)'
  ]
};

const tasksEntity: EntityConfig = {
  name: 'taskss',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'text' },
    { name: 'created_at', type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_taskss_created_at ON taskss(created_at)'
  ]
};

export const appConfig: AppConfig = {
  name: 'sales-pipeline-crm-mcp-server',
  version: '1.0.0',
  description: 'A customer relationship management system',
  entities: [contactsEntity, dealsEntity, tasksEntity],
  auth: {
    issuerUrl: process.env.KINDE_ISSUER_URL!,
    clientId: process.env.KINDE_CLIENT_ID!,
    clientSecret: process.env.KINDE_CLIENT_SECRET!,
    redirectUrl: 'http://localhost:3000/callback',
    logoutRedirectUrl: 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET!
  },
  database: {
    url: process.env.DATABASE_URL!
  },
  billing: {
    freeLimit: 10,
    entityName: 'contactss'
  }
};
