# G.2 Technology Versions

Table G.1: Technology versions

| Component | Version |
| --- | --- |
| Node.js | v22.22.3 |
| NestJS | 11.0.1 |
| Prisma | 7.4.2 |
| PostgreSQL with pgvector | 15 (Docker image: `pgvector/pgvector:pg15`) |
| React (web client) | 18.3.1 |
| React Native + Expo SDK | React Native 0.81.5; Expo SDK 54 |
| Tiptap and TenTap | Tiptap 2.27.2; TenTap 1.0.1 |

# G.3 Configuration

The backend reads its configuration from environment variables. Only the names are listed here; the values are secrets and are not included.

Table G.2: Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Database connection string |
| `JWT_SECRET` | Secret used to sign access JSON Web Tokens |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens |
| `COHERE_API_KEY` | Cohere API key for AI embedding and recommendation features |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key used by the mobile app |
| `RESEND_API_KEY` | Resend API key for email delivery |
| `RESEND_FROM_ADDRESS` | Sender address used by the email service |
| `PORT` | Backend listening port (defaults to 3000 if not set) |

# G.4 Local Development Setup

Follow the steps below to run the project locally on a development machine.

## 1. Prerequisites

- Install Node.js 20 or newer (LTS recommended)
- Install npm
- Install Docker Desktop or Docker Engine for the local PostgreSQL container
- Ensure git is available

## 2. Install dependencies

```bash
cd /home/vasu/Student_Alumni_Network/backend
npm install

cd ../web
npm install

cd ../mobile
npm install
```

## 3. Start the PostgreSQL database

The project includes a PostgreSQL + pgvector container configuration in `backend/docker-compose.yml`.

```bash
cd /home/vasu/Student_Alumni_Network/backend
docker compose up -d db
```

## 4. Configure environment variables

Create a `.env` file in the backend project root and add the required variables. The most important ones are:

```env
DATABASE_URL=postgresql://admin_vasu:your_password@localhost:5432/student_network
JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
COHERE_API_KEY=your_cohere_key
RESEND_API_KEY=your_resend_key
RESEND_FROM_ADDRESS="UniBridge <onboarding@resend.dev>"
PORT=3000
```

For the mobile app, create a `.env` file if required by your local setup and include the Google Maps API key:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## 5. Generate Prisma client and initialize the database

```bash
cd /home/vasu/Student_Alumni_Network/backend
npx prisma generate
npx prisma db push
```

If the database is empty and the project requires seed data, run the seed script after the schema is pushed.

## 6. Start the backend

```bash
cd /home/vasu/Student_Alumni_Network/backend
npm run start:dev
```

The backend API will run at:

- http://localhost:3000

## 7. Start the web client

```bash
cd /home/vasu/Student_Alumni_Network/web
npm run dev
```

The web interface will run at the default Vite development URL, usually:

- http://localhost:5173

## 8. Start the mobile app

```bash
cd /home/vasu/Student_Alumni_Network/mobile
npm start
```

Then choose one of the following from Expo:

- `a` to open Android
- `i` to open iOS
- `w` to open the web version

## 9. Useful verification check

After starting the backend, confirm the app is responding:

```bash
curl http://localhost:3000
```

If the app is running correctly, the backend should respond without a connection error.

---

This document summarizes the current project technology stack and the local development workflow used for this repository.
