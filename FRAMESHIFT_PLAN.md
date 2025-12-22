# FrameShift Backend Implementation Plan

## Project Overview
FrameShift is a Django-to-Flask migration tool that uses a hybrid architecture (Express.js + Python) to automatically convert Django projects while preserving business logic. The system provides rule-based conversion with AI-assisted verification using Google Gemini.

## Current State
- Empty Node.js project with only [package.json](c:\Users\ashad\Desktop\Pratice\frameshift_backend\package.json)
- ES6 modules enabled (`"type": "module"`)
- No existing code or dependencies

## Technology Stack

### Backend
- **API Server**: Node.js with Express.js (for routing, authentication, file handling, WebSocket)
- **Conversion Engine**: Python (for AST parsing, rule-based conversion, Django/Flask expertise)
- **Communication**: Child process with JSON-based IPC (Node spawns Python, exchanges structured messages)

### Database & Storage
- **Database**: PostgreSQL (users, projects, conversion_jobs, reports, github_repos)
- **File Storage**: Local filesystem with auto-cleanup (7-day retention)
- **Real-time**: WebSocket for progress updates

### Integrations
- **AI Verification**: Google Gemini API (code analysis, logic verification)
- **Authentication**: JWT + GitHub OAuth (dual auth strategy)
- **Email**: Nodemailer (SMTP for notifications)
- **Version Control**: GitHub API via Octokit (clone, create repos, push)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│              (WebSocket + REST API calls)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Express.js Server                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes → Controllers → Services → Models             │   │
│  │ Middleware: Auth, Upload, Rate Limit, Security       │   │
│  │ WebSocket Server: Real-time progress broadcasting    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ spawn child process
                         │ JSON via stdin/stdout
┌────────────────────────▼────────────────────────────────────┐
│                  Python Conversion Engine                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Analyzers: Detect Django structure                   │   │
│  │ Converters: Models, Views, URLs, Forms, Templates    │   │
│  │ Verifiers: Syntax, Logic, Gemini AI                  │   │
│  │ Report Generators: Accuracy, Issues, Summary         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### `users`
```sql
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR, nullable for OAuth-only)
- full_name (VARCHAR)
- github_id (VARCHAR, UNIQUE)
- github_username (VARCHAR)
- github_access_token (TEXT, encrypted)
- avatar_url (TEXT)
- email_verified (BOOLEAN)
- created_at, updated_at, last_login (TIMESTAMP)
```

### `projects`
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- name (VARCHAR)
- description (TEXT)
- source_type (VARCHAR: 'upload' | 'github')
- source_url (TEXT)
- file_path (TEXT)
- size_bytes (BIGINT)
- django_version (VARCHAR)
- structure_detected (JSONB)
- created_at, updated_at (TIMESTAMP)
```

### `conversion_jobs`
```sql
- id (UUID, PK)
- project_id (UUID, FK → projects)
- user_id (UUID, FK → users)
- status (VARCHAR: 'pending' | 'analyzing' | 'converting' | 'verifying' | 'completed' | 'failed')
- progress_percentage (INTEGER, 0-100)
- current_step (VARCHAR)
- converted_file_path (TEXT)
- error_message (TEXT)
- started_at, completed_at, created_at, updated_at (TIMESTAMP)
```

### `reports`
```sql
- id (UUID, PK)
- conversion_job_id (UUID, FK → conversion_jobs)
- accuracy_score (DECIMAL, 0.00-100.00)
- total_files_converted, models_converted, views_converted, urls_converted, forms_converted, templates_converted (INTEGER)
- issues (JSONB)
- warnings (JSONB)
- suggestions (JSONB)
- gemini_verification (JSONB)
- summary (TEXT)
- created_at (TIMESTAMP)
```

### `github_repos`
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- conversion_job_id (UUID, FK → conversion_jobs)
- repo_name (VARCHAR)
- repo_url (TEXT)
- pushed_at, created_at (TIMESTAMP)
```

## Project Structure

