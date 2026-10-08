# F.1 REST Endpoints

The backend routes below are exposed to both the web and mobile clients through the shared API layer.

Table F.1: REST API endpoints

| Module | Method | Path | Roles | Purpose |
| --- | --- | --- | --- | --- |
| App | GET | / | Public | Application welcome/health endpoint |
| Authentication | POST | /auth/register | Public | Register a new user account |
| Authentication | POST | /auth/login | Public | Authenticate a user and return tokens |
| Authentication | POST | /auth/refresh | Public | Exchange a refresh token for a new access token |
| Authentication | POST | /auth/logout | Public | Revoke a refresh token |
| Authentication | POST | /auth/forgot-password | Public | Request a password reset OTP/email |
| Authentication | POST | /auth/reset-password | Public | Reset a password using an OTP |
| Authentication | GET | /auth/me | Admin | Get the currently authenticated admin profile |
| Authentication | PUT | /auth/me | Admin | Update the currently authenticated admin profile |
| Admin users | POST | /admin/users/authorized | Admin | Create an authorized email entry for signup |
| Admin users | GET | /admin/users/authorized | Admin | List all authorized users |
| Admin users | GET | /admin/users/authorized/:id | Admin | Fetch a single authorized user record |
| Admin users | PUT | /admin/users/authorized/:id | Admin | Update an authorized user record |
| Admin users | DELETE | /admin/users/authorized/:id | Admin | Remove an authorized user record |
| Alumni | GET | /alumni/profile | Alumni | Get the signed-in alumnus profile |
| Alumni | PUT | /alumni/profile | Alumni | Update alumnus profile data and optional image |
| Professors | GET | /professors/profile | Professor | Get the signed-in professor profile |
| Professors | PUT | /professors/profile | Professor | Update professor profile data and optional image |
| Students | GET | /students/profile | Student | Get the signed-in student profile |
| Students | PUT | /students/profile | Student | Update student profile data and optional image |
| Notes | POST | /notes | Student, Professor | Create a new note |
| Notes | GET | /notes | Student, Professor | List notes owned by / shared with the user |
| Notes | GET | /notes/:id | Student, Professor | Fetch one note by ID |
| Notes | PATCH | /notes/:id | Student, Professor | Update note content or metadata |
| Notes | POST | /notes/:id/images | Student, Professor | Upload an image for inline note content |
| Notes | POST | /notes/:id/share | Student, Professor | Share a note with another user |
| Notes | GET | /notes/:id/share | Student, Professor | List collaborators for a note |
| Notes | PATCH | /notes/:id/share/:userId | Student, Professor | Update a collaborator role |
| Notes | DELETE | /notes/:id/share/:userId | Student, Professor | Remove a collaborator |
| Notes | POST | /notes/:id/versions | Student, Professor | Create a version checkpoint |
| Notes | GET | /notes/:id/versions | Student, Professor | List note versions |
| Notes | POST | /notes/:id/restore/:versionNumber | Student, Professor | Restore a previous note version |
| Threads | POST | /threads | Student, Professor, Alumni | Create a thread |
| Threads | GET | /threads | Student, Professor, Alumni | List threads by panel with filter/sort/pagination |
| Threads | GET | /threads/:id | Student, Professor, Alumni | Get one thread by ID |
| Threads | PATCH | /threads/:id/status | Student, Professor, Alumni | Update thread status |
| Threads | PATCH | /threads/:id/delete | Student, Professor, Alumni | Soft-delete a thread |
| Threads | POST | /threads/:id/replies | Student, Professor, Alumni | Create a new reply |
| Threads | GET | /threads/:id/replies | Student, Professor, Alumni | List replies for a thread |
| Threads | PATCH | /threads/:id/replies/:replyId | Student, Professor, Alumni | Edit a reply |
| Threads | PATCH | /threads/:id/replies/:replyId/delete | Student, Professor, Alumni | Soft-delete a reply |
| Threads | POST | /threads/:id/vote | Student, Professor, Alumni | Vote on a thread |
| Threads | POST | /threads/:id/replies/:replyId/vote | Student, Professor, Alumni | Vote on a reply |
| Threads | GET | /threads/saved | Student, Professor, Alumni | List saved threads |
| Threads | POST | /threads/:id/save | Student, Professor, Alumni | Save a thread |
| Threads | DELETE | /threads/:id/save | Student, Professor, Alumni | Unsave a thread |
| Study groups | POST | /study-groups | Student, Professor | Create a new study group |
| Study groups | GET | /study-groups | Student, Professor | List study groups |
| Study groups | GET | /study-groups/me/archived | Student, Professor | List archived study groups for the current user |
| Study groups | GET | /study-groups/:id | Student, Professor | Get a study group by ID |
| Study groups | PATCH | /study-groups/:id | Student, Professor | Update a study group |
| Study groups | PATCH | /study-groups/:id/archive | Student, Professor | Archive a study group |
| Study groups | DELETE | /study-groups/:id/archive | Student, Professor | Unarchive a study group |
| Study groups | PATCH | /study-groups/:id/delete | Student, Professor | Delete a study group |
| Study groups | POST | /study-groups/:id/join | Student, Professor | Request or complete join for a study group |
| Study groups | GET | /study-groups/invites/me | Student, Professor | List invites received by the current user |
| Study groups | POST | /study-groups/:id/invites/:inviteId/respond | Student, Professor | Accept or reject a study group invite |
| Study groups | GET | /study-groups/:id/join-requests | Student, Professor | List join requests for a group |
| Study groups | PATCH | /study-groups/:id/join-requests/:requestId | Student, Professor | Review a join request |
| Study groups | GET | /study-groups/recommendations/me | Student, Professor | Get AI-recommended study groups |
| Study groups | POST | /study-groups/:id/leave | Student, Professor | Leave a study group |
| Study groups | GET | /study-groups/:id/members | Student, Professor | List members of a group |
| Study groups | POST | /study-groups/:id/members | Student, Professor | Add a member to a study group |
| Study groups | PATCH | /study-groups/:id/members/:userId/role | Student, Professor | Update a member role |
| Study groups | DELETE | /study-groups/:id/members/:userId | Student, Professor | Remove a member |
| Study groups | POST | /study-groups/:id/posts | Student, Professor | Create a group post |
| Study groups | GET | /study-groups/:id/posts | Student, Professor | List posts in a group |
| Study groups | PATCH | /study-groups/:id/posts/:postId | Student, Professor | Edit a group post |
| Study groups | DELETE | /study-groups/:id/posts/:postId | Student, Professor | Delete a group post |
| Geo help board | GET | /geo-help-board/spots/review-queue | Admin | List spots pending review |
| Geo help board | GET | /geo-help-board/spots/popular | Student, Professor, Alumni, Admin | List popular locations |
| Geo help board | GET | /geo-help-board/spots/nearby | Student, Professor, Alumni, Admin | List nearby help-board locations |
| Geo help board | POST | /geo-help-board/spots | Student, Professor, Alumni, Admin | Create a new help-board spot |
| Geo help board | PATCH | /geo-help-board/spots/:spotId | Student, Professor, Alumni, Admin | Edit a help-board spot |
| Geo help board | PATCH | /geo-help-board/spots/:spotId/deactivate | Student, Professor, Alumni, Admin | Deactivate a help-board spot |
| Geo help board | PATCH | /geo-help-board/spots/:spotId/review or /verification | Admin | Approve or reject a reviewed spot |
| Geo help board | POST | /geo-help-board/spots/:spotId/visit | Student, Professor, Alumni, Admin | Record a visit to a spot |
| Geo help board | GET | /geo-help-board/spots/saved | Student, Professor, Alumni, Admin | List saved nearby locations |
| Geo help board | POST | /geo-help-board/spots/:spotId/save | Student, Professor, Alumni, Admin | Save a location |
| Geo help board | DELETE | /geo-help-board/spots/:spotId/save | Student, Professor, Alumni, Admin | Remove a saved location |
| Notifications | GET | /notifications/unread-count | Authenticated user | Get unread notification count |
| Notifications | GET | /notifications/preferences | Authenticated user | Get notification preferences |
| Notifications | PATCH | /notifications/preferences | Authenticated user | Update notification preferences |
| Notifications | GET | /notifications | Authenticated user | List notifications |
| Notifications | PATCH | /notifications/:id/read | Authenticated user | Mark one notification as read |
| Notifications | PATCH | /notifications/read-all | Authenticated user | Mark all notifications as read |
| Notifications | PATCH | /notifications/:id/dismiss | Authenticated user | Dismiss a notification |
| Notifications | POST | /notifications/:id/mute-source | Authenticated user | Mute an entire notification source |
| Notifications | POST | /notifications/mute-category | Authenticated user | Mute an entire category |
| Notifications | GET | /notifications/mutes | Authenticated user | List muted sources/categories |
| Notifications | PATCH | /notifications/mutes/:muteId | Authenticated user | Unmute an item |

