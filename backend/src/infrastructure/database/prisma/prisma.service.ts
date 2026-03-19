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
  get alumni() { return this.client.alumni; }
  get professor() { return this.client.professor; }
  get authorizedUser() { return this.client.authorizedUser; }
  get note() { return this.client.note; }
  get noteCollaborator() { return this.client.noteCollaborator; }
  get noteActivity() { return this.client.noteActivity; }
  get noteVersion() { return this.client.noteVersion; }
  get revokedToken() { return this.client.revokedToken; }
  get thread() { return this.client.thread; }
  get threadReply() { return this.client.threadReply; }
  get threadVote() { return this.client.threadVote; }
  get threadReplyVote() { return this.client.threadReplyVote; }
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

    // Development diagnostics:
    // If data appears to "disappear" after restart, these logs confirm
    // exactly which database instance this process is connected to.
    try {
      const dbMeta = await this.client.$queryRawUnsafe<
        Array<{ db: string; host: string | null; port: number | null }>
      >(
        'select current_database() as db, inet_server_addr()::text as host, inet_server_port() as port',
      );
      const noteCount = await this.client.note.count();
      const meta = dbMeta[0] ?? { db: 'unknown', host: null, port: null };

      console.log(
        `✓ Database connection established (db=${meta.db} host=${meta.host ?? 'local-socket'} port=${meta.port ?? 'n/a'} notes=${noteCount})`,
      );
    } catch {
      console.log('✓ Database connection established');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    await this.pool.end();
  }
}