# lab-tree-context-inheritance

A web-based client for branching, tree-structured conversations with Copilot-inspired context reconstruction.

## Getting started

1. **Backend**
   - `cd server && npm install`
   - `npm run dev` (defaults to http://localhost:3001)

2. **Frontend**
   - `cd client && npm install`
   - `npm run dev` (set `VITE_API_BASE` to point at the backend if needed)

The backend exposes:
- `POST /conversations` – create a conversation
- `GET /conversations/:id` – fetch conversation metadata
- `GET /conversations/:id/nodes` – list all nodes in a conversation
- `POST /nodes` – create a user node and generated assistant reply in a branch
