import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { CohereClient } from 'cohere-ai';
import { config } from 'dotenv';

config(); // load .env

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function reembed() {
  const threads = await prisma.thread.findMany({
    select: { id: true, title: true },
  });

  console.log(`Re-embedding ${threads.length} threads...`);

  for (const thread of threads) {
    try {
      const response = await cohere.embed({
        texts: [thread.title],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
        embeddingTypes: ['float'],
      });

      const embedding = response.embeddings.float[0];
      const vectorLiteral = `[${embedding.join(',')}]`;
      const now = new Date().toISOString();

      await prisma.$queryRawUnsafe(
        `
        INSERT INTO "ThreadEmbedding" (id, "threadId", embedding, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2::vector, $3::timestamp, $3::timestamp)
        ON CONFLICT ("threadId") DO UPDATE
          SET embedding = $2::vector,
              "updatedAt" = $3::timestamp
        `,
        thread.id,
        vectorLiteral,
        now,
      );

      console.log(`Embedded: ${thread.title}`);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`Failed to embed thread ${thread.id}: ${err.message}`);
    }
  }

  console.log('Done.');
  await prisma.$disconnect();
  await pool.end();
}

reembed();