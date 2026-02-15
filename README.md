# AI-Powered Student–Alumni Network

An AI-driven platform connecting students and alumni to foster mentorship, academic support, and cross-faculty collaboration. This repository currently contains all planning and documentation for the project, including functional specifications, technical design, and UI/UX mockups.

## Project Status
The project is currently in the **implementation phase**. 

## Features (Planned)
- AI-based smart profile matching between students and alumni
- Academic support workflows
- Secure messaging between students and alumni
- Cross-faculty collaboration tools
- Role-based access (Student, Alumni, Admin)

## Documentation
All project documentation is available in the `docs/` folder as PDF files : 
[Technical Specs](docs/FBN7YM_TECHNICAL_SPECS.pdf)
[Functional Specs](docs/FBNY7YM_Functional_Specs.pdf)

## Project folder structure
This project has been designed to follow a clean architecture model. It has around 5 layers - the domain, application, interfaces, presentation and infrastructure layer for a clean seperation of concerns. 

backend/src/
├── 🏛️ domain/                # Enterprise Logic (Framework-agnostic)
│   ├── entities/            # Core business objects (User, Note, Thread)
│   ├── value-objects/       # Data validation logic (Email, Role)
│   └── repositories/        # Interfaces defining how we talk to data
│
├── ⚙️ application/           # Use Cases (Orchestrates Domain logic)
│   ├── users/               # e.g., create-user.usecase.ts
│   ├── notes/               # e.g., link-note.usecase.ts (AI-assisted)
│   ├── alumni/              # e.g., match-mentor.usecase.ts
│   └── ...                  # (Threads, Study-groups, Chat, Feed)
│
├── 🔌 infrastructure/        # Implementations & External Services
│   ├── database/            # Prisma service and schema
│   ├── repositories/        # Prisma-specific repository implementations
│   ├── ai/                  # Cohere AI integration logic
│   └── websocket/           # Real-time Gateways (Chat & Notifications)
│
├── 🎮 presentation/          # NestJS Controllers & Entry Points
│   ├── [feature]/           # Modules, Controllers, and DTOs
│   └── ...                  # Handles HTTP requests and mapping
│
├── 🔐 auth/                  # Authentication & JWT Strategy
├── 🏁 app.module.ts          # Root module
└── 🚀 main.ts                # Application entry point

Note that this is not the full project but only highlights what the backend folder structure looks like to show the way the clean architecture system design has been implemented. 




