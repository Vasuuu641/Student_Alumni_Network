import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

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

const getSeedEntries = (): SeedEntry[] => {
	const fromEnv = parseAuthorizedEmails(process.env.AUTHORIZED_EMAILS ?? '');
	if (fromEnv.length > 0) {
		return fromEnv;
	}

	// Add default placeholders if needed, or leave empty to avoid seeding.
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
	});
