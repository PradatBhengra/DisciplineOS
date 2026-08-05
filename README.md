# Discipline OS

A student planner I built to keep myself accountable. Started as a static site with localStorage, then I rewrote the data layer around a proper backend so my data follows me across devices instead of living in one browser's cache.

Track your courses, marks, tasks, habits and attendance in one place. Made for students who want control, not motivation.

**Stack:** Node.js, Express, MongoDB (Mongoose), JWT auth, vanilla JS frontend

## Features

- Register/login with JWT. Passwords are bcrypt hashed and the auth endpoints are rate limited.
- Dashboard with habit analytics, today's checklist and pending tasks.
- Classes page that pulls attendance percentages from the attendance tracker automatically (matched by subject name).
- Marks tracker where totals and grades are calculated on the server, so the numbers can't drift out of sync.
- To-do list with deadlines, estimated hours and status filters.
- Habit tracker with a weekly grid, week navigation and progress bars.
- Attendance with one-tap present/absent buttons. The percentage turns red below 75%.
- CSV export for every tracker (importable into Notion).

## Project structure

```
discipline-os/
├── docker-compose.yml       # local MongoDB, data persisted to ./data/mongo
├── data/                    # MongoDB data files (gitignored)
├── client/                  # static frontend, served by Express
│   ├── index.html           # app shell, auth guarded
│   ├── login.html           # sign in / register
│   ├── api.js               # fetch wrapper: attaches JWT, redirects on 401
│   ├── app.js               # UI logic: bootstraps state, renders, calls the API
│   ├── style.css
│   └── assets/images/
└── server/
    ├── .env.example         # copy to server/.env (gitignored)
    └── src/
        ├── server.js        # entry point
        ├── app.js           # express app: helmet, cors, routes, static, errors
        ├── config/db.js
        ├── middleware/      # JWT protect + central error handler
        ├── models/          # User, Course, Mark, Todo, Habit, HabitCheck, AttendanceSubject
        ├── controllers/
        └── routes/
```

Secrets only live in `server/.env`. The server refuses to start without a `JWT_SECRET`. All app data lives in MongoDB (locally under `./data/mongo` via docker compose, or in Atlas), never inside the repo.

## API

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/auth/register` | create account, returns JWT |
| POST | `/api/auth/login` | login, returns JWT |
| GET | `/api/auth/me` | current user |
| GET | `/api/data` | load all user data in one request |
| GET/POST | `/api/courses` | list / create course |
| PUT/DELETE | `/api/courses/:id` | update / delete course |
| GET/POST | `/api/marks` | list / create subject marks |
| PUT/DELETE | `/api/marks/:id` | update / delete marks |
| GET/POST | `/api/todos` | list / create task |
| PUT/DELETE | `/api/todos/:id` | update / delete task |
| GET/POST | `/api/habits` | list / create habit |
| PUT/DELETE | `/api/habits/:id` | update / delete habit (also deletes its checks) |
| PUT | `/api/habits/:id/checks` | toggle a day check `{weekKey, day}` |
| GET/POST | `/api/attendance` | list / create subject |
| PUT/DELETE | `/api/attendance/:id` | update / delete subject |
| PATCH | `/api/attendance/:id/mark` | mark `{status: present\|absent}` |
| GET | `/api/health` | health check |

Everything except the auth routes needs an `Authorization: Bearer <token>` header.

## Running locally

You need Node 18+ and either Docker or a MongoDB Atlas URI.

```bash
# start MongoDB (skip if using Atlas)
docker compose up -d

# configure and run the server
cd server
cp .env.example .env        # set a strong JWT_SECRET
npm install
npm run dev
```

Open http://localhost:5000. Express serves the frontend and the API from the same port, so there's nothing else to start.

## Deploying

I run it on Render's free tier with MongoDB Atlas:

1. Create a free M0 cluster on Atlas, add a database user, allow access from anywhere, and copy the connection string.
2. On Render, create a Web Service from this repo with root directory `server`, build command `npm install`, start command `npm start`.
3. Set `MONGO_URI`, `JWT_SECRET` and `NODE_ENV=production` in the environment variables.

The free tier sleeps after ~15 minutes idle, so the first request after a while takes a bit to wake up.

## Things I want to add

- Refresh tokens in httpOnly cookies instead of keeping the JWT in localStorage
- Streak stats for habits, computed server side
- Tests with Jest + Supertest

See [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md) for a longer writeup on how it works and why I picked each piece.

## License

MIT
