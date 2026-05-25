# UniBridge - AI-Powered Student–Alumni Network

UniBridge is an AI-driven platform connecting students and alumni to foster mentorship, academic support, and cross-faculty collaboration. 

## 🚀 Project Status
The project is currently in the **implementation phase**. 

## ✨ Features
- **AI-Smart Matching:** Intelligent profile matching between students and alumni.
- **Academic Support:** Workflows for resource sharing and study assistance.
- **Secure Communication:** Real-time messaging and chat rooms.
- **Cross-Faculty Tools:** Collaboration features for interdisciplinary projects.
- **Role-Based Access:** Managed access for Students, Alumni, and Admins.

## 📚 Documentation
Detailed project documentation is available in the `docs/` folder:
- 📄 [Technical Specifications](docs/FBN7YM_Updated_Technical_Specs.pdf)
- 📋 [Functional Specifications](docs/FBN7YM_Updated_Functional.pdf)

---

## 🏗️ Architecture & Folder Structure

This project implements **Clean Architecture** (Hexagonal Architecture) to ensure a strict separation of concerns. This design keeps core business logic independent of frameworks, databases, and UI.



```text
backend/src/
├── 🏛️ domain/            # Core Business Logic (Framework-agnostic)
│   ├── entities/        # Enterprise-wide business objects (User, Note, etc.)
│   ├── value-objects/   # Domain-specific data types (Email, Role, Location)
│   └── repositories/    # Interface definitions (Contracts for data access)
│
├── ⚙️ application/       # Use Cases (Orchestrates Domain logic)
│   ├── users/           # User management & profile logic
│   ├── notes/           # AI-assisted note linking & sharing
│   ├── alumni/          # Mentorship matching & advice (AI-powered)
│   └── ...              # Threads, Study-groups, Chat, Feed
│
├── 🔌 infrastructure/    # External Implementations & Tools
│   ├── database/        # Prisma Service & Schema definition
│   ├── repositories/    # Concrete Prisma repository implementations
│   ├── ai/              # Cohere AI Service integration
│   └── websocket/       # Socket.io Gateways for Chat & Notifications
│
├── 🎮 presentation/      # NestJS Delivery Layer (API)
│   ├── [feature]/       # Modules, Controllers, and DTOs
│   └── ...              # Maps HTTP requests to Application Use Cases
│
├── 🔐 auth/              # Authentication & JWT Strategy logic
├── 🏁 app.module.ts      # Root application module
└── 🚀 main.ts            # Application entry point

```

## 🛰️ Unidirectional Dependency Flow

To maintain a **decoupled codebase**, dependencies only point inwards:
    Domain (Core logic) - this is where the core logic is defined - inner most layer.

    Application (Use Cases) executes logic using Domain entities.

    Presentation (Controllers) receives the request and triggers a Use Case.

    Infrastructure (Prisma/Cohere) handles technical implementation of the interfaces defined in the Domain.

    Note: The structure above highlights the backend organization specifically to demonstrate the system design implementation.

## 🔐 Security Architecture

UniBridge handles sensitive academic data across three distinct user roles — 
students, alumni, and admins. Key security decisions:

- **Authentication**: JWT-based auth with refresh token rotation and 
  secure httpOnly cookie storage
- **Role-Based Access Control**: Strict permission boundaries between 
  student, alumni, professors and admin roles enforced at the application layer, 
  not just the presentation layer
- **Rate Limiting**: AI inference endpoints protected against abuse 
  with per-user rate limiting on the Cohere embeddings service — 
  preventing cost exploitation and ensuring fair usage across the platform
- **Input Validation**: DTO-level validation on all incoming requests 
  via NestJS pipes before reaching application or domain layers
- **Secure Communication**: WebSocket connections authenticated via 
  JWT handshake before establishing real-time channels

## 🤖 AI Design Considerations

The platform uses Cohere's embeddings model to semantically connect 
notes and discussion threads, surfacing relevant content to users 
contextually. This introduced non-trivial design challenges:

- **Cost control**: Embedding generation is expensive at scale. 
  Rate limiting and caching strategies were implemented to prevent 
  runaway API costs while maintaining responsiveness
- **Privacy**: Embeddings are generated per-user and stored with 
  strict ownership boundaries — a student's notes are never used 
  to generate recommendations for another user without explicit sharing
- **Relevance vs. privacy tradeoff**: The AI matching feature required 
  careful scoping to ensure cross-faculty collaboration suggestions 
  don't leak private academic content across role boundaries

Other features that use the same semantic search capabilities include:
- **Mentorship Matching**: AI-powered matching between students and alumni based on profiles and interests
- **Discussion Thread Linking**: Cohere embeddings are also used to link related discussion threads to each other to avoid users having to add discussions that already exist thus preventing repetition within the platform.
- **Feed Personalization**: AI-driven content ranking in the user feed based on interaction history and preferences to provide notifications about relevant discussions and forward content to users based on their interests and interactions within the platform.
- **Study group reccommendations**: AI suggests study groups to students based on their course enrollments and academic interests, fostering cross-faculty collaboration.

## 🚀 Project Status

Currently in active implementation as part of a final-year thesis project 
at the University of Pécs. Core backend architecture and authentication 
are implemented. AI note-linking, study groups, and geo-based features 
are in progress.
