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
  get notification() { return (this.client as any).notification; }
  get notificationDelivery() { return (this.client as any).notificationDelivery; }
  get notificationPreference() { return (this.client as any).notificationPreference; }
  get userInterestProfile() { return (this.client as any).userInterestProfile; }
  get userInterestSignal() { return (this.client as any).userInterestSignal; }
  get notificationCandidate() { return (this.client as any).notificationCandidate; }
  get thread() { return this.client.thread; }
  get threadReply() { return this.client.threadReply; }
  get threadVote() { return this.client.threadVote; }
  get threadReplyVote() { return this.client.threadReplyVote; }
  get noteChunk() { return this.client.noteChunk; }
  get noteChunkEmbedding() { return this.client.noteChunkEmbedding; }
  get noteThreadLink() { return this.client.noteThreadLink; }
  get threadEmbedding() { return this.client.threadEmbedding; }
  get studyGroup() { return this.client.studyGroup; }
  get studyGroupMember() { return this.client.studyGroupMember; }
  get studyGroupUserArchive() { return (this.client as any).studyGroupUserArchive; }
  get studyGroupPost() { return this.client.studyGroupPost; }
  get studyGroupInvite() { return (this.client as any).studyGroupInvite; }
  get studyGroupJoinRequest() { return (this.client as any).studyGroupJoinRequest; }
  get geoHelpSpot() { return this.client.geoHelpSpot; }
  get geoHelpSpotVisit() { return this.client.geoHelpSpotVisit; }
  
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

  async $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => fn(tx as PrismaClient));
  }

  async $executeRaw(query: TemplateStringsArray, ...values: any[]): Promise<number> {
  return this.client.$executeRaw(query, ...values);
  }

  async $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T> {
    return this.client.$queryRawUnsafe<T>(query, ...values);
  }

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