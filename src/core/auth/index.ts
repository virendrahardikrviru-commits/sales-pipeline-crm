/**
 * Authentication Manager
 * Handles Kinde authentication and JWT verification
 */

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-client';

export interface AuthConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  logoutRedirectUrl: string;
  jwtSecret: string;
}

export class AuthManager {
  private sql: any;
  private jwksClient: any;

  constructor(config: AuthConfig) {
    this.sql = neon(process.env.DATABASE_URL!);
    
    this.jwksClient = jwksClient({
      jwksUri: `${config.issuerUrl}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid token format');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getBillingStatus(userId: string, accessToken: string): Promise<{ plan: string; features: any; canCreate: boolean; reason?: string }> {
    try {
      const decoded = jwt.decode(accessToken) as any;
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid token format');
      }
      
      const subscription = await this.sql`
        SELECT * FROM users 
        WHERE user_id = ${userId}
      `;

      if (subscription.length === 0) {
        await this.sql`
          INSERT INTO users (user_id, name, email, subscription_status, plan, free_todos_used)
          VALUES (${userId}, ${decoded.given_name || decoded.name || 'User'}, ${decoded.email || 'user@example.com'}, 'free', 'free', 0)
        `;
      }

      const freeTodosUsed = subscription.length > 0 ? subscription[0].free_todos_used : 0;
      
      if (freeTodosUsed < 10) {
        return {
          plan: 'free',
          features: { maxTodos: 10, used: freeTodosUsed },
          canCreate: true,
          reason: `Free tier - ${10 - freeTodosUsed} items remaining`
        };
      }
      
      return {
        plan: 'free',
        features: { maxTodos: 10, used: freeTodosUsed },
        canCreate: false,
        reason: 'You have used your free items. Please upgrade your plan to create more.'
      };
    } catch (error) {
      console.error('Error checking billing:', error);
      return {
        plan: 'free',
        features: { maxTodos: 10 },
        canCreate: false,
        reason: 'Error checking billing status'
      };
    }
  }
}
