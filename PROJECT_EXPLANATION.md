# How Discipline OS works

The README covers setup. This is the longer writeup: what the app does, how a request flows through it, and why I picked each piece of the stack.

## The app

A student signs up and gets a private workspace with six sections. The dashboard summarizes everything: habit completion with ASCII progress bars, today's habit checklist, and the next few pending tasks. Classes holds the courses you're enrolled in. The attendance column there isn't stored on the course at all; it's looked up live from the attendance tracker by matching subject names. Marks stores the exam components per subject (Quiz 1, Mid Sem, Quiz 2, Assignment, End Sem) and the server works out the total and letter grade. To-do is a task list with deadlines and filters. Habits is a weekly grid, one row per habit and one cell per day, with navigation between weeks. Attendance keeps per-subject counters with present/absent buttons, and the percentage goes red under 75% because that's the cutoff my college actually enforces.

The first version of this saved everything to localStorage, which meant the data lived in one browser and would die with the cache. That's what pushed me to add real accounts and a database. Now the data belongs to a user, not a browser.

## Why this stack

**Node.js.** The frontend was already JavaScript, so keeping the backend in the same language meant one mental model for the whole project. Node's event loop also suits this app well: nearly every request is just "read or write a few documents in MongoDB", which is I/O bound work that Node handles concurrently without any thread management.

**Express.** The whole server is a middleware pipeline: helmet, cors, the JSON body parser, then the API routers, then static files, then a 404 and a central error handler. Each resource gets its own router file, and `router.use(protect)` applies JWT verification to a whole router in one line. Controllers never format their own error responses. They call `next(err)` and one error middleware translates Mongoose errors into consistent JSON (bad ObjectId becomes 404, validation failure becomes 400, duplicate key becomes 400). Stack traces are hidden in production. Express also serves the frontend from the same process, so there's one thing to deploy and no CORS pain in production.

**MongoDB.** The data here is naturally document shaped. A mark record is one object with a handful of number fields, a todo is one object, and there are no relationships that would need joins or transactions. Every query in the app follows the same pattern, "all X belonging to user Y", and a single index on `user` covers that. Atlas has a free tier, so hosting costs nothing. Locally it runs through docker compose with data files mapped to `./data/mongo`, which is gitignored, so no user data ever ends up in the repo.

**Mongoose.** Schemas validate everything before it touches the database: required fields, max lengths, min values, and an enum that forces `day` to be one of Sun through Sat. The User schema has a `pre('save')` hook that hashes the password whenever it changes, so no controller ever deals with hashing. The part I like most is virtuals. `Mark.total` and `Mark.grade` are getters computed at read time from the exam components, and `AttendanceSubject.percentage` works the same way. A grade physically cannot disagree with its marks because it isn't stored anywhere.

**JWT.** On login the server signs a token with the user's id and a 7 day expiry. The client sends it as a Bearer header and the `protect` middleware verifies it and attaches `req.user`. I went with tokens over sessions because the server stays stateless, which makes deploying to Render trivial. The honest tradeoff: the token sits in localStorage, which any script on the page could read. The proper fix is short lived access tokens plus refresh tokens in httpOnly cookies, and that's first on my list of improvements.

**bcryptjs.** Passwords are salted and hashed, never stored or compared as plaintext. The password field has `select: false` so it's excluded from every query unless the login controller explicitly asks for it.

**helmet, cors, express-rate-limit.** Helmet sets the standard security headers. Rate limiting caps login and register attempts at 30 per 15 minutes per IP, which blunts brute force attempts on exactly the endpoints that matter.

**dotenv.** Config lives in `server/.env`, gitignored, with `server/.env.example` documenting what's needed. The entry point loads the file by explicit path so it works from any working directory, and it refuses to boot without a `JWT_SECRET`. Failing loudly at startup beats failing mysteriously at the first login.

