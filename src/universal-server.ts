/**
 * Universal MCP Server Entry Point
 * This is the main file for your MCP application
 */

import dotenv from 'dotenv';
import { createMCPServer } from './core/server';
import { appConfig } from './app-config';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting sales-pipeline-crm MCP server...');

  // Create and initialize the MCP server
  const server = createMCPServer(appConfig);
  
  try {
    // Initialize database schema
    await server.initializeDatabase();
    
    // Start the server
    await server.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
