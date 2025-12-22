# FrameShift Backend

AI-powered Django-to-Flask migration tool with hybrid architecture (Express.js + Python).

## Features

- Upload Django projects via ZIP or GitHub URL
- Automatic project analysis and structure detection
- Rule-based Django-to-Flask conversion
- AI-assisted verification using Google Gemini
- Real-time progress updates via WebSocket
- Download converted projects as ZIP
- Push converted projects to GitHub
- Email notifications
- Auto-cleanup of old files

## Technology Stack

### Backend
- **API Server**: Node.js with Express.js
- **Conversion Engine**: Python 3.x
- **Database**: PostgreSQL
- **Real-time**: WebSocket
- **AI**: Google Gemini API
- **Authentication**: JWT + GitHub OAuth

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL 14+
- Git

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd frameshift_backend
```

### 2. Install dependencies

**Node.js dependencies:**
```bash
npm install
```

**Python dependencies:**
```bash
cd python
pip install -r requirements.txt
cd ..
```

### 3. Set up environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `GEMINI_API_KEY` - Google Gemini API key
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID (optional)
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret (optional)
- `SMTP_*` - Email server configuration (optional)

### 4. Set up database

Create a PostgreSQL database:

```bash
createdb frameshift
```

Run migrations:

```bash
npm run migrate
```

## Usage

### Development

Start the development server with hot reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Production

Start the production server:

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user

### Health Check
- `GET /health` - Check API status

## Project Structure

```
frameshift_backend/
├── src/                      # Express.js application
│   ├── config/              # Configuration files
│   ├── controllers/         # Request handlers
│   ├── middleware/          # Express middleware
│   ├── models/              # Database models
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   ├── utils/               # Utilities
│   ├── websocket/           # WebSocket handling
│   └── index.js             # Entry point
├── python/                  # Python conversion engine
│   ├── analyzers/          # Django project analysis
│   ├── converters/         # AST-based converters
│   ├── rules/              # Conversion rules (JSON)
│   ├── verifiers/          # AI verification
│   ├── report_generators/  # Report generation
│   └── main.py             # Python entry point
├── database/               # Database migrations
│   └── migrations/         # SQL migration files
├── storage/                # File storage (uploads, converted projects)
├── logs/                   # Application logs
└── tests/                  # Test suites
```

## Database Schema

- **users** - User accounts and authentication
- **projects** - Uploaded Django projects
- **conversion_jobs** - Conversion job tracking
- **reports** - Conversion accuracy reports
- **github_repos** - GitHub integration data

## Development

### Run migrations

```bash
npm run migrate
```

### Run tests

```bash
npm test
```

### Logging

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

## Architecture

FrameShift uses a hybrid architecture:

1. **Express.js** handles HTTP requests, authentication, WebSocket connections, and file management
2. **Python** handles Django-to-Flask conversion using AST parsing and rule-based transformation
3. **Communication** happens via child processes with JSON-based IPC

### Conversion Pipeline

1. Upload/Clone → Extract project files
2. Analyze → Detect Django structure
3. Convert → Transform Django code to Flask
   - Models → SQLAlchemy
   - Views → Flask routes
   - URLs → Blueprints
   - Templates → Jinja2
   - Settings → Flask config
4. Verify → AI-assisted verification with Gemini
5. Report → Generate accuracy report
6. Download/Push → Deliver converted project

## Security

- JWT-based authentication
- Rate limiting on all endpoints
- File validation and sanitization
- Path traversal prevention
- Security headers (Helmet.js)
- Password hashing with bcrypt
- SQL injection prevention (parameterized queries)

## License

ISC

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
