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

backend/
└─ src/
   ├─ domain/                     # Pure business rules, no framework
   │   ├─ entities/
   │   │   ├─ user.entity.ts
   │   │   ├─ note.entity.ts
   │   │   ├─ thread.entity.ts
   │   │   ├─ study-group.entity.ts
   │   │   ├─ alumni.entity.ts
   │   │   ├─ chat-room.entity.ts
   │   │   ├─ message.entity.ts
   │   │   └─ feed-item.entity.ts
   │   │
   │   ├─ value-objects/
   │   │   ├─ email.vo.ts
   │   │   ├─ role.vo.ts
   │   │   └─ location.vo.ts
   │   │
   │   └─ repositories/           # Interfaces only
   │       ├─ user.repository.ts
   │       ├─ note.repository.ts
   │       ├─ thread.repository.ts
   │       ├─ study-group.repository.ts
   │       ├─ alumni.repository.ts
   │       ├─ chat.repository.ts
   │       └─ feed.repository.ts
   │
   ├─ application/                # Use cases / orchestration
   │   ├─ users/
   │   │   ├─ create-user.usecase.ts
   │   │   ├─ find-user.usecase.ts
   │   │   └─ update-user-role.usecase.ts
   │   │
   │   ├─ notes/
   │   │   ├─ create-note.usecase.ts
   │   │   ├─ update-note.usecase.ts
   │   │   ├─ link-note.usecase.ts          # AI-assisted topic linking
   │   │   └─ share-note.usecase.ts
   │   │
   │   ├─ threads/
   │   │   ├─ create-thread.usecase.ts
   │   │   ├─ answer-thread.usecase.ts
   │   │   └─ route-thread.usecase.ts       # Route query to best responder
   │   │
   │   ├─ study-groups/
   │   │   ├─ form-group.usecase.ts         # Auto study group
   │   │   └─ join-group.usecase.ts
   │   │
   │   ├─ alumni/
   │   │   ├─ match-mentor.usecase.ts       # AI-powered mentorship
   │   │   └─ get-advice.usecase.ts
   │   │
   │   ├─ chat/
   │   │   ├─ send-message.usecase.ts
   │   │   ├─ get-messages.usecase.ts
   │   │   └─ join-room.usecase.ts
   │   │
   │   └─ feed/
   │       └─ get-feed.usecase.ts           # Personalized campus feed
   │
   ├─ infrastructure/             # Implementations / external services
   │   ├─ database/
   │   │   └─ prisma/
   │   │       ├─ prisma.module.ts
   │   │       ├─ prisma.service.ts
   │   │       └─ schema.prisma            # User, Notes, Threads, StudyGroups, Chat, Feed
   │   │
   │   ├─ repositories/
   │   │   ├─ prisma-user.repository.ts
   │   │   ├─ prisma-note.repository.ts
   │   │   ├─ prisma-thread.repository.ts
   │   │   ├─ prisma-study-group.repository.ts
   │   │   ├─ prisma-alumni.repository.ts
   │   │   ├─ prisma-chat.repository.ts
   │   │   └─ prisma-feed.repository.ts
   │   │
   │   ├─ ai/
   │   │   └─ cohere/
   │   │       ├─ cohere.module.ts
   │   │       └─ cohere.service.ts
   │   │
   │   └─ websocket/
   │       ├─ chat.gateway.ts
   │       └─ notifications.gateway.ts     # Real-time notifications
   │
   ├─ presentation/               # NestJS interface layer
   │   ├─ users/
   │   │   ├─ users.module.ts
   │   │   ├─ users.controller.ts
   │   │   └─ dto/
   │   │       └─ create-user-request.dto.ts
   │   │
   │   ├─ notes/
   │   │   ├─ notes.module.ts
   │   │   ├─ notes.controller.ts
   │   │   └─ dto/
   │   │       └─ create-note-request.dto.ts
   │   │
   │   ├─ threads/
   │   │   ├─ threads.module.ts
   │   │   ├─ threads.controller.ts
   │   │   └─ dto/
   │   │       └─ create-thread-request.dto.ts
   │   │
   │   ├─ study-groups/
   │   │   ├─ study-groups.module.ts
   │   │   ├─ study-groups.controller.ts
   │   │   └─ dto/
   │   │       └─ join-group-request.dto.ts
   │   │
   │   ├─ alumni/
   │   │   ├─ alumni.module.ts
   │   │   ├─ alumni.controller.ts
   │   │   └─ dto/
   │   │       └─ match-mentor-request.dto.ts
   │   │
   │   ├─ chat/
   │   │   ├─ chat.module.ts
   │   │   ├─ chat.controller.ts         # optional for REST fallback
   │   │   └─ dto/
   │   │       └─ send-message-request.dto.ts
   │   │
   │   └─ feed/
   │       ├─ feed.module.ts
   │       ├─ feed.controller.ts
   │       └─ dto/
   │           └─ get-feed-request.dto.ts
   │
   ├─ auth/
   │   ├─ auth.module.ts
   │   ├─ auth.service.ts
   │   ├─ jwt.strategy.ts
   │   └─ dto/
   │       └─ login-request.dto.ts
   │
   ├─ app.module.ts
   └─ main.ts

Note that this is not the full project but only highlights what the backend folder structure looks like to show the way the clean architecture system design has been implemented. 




