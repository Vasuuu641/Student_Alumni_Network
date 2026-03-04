import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private client: PrismaClient;

  // Expose models directly so existing code (this.prisma.student) still works
  get student() { return this.client.student; }
  get user() { return this.client.user; }
  // add other models you have here...

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    this.client = new PrismaClient({ adapter });
    this.pool = pool;
  }

  async $connect() { return this.client.$connect(); }
  async $disconnect() { return this.client.$disconnect(); }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    console.log('✓ Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    await this.pool.end();
  }
}