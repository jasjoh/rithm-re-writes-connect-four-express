Goal: Transition the Game model and logic from the client to the server

Initial Approach:
- All game interactions exposed via JSON REST APIs
- APIs consumed via polling (no push or sockets)
- App itself is stateless to allow for exploring scalability in the future 
- Game state stored in PostgreSQL

Miro Docs (to-be-developed)
- DB Schema
- API Schema
