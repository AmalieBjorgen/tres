# Tres - Online Multiplayer Card Game

![Tres Logo](src/app/icon.png)

A real-time, browser-based multiplayer card game inspired by Uno. Built with a focus on smooth animations, mobile accessibility, and real-time synchronization for a great "Friday game night" experience.

## 🚀 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org)
- **Styling**: Vanilla CSS with [CSS Modules](https://github.com/css-modules/css-modules)
- **Real-time**: [Pusher](https://pusher.com) (Serverless WebSockets)
- **Persistence**: [Upstash Redis](https://upstash.com) (Serverless State Management)
- **Deployment**: [Vercel](https://vercel.com)

## 📦 Project Structure

- `src/app/`: Next.js App Router pages and API routes.
  - `/api/game/`: Core game action endpoints (play, draw, call Tres).
  - `/api/lobby/`: Session management (create, join, start).
- `src/components/`: Reusable React components.
  - `Card.tsx`: Optimized card rendering with flip/draw/play animations.
  - `Hand.tsx`: Interactive player hand with mobile-first fanning and ghost card logic.
  - `ActionLog.tsx`: Real-time history sidebar.
- `src/lib/`: Backend-agnostic game logic and utilities.
  - `game.ts`: The "TRES" engine (rules, turn management, stacking logic).
  - `gameStore.ts`: Redis-backed state persistence for serverless environments.

## 🛠️ Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) (recommended) or any modern package manager (Bun/pnpm/yarn)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AmalieBjorgen/tres.git
   cd tres
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env.local` file in the root and add your credentials:
   ```env
   # Pusher (pusher.com)
   PUSHER_APP_ID=xxx
   PUSHER_KEY=xxx
   PUSHER_SECRET=xxx
   PUSHER_CLUSTER=xxx
   NEXT_PUBLIC_PUSHER_KEY=xxx
   NEXT_PUBLIC_PUSHER_CLUSTER=xxx

   # Redis (upstash.com)
   UPSTASH_REDIS_REST_URL=xxx
   UPSTASH_REDIS_REST_TOKEN=xxx
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the game**:
   Navigate to [http://localhost:3000](http://localhost:3000).

## 🎮 Game Features

- **Multiplayer**: Support for 2-15 players with real-time sync.
- **Stacking Rules**: Cascade +2 and +4 penalties to double the fun (or pain).
- **Multi-Card Play**: Play multiple cards of the same number in a single turn.
- **Action History**: Track every move with a dedicated history log.
- **Podium System**: 1st, 2nd, and 3rd place finishes tracked and celebrated.
- **Resilient State**: Game state persists across serverless refreshes and brief disconnections.

---

Built for Friday game nights. 🃏✨
