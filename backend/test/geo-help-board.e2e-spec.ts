import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma/prisma.service';

describe('GeoHelpBoard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const studentEmail = `geo-student-${suffix}@tr.pte.hu`;
  const professorEmail = `geo-prof-${suffix}@tr.pte.hu`;
  const alumniEmail = `geo-alumni-${suffix}@tr.pte.hu`;
  const password = 'test1234';

  let studentToken = '';
  let professorToken = '';
  let alumniToken = '';

  let studentUserId = '';
  let professorUserId = '';
  let alumniUserId = '';

  let createdSpotId = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-jwt-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    await seedAuthorizedUsers();
    await registerAndLoginUsers();
  });

  afterAll(async () => {
    if (!prisma) {
      if (app) {
        await app.close();
      }
      return;
    }

    if (createdSpotId) {
      await prisma.geoHelpSpotVisit.deleteMany({ where: { spotId: createdSpotId } });
      await prisma.geoHelpSpot.deleteMany({ where: { id: createdSpotId } });
    }

    const userIds = [studentUserId, professorUserId, alumniUserId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.professor.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.alumni.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.authorizedUser.deleteMany({
      where: {
        email: {
          in: [studentEmail, professorEmail, alumniEmail],
        },
      },
    });

    await app.close();
  });

  it('GET /geo-help-board/spots/popular should return 401 without token', async () => {
    await request(app.getHttpServer())
      .get('/geo-help-board/spots/popular')
      .expect(401);
  });

  it('GET /geo-help-board/spots/popular should return 403 for alumni', async () => {
    await request(app.getHttpServer())
      .get('/geo-help-board/spots/popular')
      .set('Authorization', `Bearer ${alumniToken}`)
      .expect(403);
  });

  it('POST /geo-help-board/spots should create a spot for student', async () => {
    const response = await request(app.getHttpServer())
      .post('/geo-help-board/spots')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Geo E2E Student Spot',
        description: 'Created from e2e test',
        city: 'Pecs',
        address: 'Pecs Test Address',
        latitude: 46.072734,
        longitude: 18.232266,
        category: 'STUDY_SPACE',
      })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.id).toBeDefined();
    expect(response.body.city).toBe('Pecs');
    createdSpotId = response.body.id;
  });

  it('POST /geo-help-board/spots should create a spot for professor', async () => {
    const response = await request(app.getHttpServer())
      .post('/geo-help-board/spots')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({
        title: 'Geo E2E Professor Spot',
        description: 'Professor-created spot',
        city: 'Pecs',
        address: 'Pecs Professor Address',
        latitude: 46.074119,
        longitude: 18.206556,
        category: 'LIBRARY',
      })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.id).toBeDefined();
  });

  it('GET /geo-help-board/spots/popular should return 200 for student', async () => {
    const response = await request(app.getHttpServer())
      .get('/geo-help-board/spots/popular?city=Pecs&limit=10')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('GET /geo-help-board/spots/nearby should return nearby spots with distance', async () => {
    const response = await request(app.getHttpServer())
      .get('/geo-help-board/spots/nearby?latitude=46.072734&longitude=18.232266&radiusKm=5&city=Pecs&limit=10')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].distanceKm).toBeDefined();
  });

  it('POST /geo-help-board/spots/:spotId/visit should record a visit', async () => {
    const response = await request(app.getHttpServer())
      .post(`/geo-help-board/spots/${createdSpotId}/visit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.spotId).toBe(createdSpotId);
  });

  it('GET /geo-help-board/spots/nearby should return 400 for invalid latitude', async () => {
    await request(app.getHttpServer())
      .get('/geo-help-board/spots/nearby?latitude=146&longitude=18.232266&radiusKm=3')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(400);
  });

  async function seedAuthorizedUsers(): Promise<void> {
    await prisma.authorizedUser.upsert({
      where: { email: studentEmail },
      update: { role: 'STUDENT', isUsed: false },
      create: { email: studentEmail, role: 'STUDENT', isUsed: false },
    });

    await prisma.authorizedUser.upsert({
      where: { email: professorEmail },
      update: { role: 'PROFESSOR', isUsed: false },
      create: { email: professorEmail, role: 'PROFESSOR', isUsed: false },
    });

    await prisma.authorizedUser.upsert({
      where: { email: alumniEmail },
      update: { role: 'ALUMNI', isUsed: false },
      create: { email: alumniEmail, role: 'ALUMNI', isUsed: false },
    });
  }

  async function registerAndLoginUsers(): Promise<void> {
    const register = async (email: string, firstName: string, lastName: string) => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, firstName, lastName })
        .expect(201);
      return response.body.id as string;
    };

    const login = async (email: string) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return response.body.accessToken as string;
    };

    studentUserId = await register(studentEmail, 'Geo', 'Student');
    professorUserId = await register(professorEmail, 'Geo', 'Professor');
    alumniUserId = await register(alumniEmail, 'Geo', 'Alumni');

    studentToken = await login(studentEmail);
    professorToken = await login(professorEmail);
    alumniToken = await login(alumniEmail);
  }
});
