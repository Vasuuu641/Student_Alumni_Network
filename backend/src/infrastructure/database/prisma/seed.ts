import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
	adapter,
});

type SeedEntry = { email: string; role: Role };

const parseAuthorizedEmails = (raw: string): SeedEntry[] => {
	if (!raw) {
		return [];
	}

	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [email, rolePart] = entry.split(':').map((v) => v.trim());
			const role = (rolePart as Role) ?? Role.STUDENT;
			return { email, role } as SeedEntry;
		})
		.filter((entry) => entry.email.includes('@'));
};

const parseAuthorizedEmailsFile = (filePath: string): SeedEntry[] => {
	if (!fs.existsSync(filePath)) {
		return [];
	}

	const contents = fs.readFileSync(filePath, 'utf8');
	return contents
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'))
		.map((line) => {
			const [email, rolePart] = line.split(':').map((v) => v.trim());
			const role = (rolePart as Role) ?? Role.STUDENT;
			return { email, role } as SeedEntry;
		})
		.filter((entry) => entry.email.includes('@'));
};

const getSeedEntries = (): SeedEntry[] => {
	const defaultFile = path.resolve(process.cwd(), 'authorized-emails.txt');
	const filePath = process.env.AUTHORIZED_EMAILS_FILE ?? defaultFile;
	const fromFile = parseAuthorizedEmailsFile(filePath);
	if (fromFile.length > 0) {
		return fromFile;
	}

	const fromEnv = parseAuthorizedEmails(process.env.AUTHORIZED_EMAILS ?? '');
	if (fromEnv.length > 0) {
		return fromEnv;
	}

	return [];
};

async function main() {
	const entries = getSeedEntries();
	if (entries.length === 0) {
		console.log('No authorized users provided. Skipping seed.');
		return;
	}

	for (const entry of entries) {
		await prisma.authorizedUser.upsert({
			where: { email: entry.email },
			update: { role: entry.role },
			create: {
				email: entry.email,
				role: entry.role,
				isUsed: false,
			},
		});
	}

	console.log(`Seeded ${entries.length} authorized user(s).`);
}

main()
	.catch((error) => {
		console.error('Seed failed:', error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
		await pool.end();
	});