```
frameshift_backend/
├── src/                                    # Express.js application
│   ├── index.js                           # Entry point
│   ├── config/                            # Configuration files
│   │   ├── database.js                    # PostgreSQL connection
│   │   ├── auth.js                        # JWT & OAuth config
│   │   ├── storage.js                     # File storage paths
│   │   ├── gemini.js                      # Gemini API config
│   │   └── email.js                       # Email service config
│   ├── middleware/                        # Express middleware
│   │   ├── auth.js                        # JWT verification
│   │   ├── upload.js                      # Multer file upload
│   │   ├── validation.js                  # Request validation
│   │   ├── rateLimiter.js                 # Rate limiting
│   │   ├── errorHandler.js                # Global error handler
│   │   └── securityHeaders.js             # Security headers
│   ├── routes/                            # API routes
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── project.routes.js
│   │   ├── conversion.routes.js
│   │   ├── github.routes.js
│   │   └── report.routes.js
│   ├── controllers/                       # Request handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── project.controller.js
│   │   ├── conversion.controller.js
│   │   ├── github.controller.js
│   │   └── report.controller.js
│   ├── services/                          # Business logic
│   │   ├── auth.service.js                # JWT, password hashing
│   │   ├── github.service.js              # GitHub OAuth & API
│   │   ├── conversion.service.js          # Python process manager
│   │   ├── gemini.service.js              # Gemini API integration
│   │   ├── email.service.js               # Email sending
│   │   ├── storage.service.js             # File operations
│   │   ├── cleanup.service.js             # Auto-cleanup scheduler
│   │   └── websocket.service.js           # WebSocket manager
│   ├── models/                            # Database models
│   │   ├── user.model.js
│   │   ├── project.model.js
│   │   ├── conversionJob.model.js
│   │   └── report.model.js
│   ├── utils/                             # Utilities
│   │   ├── fileValidator.js               # File validation
│   │   ├── pathSanitizer.js               # Path traversal prevention
│   │   ├── logger.js                      # Winston logger
│   │   ├── asyncHandler.js                # Async error wrapper
│   │   └── zipHelper.js                   # ZIP operations
│   └── websocket/                         # WebSocket handling
│       ├── wsServer.js
│       └── handlers/
│           └── conversionProgress.handler.js
│
├── python/                                # Python conversion engine
│   ├── main.py                           # Entry point
│   ├── requirements.txt                  # Python dependencies
│   ├── analyzers/                        # Django project analysis
│   │   ├── django_analyzer.py            # Detect structure
│   │   ├── dependency_analyzer.py        # Analyze dependencies
│   │   └── structure_mapper.py           # Map to Flask structure
│   ├── converters/                       # AST-based converters
│   │   ├── models_converter.py           # Django ORM → SQLAlchemy
│   │   ├── views_converter.py            # Django views → Flask routes
│   │   ├── urls_converter.py             # Django URLs → Flask blueprints
│   │   ├── forms_converter.py            # Django forms → WTForms
│   │   ├── templates_converter.py        # Django templates → Jinja2
│   │   ├── settings_converter.py         # Django settings → Flask config
│   │   └── middleware_converter.py       # Django middleware → Flask
│   ├── rules/                            # JSON conversion rules
│   │   ├── models_rules.json
│   │   ├── views_rules.json
│   │   ├── urls_rules.json
│   │   ├── forms_rules.json
│   │   ├── templates_rules.json
│   │   └── settings_rules.json
│   ├── verifiers/                        # Verification logic
│   │   ├── syntax_verifier.py
│   │   ├── logic_verifier.py
│   │   └── gemini_verifier.py            # AI verification
│   ├── report_generators/                # Report generation
│   │   ├── accuracy_reporter.py
│   │   ├── issue_reporter.py
│   │   └── summary_reporter.py
│   └── utils/                            # Python utilities
│       ├── ast_parser.py
│       ├── file_handler.py
│       ├── progress_emitter.py
│       └── logger.py
│
├── storage/                              # File storage (gitignored)
│   ├── uploads/                          # Uploaded ZIP files
│   ├── projects/                         # Extracted projects
│   ├── converted/                        # Converted Flask projects
│   └── reports/                          # Generated reports
│
├── database/                             # Database migrations
│   ├── migrations/
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_projects_table.sql
│   │   ├── 003_create_conversion_jobs_table.sql
│   │   ├── 004_create_reports_table.sql
│   │   └── 005_create_github_repos_table.sql
│   └── seeds/
│
├── tests/                                # Test suites
│   ├── integration/
│   ├── unit/
│   └── fixtures/
│
├── logs/                                 # Application logs (gitignored)
├── .env.example                          # Environment template
├── .env                                  # Actual env vars (gitignored)
├── .gitignore
├── package.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Email/password registration
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/github` - Initiate GitHub OAuth
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/verify-email/:token` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Users
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update user profile
- `DELETE /api/users/me` - Delete account
- `GET /api/users/me/projects` - List user's projects
- `GET /api/users/me/conversions` - List conversion history

### Projects
- `POST /api/projects/upload` - Upload ZIP file
- `POST /api/projects/github` - Import from GitHub
- `GET /api/projects` - List all projects (paginated)
- `GET /api/projects/:id` - Get project details
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/analyze` - Trigger analysis

