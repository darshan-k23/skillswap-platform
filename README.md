# 🔄 SkillSwap — Student Skill Exchange Platform

> **VESIT Full Stack Web Development Lab — (Mini Project)**

A complete **MERN stack** (MongoDB · Express · React · Node.js) web application that lets college students **list skills they can teach** and **find skills they want to learn**, then send and manage skill exchange requests.

---

## Project Structure

```
skill-exchange-platform/
│
├── package.json              ← Root: runs both client & server (concurrently)
├── .gitignore
│
├── server/                   ← Node.js + Express Backend
│   ├── server.js             ← Entry point
│   ├── app.js                ← Express app (middleware + routes)
│   ├── .env                  ← Environment variables (PORT, MONGO_URI, JWT_SECRET)
│   │
│   ├── config/
│   │   └── db.js             ← MongoDB connection via Mongoose
│   │
│   ├── models/
│   │   ├── User.js           ← name, email, password (hashed), bio, college, year
│   │   ├── Skill.js          ← userId, name, type (offer/want), category, description
│   │   └── Request.js        ← senderId, receiverId, offeredSkillId, wantedSkillId, status
│   │
│   ├── controllers/
│   │   ├── auth.controller.js       ← register, login, getMe
│   │   ├── users.controller.js      ← getAllUsers, getUserById, updateUser
│   │   ├── skills.controller.js     ← getAllSkills, createSkill, updateSkill, deleteSkill
│   │   └── requests.controller.js   ← getRequests, createRequest, updateRequest, deleteRequest
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── skills.routes.js
│   │   └── requests.routes.js
│   │
│   └── middleware/
│       ├── auth.middleware.js   ← JWT verification, attaches req.user
│       └── error.middleware.js  ← Centralized error handling + 404
│
└── client/                   ← React + Vite Frontend
    ├── index.html
    ├── vite.config.js         ← Dev proxy: /api → http://localhost:5000
    ├── tailwind.config.js
    ├── package.json
    │
    └── src/
        ├── main.jsx            ← ReactDOM.render + providers
        ├── App.jsx             ← Routes + ProtectedRoute + PublicOnlyRoute
        ├── index.css           ← Tailwind + reusable component classes
        │
        ├── context/
        │   └── AuthContext.jsx  ← Global auth state, token, login/logout/register
        │
        ├── api/
        │   ├── axios.js         ← Axios instance with JWT interceptor
        │   ├── auth.js          ← authAPI.register / login / getMe
        │   ├── users.js         ← usersAPI.getAll / getById / update
        │   ├── skills.js        ← skillsAPI.getAll / create / update / remove
        │   └── requests.js      ← requestsAPI.getAll / create / update / remove
        │
        ├── components/
        │   ├── Navbar.jsx           ← Fixed top nav, avatar dropdown
        │   ├── SkillCard.jsx         ← Single skill display with delete button
        │   ├── UserCard.jsx          ← User summary with offer/want skills
        │   ├── RequestCard.jsx       ← Exchange request with accept/decline
        │   ├── SkillForm.jsx         ← Add-skill inline form
        │   └── SendRequestModal.jsx  ← Modal to send exchange request
        │
        └── pages/
            ├── Login.jsx      ← Login form with validation
            ├── Register.jsx   ← Registration form
            ├── Home.jsx       ← Dashboard: stats, recent requests, community skills
            ├── Browse.jsx     ← Browse all students, search/filter, send request
            ├── Profile.jsx    ← View/edit profile, manage skills
            └── Requests.jsx   ← Manage sent/received requests, tabs, filter
```

---

## Getting Started

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **npm** v9+

### 1. Clone & Install

```bash
# Install root + server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Configure Environment

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/skill_exchange
JWT_SECRET=your_super_secret_key_here
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

For MongoDB Atlas, replace `MONGO_URI` with your connection string.

### 3. Run in Development

```bash
# Run both server (nodemon) and client (vite) simultaneously
npm run dev
```

| Service  | URL                        |
|----------|---------------------------|
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:5000      |
| API      | http://localhost:5000/api  |
| Health   | http://localhost:5000/api/health |

---

## 📡 REST API Endpoints

### Authentication — `/api/auth`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register a new user |
| POST | `/api/auth/login` | Public | Login and receive JWT |
| GET | `/api/auth/me` | Private | Get logged-in user profile |

### Users — `/api/users`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/users` | Private | Get all users (supports `?search=`, `?college=`, `?year=`) |
| GET | `/api/users/:id` | Private | Get user by ID (with skills) |
| PUT | `/api/users/:id` | Private | Update own profile (owner only) |

