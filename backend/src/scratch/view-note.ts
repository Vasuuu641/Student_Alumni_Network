import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const notes = await prisma.note.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' }
  });

  console.log("LAST 5 NOTES IN DATABASE:");
  for (const n of notes) {
    console.log(`- ID: ${n.id}, Title: "${n.title}", Content Type: ${typeof n.contentJson}`);
    console.log("CONTENT PREVIEW:", JSON.stringify(n.contentJson).slice(0, 300));
    console.log("-----------------------------------------");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