### Conversions
- `POST /api/conversions` - Start conversion job
- `GET /api/conversions/:id` - Get conversion status
- `GET /api/conversions/:id/progress` - Get real-time progress (SSE)
- `DELETE /api/conversions/:id` - Cancel conversion
- `GET /api/conversions/:id/download` - Download converted ZIP
- `POST /api/conversions/:id/verify` - Trigger AI verification

### GitHub
- `GET /api/github/repos` - List user's repos
- `POST /api/github/clone` - Clone repo for conversion
- `POST /api/github/push/:conversionId` - Push converted project
- `POST /api/github/create-repo` - Create new GitHub repo

### Reports
- `GET /api/reports/:conversionId` - Get conversion report
- `GET /api/reports/:conversionId/pdf` - Download report as PDF
- `POST /api/reports/:conversionId/email` - Email report

### WebSocket
- `WS /ws?token=JWT_TOKEN` - WebSocket connection
  - Events: `conversion:progress`, `conversion:completed`, `conversion:failed`

## Key Implementation Details

### 1. Node-Python Communication
**Strategy**: Child process with structured JSON IPC

**Node.js spawns Python** ([src/services/conversion.service.js](src/services/conversion.service.js)):
```javascript
const pythonProcess = spawn('python', [
  'python/main.py',
  '--job-id', jobId,
  '--project-path', projectPath,
  '--output-path', outputPath,
  '--gemini-api-key', process.env.GEMINI_API_KEY
]);
```

**Python emits progress** ([python/main.py](python/main.py)):
```python
def emit_progress(job_id, step, progress, message):
    output = {
        'type': 'progress',
        'jobId': job_id,
        'step': step,
        'progress': progress,
        'message': message
    }
    print(json.dumps(output), flush=True)
```

**Node.js receives and broadcasts**:
```javascript
pythonProcess.stdout.on('data', (data) => {
  const message = JSON.parse(data.toString());
  if (message.type === 'progress') {
    updateDatabase(message);
    broadcastViaWebSocket(message);
  }
});
```

### 2. Conversion Pipeline

**Step-by-step flow**:
1. **Upload/Clone** (10%): User uploads ZIP or provides GitHub URL
2. **Extract** (15%): Unzip or clone project to `storage/projects/{userId}/{projectId}`
3. **Analyze** (25%): Python scans Django structure, detects apps, models, views, URLs
4. **Convert Models** (40%): AST-based conversion of Django models to SQLAlchemy
5. **Convert Views** (55%): Transform Django views to Flask routes/blueprints
6. **Convert URLs** (65%): Map URL patterns to Flask blueprints
7. **Convert Templates** (75%): Adjust Django template syntax to Jinja2
8. **Convert Settings** (85%): Transform settings.py to Flask config
9. **AI Verification** (95%): Gemini analyzes converted code
10. **Generate Report** (100%): Create accuracy report with issues/suggestions

### 3. Conversion Rules System

**JSON-based rules** ([python/rules/models_rules.json](python/rules/models_rules.json)):
```json
{
  "rules": [
    {
      "id": "charfield_conversion",
      "pattern": "models.CharField",
      "replacement": "db.Column(db.String({max_length}))",
      "type": "field",
      "parameters": ["max_length"]
    },
    {
      "id": "foreignkey_conversion",
      "pattern": "models.ForeignKey",
      "replacement": "db.Column(db.Integer, db.ForeignKey('{related_model}.id'))",
      "type": "field",
      "parameters": ["related_model", "on_delete"]
    }
  ]
}
```

**AST-based conversion** ([python/converters/models_converter.py](python/converters/models_converter.py)):
- Parse Python code into AST
- Transform nodes based on rules
- Generate Flask/SQLAlchemy code
- Preserve business logic and custom methods

### 4. AI Verification with Gemini

**Purpose**: Verify logic preservation, find issues, suggest improvements

**Flow**:
1. For each converted file, compare Django vs Flask code
2. Send to Gemini with context: "Does this preserve the same logic?"
3. Gemini responds with JSON: `{logic_preserved, issues, suggestions, accuracy_score}`
4. Aggregate results into overall report

