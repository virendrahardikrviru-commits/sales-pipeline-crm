# CRM Application

A customer relationship management system

## Features

- ✅ Authentication with Kinde
- ✅ Database with Neon PostgreSQL
- ✅ Billing system with free tier
- ✅ MCP protocol integration
- ✅ CRUD operations for: contacts, deals, tasks

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Setup database:
   ```bash
   npm run setup-db
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

## Available Tools

- create_contacts
- list_contacts
- get_contacts
- update_contacts
- delete_contacts
- create_deals
- list_deals
- get_deals
- update_deals
- delete_deals
- create_tasks
- list_tasks
- get_tasks
- update_tasks
- delete_tasks

## Configuration

Edit `src/app-config.ts` to customize your application.
