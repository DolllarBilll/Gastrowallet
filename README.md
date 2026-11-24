# GastroWallet

Full-stack web application providing dedicated workspaces for **platform administrators** (`ADMIN`) and **store users** (`STORE`), built with React, Vite, Node.js, Express, Socket.IO, and PostgreSQL.

## Key Features

- **Role-Based Authentication & Routing:** JWT-based session handling with protected `/admin` and `/store` routes and role-aware navigation.
- **Admin & Store Workspaces:** Separate dashboards for platform administration and store operations, including store gift/reward management.
- **Real-Time Updates:** Live event synchronization via Socket.IO (`join:store` rooms for store-specific updates).
- **Multilingual UI:** Built-in language switching (`LanguageContext` / `LanguageToggleButton`) for multi-language interfaces.
- **Flexible Networking (LAN & Remote Tunnels):** Supports local network access (`0.0.0.0`) as well as remote testing over Cloudflare Tunnels (`cloudflared`) via configurable API and CORS origins.

## Tech Stack

- **Frontend:** React, Vite, React Router, Axios, Socket.IO Client
- **Backend:** Node.js, Express, Socket.IO, PostgreSQL (`pg`), `dotenv`, `cors`
- **Database:** PostgreSQL

## Project Structure

```text
gastrowallet/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   └── storeRoutes.js
│   │   └── server.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── client.js
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── LanguageContext.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── admin/
    │   │   │   └── AdminDashboard.jsx
    │   │   └── store/
    │   │       └── StoreDashboard.jsx
    │   ├── utils/
    │   │   └── viewport.js
    │   └── App.jsx
    ├── vite.config.js
    └── package.json