**Service** ([src/services/gemini.service.js](src/services/gemini.service.js)):
```javascript
async verifyConversion(djangoCode, flaskCode, context) {
  const prompt = `Compare Django and Flask code...`;
  const result = await this.model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

### 5. Real-time Progress Updates

**WebSocket connection** ([src/websocket/wsServer.js](src/websocket/wsServer.js)):
```javascript
// Client connects with JWT token
const ws = new WebSocket('ws://localhost:3000/ws?token=JWT_TOKEN');

// Server authenticates and stores connection
clients.set(userId, ws);

// Broadcast progress to specific user
broadcastToUser(userId, {
  type: 'conversion:progress',
  jobId: 'xxx',
  progress: 45,
  step: 'converting_views',
  message: 'Converting Django views to Flask routes'
});
```

### 6. GitHub Integration

**OAuth Flow**:
1. User clicks "Login with GitHub" → Redirect to `https://github.com/login/oauth/authorize`
2. GitHub redirects back with code → Exchange for access token
3. Store encrypted token in database
4. Use token for repo operations (clone, push)

**Clone repo** ([src/services/github.service.js](src/services/github.service.js)):
```javascript
async cloneRepo(repoUrl, destinationPath) {
  const cloneUrl = repoUrl.replace('https://', `https://${this.accessToken}@`);
  await execAsync(`git clone ${cloneUrl} ${destinationPath}`);
}
```

**Push converted project**:
```javascript
async pushToRepo(localPath, repoUrl) {
  await execAsync(`cd ${localPath}`);
  await execAsync(`git init`);
  await execAsync(`git add .`);
  await execAsync(`git commit -m "Initial Flask conversion"`);
  await execAsync(`git push -u origin main`);
}
```

### 7. Security Measures

**File validation** ([src/utils/fileValidator.js](src/utils/fileValidator.js)):
- Max file size: 100MB
- Allowed types: ZIP only
- MIME type verification
- Scan ZIP contents for dangerous files (.exe, .bat, .sh)
- Reject path traversal attempts (`../`)

**Path sanitization** ([src/utils/pathSanitizer.js](src/utils/pathSanitizer.js)):
- Resolve to absolute paths
- Ensure paths are within allowed directories
- Remove dangerous characters from filenames

**Rate limiting** ([src/middleware/rateLimiter.js](src/middleware/rateLimiter.js)):
- Conversions: 5 per 15 minutes
- Authentication: 10 per 15 minutes
- Uploads: 20 per hour

**Security headers**:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy

### 8. Auto-cleanup System

**Cron job** ([src/services/cleanup.service.js](src/services/cleanup.service.js)):
- Runs daily at 2 AM
- Deletes files older than 7 days
- Cleans up: uploaded ZIPs, extracted projects, converted projects
- Updates database records

### 9. Email Notifications

**Triggers**:
- Conversion completed → Send summary email with download link
- Conversion failed → Send error notification
- Email verification → Send verification link
- Password reset → Send reset token

**Service** ([src/services/email.service.js](src/services/email.service.js)):
```javascript
async sendConversionCompleteEmail(user, job, report) {
  await this.transporter.sendMail({
    to: user.email,
    subject: 'Your Django-to-Flask Conversion is Complete',
    html: generateEmailTemplate(report)
  });
}
```

## Dependencies

### NPM Packages (Express.js)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "express-validator": "^7.0.1",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "pg": "^8.11.3",
    "multer": "^1.4.5-lts.1",
    "archiver": "^6.0.1",
    "unzipper": "^0.10.14",
    "axios": "^1.6.5",
    "@octokit/rest": "^20.0.2",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "nodemailer": "^6.9.8",
    "ws": "^8.16.0",
    "uuid": "^9.0.1",
    "joi": "^17.12.0",
    "passport": "^0.7.0",
    "passport-github2": "^0.1.12",
    "@google/generative-ai": "^0.1.3",
    "node-cron": "^3.0.3"
  }
}
```

### Python Packages
```
flask==3.0.0
sqlalchemy==2.0.25
jinja2==3.1.3
astroid==3.0.2
google-generativeai==0.3.2
pyyaml==6.0.1
black==24.1.1
click==8.1.7
pytest==7.4.4
```

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/frameshift
DB_HOST=localhost
DB_PORT=5432
DB_NAME=frameshift
DB_USER=postgres
DB_PASSWORD=password

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=FrameShift <noreply@frameshift.com>

