/**
 * Database Setup Script
 * Initializes database schema for your MCP application
 */

import { createMCPServer } from './core/server';
import { appConfig } from './app-config';

async function setupDatabase() {
  console.log('🚀 Setting up database for your application...');

  try {
    const server = createMCPServer(appConfig);
    await server.initializeDatabase();
    console.log('✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
