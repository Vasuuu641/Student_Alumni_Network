import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { GeoHelpSpotCategory, GeoHelpSpotReviewStatus, PrismaClient, Role } from '@prisma/client';
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
			return { email: email.toLowerCase(), role } as SeedEntry;
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
			return { email: email.toLowerCase(), role } as SeedEntry;
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

type GeoSpotSeed = {
	title: string;
	description: string;
	city: string;
	address: string;
	latitude: number;
	longitude: number;
	category: GeoHelpSpotCategory;
};

const PECS_SPOTS: GeoSpotSeed[] = [
	{
		title: 'University of Pécs Central Library',
		description: 'Quiet study areas with power outlets and strong wifi.',
		city: 'Pecs',
		address: 'Universitas u., Pécs',
		latitude: 46.074119,
		longitude: 18.206556,
		category: GeoHelpSpotCategory.LIBRARY,
	},
	{
		title: 'Széchenyi Square Student Hangout',
		description: 'Popular city-center meet-up point with cafés nearby.',
		city: 'Pecs',
		address: 'Széchenyi tér, Pécs',
		latitude: 46.072734,
		longitude: 18.232266,
		category: GeoHelpSpotCategory.STUDY_SPACE,
	},
	{
		title: 'Árkád Pécs Food Court',
		description: 'Fast lunch option for students between classes.',
		city: 'Pecs',
		address: 'Bajcsy-Zsilinszky u. 11, Pécs',
		latitude: 46.075347,
		longitude: 18.227004,
		category: GeoHelpSpotCategory.FOOD,
	},
	{
		title: 'Pécs Bus Station',
		description: 'Main transport hub with local and regional connections.',
		city: 'Pecs',
		address: 'Indóház tér, Pécs',
		latitude: 46.066905,
		longitude: 18.228342,
		category: GeoHelpSpotCategory.TRANSPORT,
	},
	{
		title: 'University Sports Hall',
		description: 'Indoor sports and fitness activities for students.',
		city: 'Pecs',
		address: 'Ifjúság útja, Pécs',
		latitude: 46.075892,
		longitude: 18.206848,
		category: GeoHelpSpotCategory.GYM,
	},
];

const shouldSeedGeoHelpBoard = (): boolean => {
	return String(process.env.GEO_HELP_BOARD_SEED ?? '').toLowerCase() === 'true';
};

async function seedGeoHelpBoardSpots(): Promise<number> {
	// Attach seeded spots to any existing student/professor, otherwise fall back to admin.
	const creator = await prisma.user.findFirst({
		where: { role: { in: [Role.STUDENT, Role.PROFESSOR, Role.ADMIN] } },
		orderBy: { createdAt: 'asc' },
	});

	if (!creator) {
		console.log('No existing user found; skipping geo help board seed.');
		return 0;
	}

	for (const spot of PECS_SPOTS) {
		const existing = await prisma.geoHelpSpot.findFirst({
			where: {
				title: spot.title,
				city: spot.city,
			},
			select: { id: true },
		});

		if (existing) {
			await prisma.geoHelpSpot.update({
				where: { id: existing.id },
				data: {
					description: spot.description,
					address: spot.address,
					latitude: spot.latitude,
					longitude: spot.longitude,
					category: spot.category,
					isActive: true,
					reviewStatus: GeoHelpSpotReviewStatus.VERIFIED,
				},
			});
			continue;
		}

		await prisma.geoHelpSpot.create({
			data: {
				title: spot.title,
				description: spot.description,
				city: spot.city,
				address: spot.address,
				latitude: spot.latitude,
				longitude: spot.longitude,
				category: spot.category,
				createdById: creator.id,
				isActive: true,
				reviewStatus: GeoHelpSpotReviewStatus.VERIFIED,
			},
		});
	}

	return PECS_SPOTS.length;
}

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

	if (shouldSeedGeoHelpBoard()) {
		const seededSpots = await seedGeoHelpBoardSpots();
		console.log(`Seeded ${seededSpots} geo help board spot(s) for Pecs.`);
	}
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