# Storage
MAX_FILE_SIZE=104857600
CLEANUP_INTERVAL_DAYS=7

# Python
PYTHON_PATH=/usr/bin/python3
```

## Implementation Order

### Phase 1: Foundation (Days 1-5)
1. **Database Setup**
   - Create PostgreSQL database
   - Write and run migrations for all 5 tables
   - Set up pg connection pool in [src/config/database.js](src/config/database.js)

2. **Express Server Skeleton**
   - Initialize Express app in [src/index.js](src/index.js)
   - Set up middleware (helmet, cors, body parsers)
   - Configure Winston logger in [src/utils/logger.js](src/utils/logger.js)
   - Create error handler middleware

3. **Authentication System**
   - Email/password registration in [src/controllers/auth.controller.js](src/controllers/auth.controller.js)
   - JWT generation/verification in [src/services/auth.service.js](src/services/auth.service.js)
   - Auth middleware in [src/middleware/auth.js](src/middleware/auth.js)
   - Password hashing with bcrypt

### Phase 2: File Handling (Days 6-10)
4. **File Upload System**
   - Multer configuration in [src/middleware/upload.js](src/middleware/upload.js)
   - File validator in [src/utils/fileValidator.js](src/utils/fileValidator.js)
   - Storage service in [src/services/storage.service.js](src/services/storage.service.js)
   - ZIP extraction and creation utilities

5. **Project Management**
   - Project routes and controllers
   - Upload endpoint (POST /api/projects/upload)
   - Project listing and deletion
   - File validation and security checks

### Phase 3: GitHub Integration (Days 11-15)
6. **GitHub OAuth**
   - OAuth flow implementation in [src/controllers/auth.controller.js](src/controllers/auth.controller.js)
   - Token exchange and storage
   - GitHub service in [src/services/github.service.js](src/services/github.service.js)

7. **GitHub Operations**
   - Repo cloning functionality
   - Repo creation
   - Push converted project to GitHub
   - GitHub routes and controllers

### Phase 4: Python Conversion Engine (Days 16-25)
8. **Python Environment Setup**
   - Create Python project structure
   - Install dependencies (requirements.txt)
   - Set up logging and utilities

9. **Django Analyzer**
   - Implement [python/analyzers/django_analyzer.py](python/analyzers/django_analyzer.py)
   - Detect Django apps, models, views, URLs
   - Parse settings.py and requirements.txt

10. **Conversion Rules**
    - Create JSON rule files for models, views, URLs, forms, templates
    - Examples: Django ORM → SQLAlchemy mappings

11. **AST-Based Converters**
    - Models converter: [python/converters/models_converter.py](python/converters/models_converter.py)
    - Views converter: [python/converters/views_converter.py](python/converters/views_converter.py)
    - URLs converter: [python/converters/urls_converter.py](python/converters/urls_converter.py)
    - Templates converter: [python/converters/templates_converter.py](python/converters/templates_converter.py)
    - Settings converter: [python/converters/settings_converter.py](python/converters/settings_converter.py)

12. **Python Main Entry Point**
    - Implement [python/main.py](python/main.py)
    - Orchestrate conversion pipeline
    - Emit progress updates via stdout

### Phase 5: Node-Python Integration (Days 26-30)
13. **Conversion Service**
    - Implement [src/services/conversion.service.js](src/services/conversion.service.js)
    - Spawn Python child process
    - Parse stdout/stderr
    - Handle progress updates

14. **Conversion Pipeline**
    - Conversion routes and controllers
    - Job creation and management
    - Database updates for job status
    - Error handling and recovery

### Phase 6: AI Verification (Days 31-35)
15. **Gemini Integration**
    - Implement [src/services/gemini.service.js](src/services/gemini.service.js)
    - Implement [python/verifiers/gemini_verifier.py](python/verifiers/gemini_verifier.py)
    - Code comparison and logic verification
    - Issue detection and suggestions

16. **Report Generation**
    - Implement report generators in Python
    - Calculate accuracy scores
    - Aggregate issues and suggestions
    - Store reports in database

### Phase 7: Real-time Features (Days 36-40)
17. **WebSocket Server**
    - Set up WebSocket server in [src/websocket/wsServer.js](src/websocket/wsServer.js)
    - JWT authentication for WebSocket
    - Client connection management
    - Progress broadcasting

18. **Email Notifications**
    - Implement [src/services/email.service.js](src/services/email.service.js)
    - Create email templates
    - Send completion/failure notifications
    - Email verification flow

### Phase 8: Advanced Features (Days 41-45)
19. **Download System**
    - Create ZIP of converted project
    - Secure download endpoint
    - Temporary file cleanup

20. **Auto-cleanup Service**
    - Implement [src/services/cleanup.service.js](src/services/cleanup.service.js)
    - Cron job setup
    - Delete old files and projects
    - Database maintenance

### Phase 9: Security & Polish (Days 46-50)
21. **Security Hardening**
    - Rate limiting middleware
    - Path sanitizer utility
    - Security headers
    - Input validation

22. **Testing**
    - Unit tests for critical functions
    - Integration tests for API endpoints
    - End-to-end conversion tests

23. **Documentation**
    - API documentation
    - Setup instructions
    - Docker configuration
    - Deployment guide

## Critical Files to Implement

### Express Server Core
1. [src/index.js](src/index.js) - Express app entry point
2. [src/config/database.js](src/config/database.js) - PostgreSQL connection
3. [src/middleware/auth.js](src/middleware/auth.js) - JWT authentication
4. [src/services/conversion.service.js](src/services/conversion.service.js) - Python process manager
5. [src/services/storage.service.js](src/services/storage.service.js) - File operations

### Python Conversion Engine
6. [python/main.py](python/main.py) - Python entry point
7. [python/analyzers/django_analyzer.py](python/analyzers/django_analyzer.py) - Django structure detection
8. [python/converters/models_converter.py](python/converters/models_converter.py) - Models conversion
9. [python/converters/views_converter.py](python/converters/views_converter.py) - Views conversion
10. [python/verifiers/gemini_verifier.py](python/verifiers/gemini_verifier.py) - AI verification

### Real-time & Communication
11. [src/websocket/wsServer.js](src/websocket/wsServer.js) - WebSocket server
12. [src/services/github.service.js](src/services/github.service.js) - GitHub integration
13. [src/services/email.service.js](src/services/email.service.js) - Email notifications

### Security & Utilities
14. [src/utils/fileValidator.js](src/utils/fileValidator.js) - File security
15. [src/utils/pathSanitizer.js](src/utils/pathSanitizer.js) - Path security

## Scaling Considerations

### Performance
- **Database connection pooling**: Use pg-pool with appropriate limits
- **Caching**: Implement Redis for frequently accessed data (conversion rules, user sessions)
- **Background jobs**: Move conversions to message queue (Bull + Redis)
- **CDN**: Serve reports and converted projects via CDN

### Horizontal Scaling
- **Stateless servers**: Deploy multiple Express instances behind load balancer
- **WebSocket sync**: Use Redis adapter for WebSocket across instances
- **Shared storage**: Migrate to S3/cloud storage for file storage
- **Database read replicas**: Separate read/write operations

### Monitoring
- **APM**: New Relic or DataDog for performance monitoring
- **Error tracking**: Sentry for error monitoring
- **Metrics**: Prometheus + Grafana for system metrics
- **Logs**: ELK stack or CloudWatch for log aggregation

## Success Criteria

### Functional Requirements
✅ Users can upload Django projects via ZIP or GitHub URL
✅ System analyzes Django structure and begins conversion
✅ Rule-based conversion transforms Django to Flask
✅ AI verifies conversion accuracy and suggests improvements
✅ Users receive real-time progress updates via WebSocket
✅ Users can download converted Flask project as ZIP
✅ Users can push converted project to GitHub
✅ Email notifications sent on completion/failure
✅ Files auto-cleanup after 7 days

### Non-Functional Requirements
✅ Secure file handling (validation, path sanitization)
✅ Rate limiting to prevent abuse
✅ JWT + GitHub OAuth authentication
✅ Comprehensive error handling and logging
✅ Scalable architecture for multiple concurrent conversions
✅ Clear separation between Express (API) and Python (conversion)

## Next Steps After Plan Approval

1. Install NPM dependencies (express, pg, jwt, multer, etc.)
2. Install Python dependencies (flask, sqlalchemy, astroid, google-generativeai)
3. Set up PostgreSQL database and run migrations
4. Create .env file with required environment variables
5. Begin Phase 1 implementation (database + Express skeleton + auth)
6. Proceed through phases systematically
7. Test each component as it's built
8. Deploy to production environment

---

**Total Estimated Duration**: 50 days (7-8 weeks)
**Team Size**: 2-3 developers (1 Node.js, 1 Python, 1 Full-stack)
**Complexity**: High (hybrid architecture, AI integration, real-time features)