# F.2 WebSocket Events

Table F.2: WebSocket events and rooms

| Module | Event | Direction | Room / scope | Payload |
| --- | --- | --- | --- | --- |
| Notes | `notes:join` | Client -> Server | `notes:{noteId}` | Join a collaborative note room |
| Notes | `notes:leave` | Client -> Server | `notes:{noteId}` | Leave a note room |
| Notes | `notes:awareness` | Client -> Server | `notes:{noteId}` | Presence/awareness state for collaborative editing |
| Notes | `notes:sync-request` | Client -> Server | `notes:{noteId}` | Request CRDT state sync from another client |
| Notes | `notes:sync-response` | Client -> Client | `notes:{noteId}` | CRDT sync payload returned to requester |
| Notes | `notes:crdt-update` | Client -> Server | `notes:{noteId}` | Collaborative document update broadcast |
| Notes | `notes:typing-related-threads` | Client -> Server | `notes:{noteId}` | Legacy related-thread trigger (deprecated) |
| Notes | `notes:request-related-threads` | Client -> Server | `notes:{noteId}` | Request AI-related thread suggestions for a note |
| Notes | `notes:joined` | Server -> Client | Per socket | Joined confirmation and permissions |
| Notes | `notes:left` | Server -> Client | Per socket | Leave confirmation |
| Notes | `notes:presence` | Server -> Client | `notes:{noteId}` | User joined/left presence notifications |
| Notes | `notes:presence-snapshot` | Server -> Client | `notes:{noteId}` | Current presence list in the room |
| Notes | `notes:awareness-rebroadcast-request` | Server -> Client | `notes:{noteId}` | Request awareness rebroadcast from peers |
| Notes | `notes:related-threads` | Server -> Client | `notes:{noteId}` | AI-generated related thread results |
| Notes | `notes:checkpoint-created` | Server -> Client | `notes:{noteId}` | New note checkpoint version notification |
| Notes | `notes:version-restored` | Server -> Client | `notes:{noteId}` | Restored note content broadcast |
| Threads | `threads:join` | Client -> Server | `threads:{threadId}` | Join a thread discussion room |
| Threads | `threads:leave` | Client -> Server | `threads:{threadId}` | Leave a thread room |
| Threads | `threads:typing-similarity` | Client -> Server | Global search context | Search for similar threads by text |
| Threads | `threads:joined` | Server -> Client | Per socket | Join acknowledgment |
| Threads | `threads:left` | Server -> Client | Per socket | Leave acknowledgment |
| Threads | `threads:presence` | Server -> Client | `threads:{threadId}` | Presence of users in the thread room |
| Threads | `threads:similarity-results` | Server -> Client | Per socket | AI similarity search result list |
| Threads | `threads:reply-posted` | Server -> Client | `threads:{threadId}` | New reply has been created |
| Threads | `threads:reply-edited` | Server -> Client | `threads:{threadId}` | A reply has been edited |
| Threads | `threads:reply-deleted` | Server -> Client | `threads:{threadId}` | A reply has been removed |
| Threads | `threads:thread-voted` | Server -> Client | `threads:{threadId}` | Thread vote count and score updated |
| Threads | `threads:reply-voted` | Server -> Client | `threads:{threadId}` | Reply vote count and score updated |
| Study groups | `study-groups:join-room` | Client -> Server | `study-groups:{groupId}` | Join a study-group chat room |
| Study groups | `study-groups:leave-room` | Client -> Server | `study-groups:{groupId}` | Leave a study-group room |
| Study groups | `study-groups:joined` | Server -> Client | Per socket | Join confirmation for the group |
| Study groups | `study-groups:left` | Server -> Client | Per socket | Leave confirmation |
| Study groups | `study-groups:presence` | Server -> Client | `study-groups:{groupId}` | Member join/leave presence notifications |
| Study groups | `study-groups:member-joined` | Server -> Client | `study-groups:{groupId}` | New member joined the group |
| Study groups | `study-groups:member-left` | Server -> Client | `study-groups:{groupId}` | Member left the group |
| Study groups | `study-groups:member-role-updated` | Server -> Client | `study-groups:{groupId}` | Member permissions/role changed |
| Study groups | `study-groups:invite-created` | Server -> Client | `study-groups:{groupId}` | New invite broadcast |
| Study groups | `study-groups:join-request-updated` | Server -> Client | `study-groups:{groupId}` | Join request status changed |
| Study groups | `study-groups:post-created` | Server -> Client | `study-groups:{groupId}` | New post created |
| Study groups | `study-groups:post-edited` | Server -> Client | `study-groups:{groupId}` | Post edited |
| Study groups | `study-groups:post-deleted` | Server -> Client | `study-groups:{groupId}` | Post deleted |

This document summarizes the REST API and WebSocket interfaces used by the web and mobile clients in this project.
