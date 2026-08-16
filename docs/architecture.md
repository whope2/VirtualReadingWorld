# Virtual Reading World — Architecture (Current State)

## Overview

The system is a full-stack web application:

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: SQLite
- Deployment: Local development and future Google Cloud VM + Nginx

The current implementation uses REST-based presence updates rather than WebSockets, but it already supports a shared beach scene with multiple readers.

---

## High-Level Architecture

Browser
  ↓
React + TypeScript + Vite Frontend
  ↓ (REST API)
Node.js + Express Backend
  ↓
SQLite Database
  ↓
Local development / future Google Cloud VM

## Database Strategy

- SQLite is the default and official database for both local development and cloud deployment.
- Cloud environments should use SQLite to keep memory and storage usage low on resource-constrained VMs.
- Local testing should match cloud behavior and use SQLite as well.

---

## Frontend Responsibilities

- Render the beach scene and current reader avatar
- Render other active readers as shared avatars
- Highlight the current reader visually
- Handle avatar movement by clicking the scene
- Display reading corner UI and profile form
- Show the live active-reader count in the scene header
- Call backend REST APIs for profile state and presence updates

---

## Backend Responsibilities

- Store and retrieve user profiles
- Store avatar position and reading corner data
- Track active presence and expiry for readers
- Enforce a configurable active-reader limit (default 10)
- Expose REST API endpoints for reading and updating presence state
- Handle simple username-based "login"

No authentication or passwords.

---

## Deployment

- Nginx serves:
  - / → existing website
  - /world → React app (static build)
  - /api → Node.js backend (proxy)

---

## Key Design Decision

The current system is intentionally lightweight and REST-based, prioritizing:

- simple deployment
- clear shared presence behavior
- easy persistence for reader state
- a calm, low-friction reading experience

The architecture can evolve later to WebSockets if the experience needs more real-time interactivity.