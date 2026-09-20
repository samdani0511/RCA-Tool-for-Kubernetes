# RootCause AI

RootCause AI is a full-stack demo for intelligent incident investigation in modern distributed systems. It simulates microservice failures, analyzes dependency impact, and identifies the most likely root cause behind an outage using a visual RCA dashboard.

This project is designed for hackathons, technical demos, and product storytelling. It shows how AI-assisted troubleshooting can reduce time-to-diagnosis, accelerate incident response, and help engineering teams move from symptoms to root cause faster.

## Why this project matters

Modern systems fail in complex, interconnected ways. A single issue in a database, cache, payment service, or auth layer can trigger a cascade of latency spikes and user-facing errors across multiple services.

RootCause AI helps teams:

- simulate realistic distributed system incidents
- inspect service health and topology
- inject failures into different microservice scenarios
- identify the most probable root cause
- view telemetry, evidence, and dependency propagation in one place

## Product concept

The product presents a real-time operational dashboard where an engineer can:

- choose a microservice topology preset
- inject a failure scenario such as database latency, auth timeout, or Redis hotspot
- compare service metrics across latency, error rate, and CPU pressure
- review root-cause evidence and impacted services
- understand what likely triggered the incident

The demo is intentionally focused on clarity and narrative impact rather than deep simulation complexity, making it ideal for product showcases and engineering presentations.

## Architecture

- Frontend: Next.js + React
- Backend: FastAPI
- Runtime: Python services and API-driven telemetry
- Workflow: UI triggers failure scenarios; backend calculates service impact and root cause; dashboard visualizes the result

## Project structure

```text
rootcause-nextjs/
├── app/
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── backend/
│   ├── app/
│   │   └── main.py
│   └── requirements.txt
├── package.json
├── README.md
└── .gitignore
```

## Tech stack

- Next.js 15
- React 19
- FastAPI
- Uvicorn
- Python 3

## Local setup

### 1) Install backend dependencies

```bash
cd rootcause-nextjs
python3 -m pip install -r backend/requirements.txt
```

### 2) Install frontend dependencies

```bash
npm install
```

## Run the app locally

### Start the backend

```bash
npm run backend
```

The backend runs on:

- http://localhost:3002

### Start the frontend

In a second terminal:

```bash
unset NODE_OPTIONS
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api npm run dev -- --port 3000
```

The frontend runs on:

- http://localhost:3000

## Demo scenarios

The demo includes realistic incident presets such as:

- Payment database failure
- Payment latency spike
- Inventory crash
- Order service failure
- Redis hotspot
- Auth timeout
- Shipping delay
- Notification backlog

## API overview

The backend exposes the following endpoints:

- `GET /api/health`
- `GET /api/presets`
- `GET /api/dashboard`
- `POST /api/simulate`
- `POST /api/reset`
- `GET /api/incidents/{id}/rca`

## Notes

- The frontend and backend are intentionally aligned on port 3000 and 3002 respectively for local development.
- The dev script clears stale build artifacts before startup to avoid common Next.js cache issues.
- Node 22 is the recommended runtime for this project to avoid the localStorage compatibility problems seen with newer Node versions in this environment.

## Use case and demo value

This application is ideal for:

- hackathon judging
- internal engineering demos
- customer-facing architecture presentations
- incident response storytelling

It turns system failure analysis into a visual, intuitive, and believable user experience that demonstrates the value of AI-powered operational intelligence.

## License

This project is intended for educational and demo purposes.
