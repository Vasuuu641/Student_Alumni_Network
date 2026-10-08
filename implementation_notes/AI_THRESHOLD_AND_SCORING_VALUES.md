# D.1 Threshold and Scoring Values

Table D.1: Matching and scoring parameters

| Parameter | Value | Used in | Rationale / how tuned |
| --- | --- | --- | --- |
| Embedding model | Cohere `embed-english-v3.0` | Note-to-thread linking, thread similarity search, notification AI scoring, study-group recommendations | Standard retrieval-oriented embedding model used for semantic matching across the AI features. |
| Vector dimension | 1024 | All embedding tables and cosine similarity queries | Fixed by the pgvector schema and Cohere embedding output; selected to match the model output size. |
| Similarity measure | Cosine similarity | Thread clustering, note-thread link retrieval, study-group recommendation, notification semantic scoring | Calculated as `1 - (embeddingA <=> embeddingB)` for pgvector cosine distance and also replicated in JS via the cosine formula. |
| Vector index | `IVFFlat` with `vector_cosine_ops` | Thread and note chunk embeddings in PostgreSQL | Optimizes fast nearest-neighbour search while preserving cosine-distance matching in a vector database. |
| Chunk size and overlap | 300 words per chunk, 50-word overlap | Note embedding pipeline | The note content is segmented into chunks so long notes can be represented without losing local context; overlap reduces boundary effects. |
| Similarity threshold (note-thread links) | 0.55 | `CohereNoteLLMService.findRelatedThreads(...)` | Tunes retrieval so only sufficiently similar threads are surfaced; set after empirical testing against real document content. |
| Similarity threshold (thread search) | 0.65 | `CohereThreadLLMService.findSimilarThreads(...)` and `ThreadsGateway.handleTypingSimilarity(...)` | More conservative threshold for real-time thread suggestions to reduce noisy matches during typing. |
| Maximum suggestions returned | 5 | Note-thread suggestions and thread similarity suggestions | Keeps the UI lightweight and avoids overloading the user with irrelevant matches. |
| Minimum content length | 20 characters | Manual related-thread search trigger | Prevents empty or near-empty notes from triggering semantic queries; avoids low-quality recommendations. |
| Recommendation cap | 3 results maximum, default | Study-group recommendation endpoint | Hard-capped at 3 to keep recommendation panels small and usable; enforced with `Math.max(1, Math.min(limit, 3))`. |
| Notification eligibility threshold | 0.20 | `NotificationEligibilityService.SCORE_THRESHOLD` | This is the minimum final score required before a notification is considered eligible. |
| Blend weights (AI : behavioral) | 50% AI / 50% behavioral | `finalScore = (aiScore + rawScore) / 2` | Balanced scoring so semantic interest contributes equally to explicit user interaction history and preferences. |
| AI fallback if embedding fails | `panelWeight * 0.7` | `NotificationAIScoringService.scoreNotification(...)` | When Cohere embedding fails, the service falls back to a panel-weight-based score instead of blocking the whole decision. |
| Default interest weights (cold start) | Academic = 0.5, Alumni = 0.5, career = 0.3, housing = 0.3, shopping = 0.2, internship = 0.3, campusServices = 0.4, food = 0.4, study = 0.4, social = 0.3 | `UserInterestProfile` cold-start profile creation | These values provide a neutral baseline before the user has generated enough interaction data. |
| Default signal strength values | Thread reply = 1.0, save = 0.9, like = 0.7, open = 0.5, view = 0.3, geo visit/save = 0.8, category browse = 0.4, panel focus = 0.5 | `NotificationEligibilityService.getSignalStrength(...)` | Signals are weighted by how strongly they indicate user interest; more explicit engagement gets a larger contribution. |
| Content truncation for embeddings | 3500 characters | Study-group and mentor clustering embeddings | Limits embedding input to keep requests within practical token and provider limits while preserving most of the meaningful content. |

Notes:

- The note-thread recommendation pipeline computes the similarity as `1 - (embedding_distance)` using pgvector cosine distance.
- The thread similarity pipeline uses the same strategy but applies a stricter threshold in the user-facing typing suggestions flow.
- Notification eligibility checks a muted-source rule before any AI computation, so muted content never triggers semantic scoring.
- Study-group recommendations are capped at 3 results and return the highest-score matches after cosine similarity ranking.

Implementation sources:

- `backend/src/infrastructure/ai/cohere/cohere-note-llm.service.ts`
- `backend/src/infrastructure/ai/cohere/cohere-thread-llm.service.ts`
- `backend/src/infrastructure/services/notification-eligibility.service.ts`
- `backend/src/infrastructure/services/notification-ai-scoring.service.ts`
- `backend/src/infrastructure/ai/cohere/cohere-study-group-recommendation.service.ts`
- `backend/src/domain/entities/user-interest.entity.ts`
- `backend/src/infrastructure/database/prisma/migrations/20260319173639_add_thread_embeddings/migration.sql`
