# AI-Powered Student–Alumni Network

An AI-driven platform connecting students and alumni to foster mentorship, academic support, and cross-faculty collaboration. This repository currently contains all planning and documentation for the project, including functional specifications, technical design, and UI/UX mockups.

## 🚀 Project Status
The project is currently in the **implementation phase**. 

## ✨ Features (Planned)
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