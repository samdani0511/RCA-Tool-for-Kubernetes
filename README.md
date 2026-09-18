# RootCause AI demo

Full-stack MVP for simulating distributed-system incidents and explaining the predicted root cause. The FastAPI backend owns telemetry, topology, simulation, and RCA state; the Next.js dashboard consumes its API.

## Run locally

In terminal one:

```bash
python3 -m pip install -r backend/requirements.txt
npm run backend
```

In terminal two:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

The npm scripts disable Node 25's experimental Web Storage API because it can
conflict with Next.js development workers when a shell supplies an invalid
localStorage persistence path.

`npm run dev` also clears the generated `.next` cache before starting. Always
stop an existing development server before running it again.

The backend exposes `GET /api/dashboard`, `GET /api/services`, `GET /api/topology`, `POST /api/simulate`, `POST /api/reset`, and `GET /api/incidents/{id}/rca`.