**No frontend framework.** Partly because the UI already existed as plain HTML/CSS/JS and I didn't want to throw away the design, and partly because I wanted to build the SPA mechanics myself at least once: switching sections, rendering from a state object, optimistic updates. There's no build step at all. The client has two layers: `api.js` is a fetch wrapper that attaches the token, parses error messages, and redirects to the login page on any 401; `app.js` holds one in-memory `state` object, renders every section from it, and pushes changes through the API.

## A request, end to end

Say you add a course. The modal's save handler calls `API.createCourse({...})`, which sends `POST /api/courses` with the Bearer header. On the server, `protect` verifies the token and loads the user, then the create handler whitelists the allowed fields, stamps `user: req.user._id` onto the document, and calls `Course.create`. Mongoose validates and inserts, the new document comes back as JSON with a 201, and the frontend pushes it into `state.classes` and re-renders the table. If anything goes wrong at any point, the error middleware returns `{message}` JSON and the frontend shows it as a toast.

## Decisions I'd defend

**One bootstrap request.** Instead of six GETs when the app opens, `GET /api/data` fetches all six collections in parallel with `Promise.all` and returns them together. Habit checks come back flattened into a `{"habitId_weekKey_day": true}` map so rendering the weekly grid is a plain object lookup per cell. After that single request, all reads come from memory and only writes touch the network.

**Optimistic UI where it counts.** Habit checks and todo toggles are the actions you do dozens of times a day, so they update the screen immediately, then call the API, and revert with an error toast if the call fails. The server stays the source of truth but the app never feels laggy.

**Authorization inside the query.** Every model except User carries a `user` field, and every single query filters on it:

```js
Course.findOne({ _id: req.params.id, user: req.user._id })
```

A valid token for user A simply cannot match user B's documents. There's no separate permission check that someone could forget to write.

**One CRUD factory instead of five controllers.** Courses, marks, todos, habits and attendance all need the same list/create/update/delete handlers with the same user scoping. `crudFactory(Model, allowedFields)` generates them once. The field whitelist doubles as mass assignment protection: a request can't smuggle in `user: someoneElse` or set a grade directly, because anything outside the whitelist is dropped. Habits and attendance extend the factory with their own endpoints (check toggling with cascade delete, present/absent marking).

**Habit checks as documents.** A checked day is a `HabitCheck` document and unchecking deletes it. There's a unique compound index on `(user, habit, weekKey, day)`, so two simultaneous toggles can't create duplicates, and deleting a habit cleans up its whole history with one `deleteMany`. A missing document just means "not done", so stale flags never accumulate.

## Security, in one table

| Concern | What handles it |
|---|---|
| Password storage | bcrypt with salt, `select: false` |
| Authentication | signed, expiring JWTs on every protected route |
| Authorization | every query filtered by `req.user._id` |
| Brute force | rate limiting on the auth endpoints |
| Mass assignment | field whitelist in the CRUD factory |
| NoSQL injection | Mongoose `sanitizeFilter`, auth fields must be strings |
| Bad input | Mongoose schema validation, 100kb JSON body limit |
| XSS | user strings pass through an HTML escaping helper before rendering |
| Info leakage | stack traces off in production, generic login error message |
| Secrets | `.env` gitignored, startup fails without JWT_SECRET or MONGO_URI |

## Data model

```
User               { name, email (unique), password (hashed, select:false) }
Course             { user, name, instructor, credits }
Mark               { user, name, maxMarks, quiz1, midSem, quiz2, assignment, endSem }
                     virtuals: total, grade
Todo               { user, name, deadline, estimatedHours, done }
Habit              { user, name }
HabitCheck         { user, habit, weekKey, day }   unique(user, habit, weekKey, day)
AttendanceSubject  { user, name, totalClasses, attended }   virtual: percentage
```

All models have createdAt/updatedAt timestamps.

## What's next

Refresh tokens in httpOnly cookies. Server side streak computation for habits (current and longest streak per habit as an aggregation). And eventually a React rewrite of the client; the state object plus render functions in `app.js` map almost one to one onto components with hooks, so most of the logic would carry over.