### Skills — `/api/skills`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/skills` | Private | Get skills (supports `?type=`, `?category=`, `?userId=`, `?search=`) |
| POST | `/api/skills` | Private | Create new skill |
| PUT | `/api/skills/:id` | Private | Update skill (owner only) |
| DELETE | `/api/skills/:id` | Private | Delete skill (owner only) |

### Exchange Requests — `/api/requests`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/requests` | Private | Get user's requests (supports `?direction=sent/received`, `?status=`) |
| POST | `/api/requests` | Private | Create exchange request |
| PUT | `/api/requests/:id` | Private | Accept/decline request (receiver only) |
| DELETE | `/api/requests/:id` | Private | Cancel request (sender only) |

**All protected routes require:**  
`Authorization: Bearer <JWT_TOKEN>`

---

## Data Models

### User
```js
{
  name:     String   // required, min 2 chars
  email:    String   // required, unique
  password: String   // bcrypt-hashed, min 6 chars
  bio:      String   // optional, max 300 chars
  college:  String   // optional
  year:     String   // FE | SE | TE | BE
}
```

### Skill
```js
{
  userId:      ObjectId → User    // owner
  name:        String             // required, max 60 chars
  type:        "offer" | "want"   // required
  category:    String             // Programming/Design/Music/...
  description: String             // optional, max 200 chars
}
```

### Request
```js
{
  senderId:       ObjectId → User
  receiverId:     ObjectId → User
  offeredSkillId: ObjectId → Skill
  wantedSkillId:  ObjectId → Skill
  status:         "pending" | "accepted" | "declined"
  message:        String   // optional, max 300 chars
}
```

---

## Features Implemented

### Backend
- [x] Express REST API with full CRUD for Users, Skills, Requests
- [x] JWT Authentication (register, login, protected routes)
- [x] Password hashing with bcryptjs
- [x] Input validation with express-validator
- [x] Centralized error handling middleware
- [x] MongoDB integration with Mongoose
- [x] Authorization (owners can only modify their own data)
- [x] Duplicate request prevention (unique compound index)

### Frontend
- [x] React + Vite with Tailwind CSS
- [x] AuthContext with JWT token persistence (localStorage)
- [x] Protected routes (redirect to /login if not authenticated)
- [x] Login & Registration with client-side validation
- [x] Dashboard (Home) with stats and community skill feed
- [x] Browse students page with live search + filter
- [x] Profile page — view/edit profile, add/delete skills
- [x] Requests page — tabbed view (All/Sent/Received), accept/decline/cancel
- [x] Send Request modal with skill selector
- [x] Toast notifications for all actions
- [x] Responsive design (mobile-first)

---

## Syllabus Coverage

| Experiment | Topic | Covered In |
|---|---|---|
| 1 | HTML & CSS | `client/src/index.css`, Tailwind utility classes |
| 2 | JavaScript | `client/src/**/*.jsx` (ES6+, async/await) |
| 3 | React basics | Components, Props, State, Events — all pages |
| 4 | React Todo (state mgmt) | Skills CRUD with dynamic UI updates |
| 5 | Node.js + Express | `server/app.js`, `server/server.js`, middleware |
| 6 | RESTful API (CRUD) | All 4 route files + controllers |
| 7 | MongoDB + Mongoose | `server/models/`, `server/config/db.js` |
| 10 | Full-stack capstone | Entire project — auth, validation, CRUD |

---

## Possible Extensions

- [ ] Real-time notifications with Socket.io
- [ ] Skill rating / reviews after exchange
- [ ] Chat system between matched users
- [ ] Email notifications for new requests
- [ ] PostgreSQL migration script (Experiment 8–9)
- [ ] Figma prototype (Assignment)
- [ ] Deploy: Render (backend) + Vercel (frontend)

