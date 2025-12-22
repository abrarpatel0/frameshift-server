# FrameShift Backend API Documentation

Complete API reference for FrameShift Django-to-Flask conversion backend.

**Base URL:** `http://localhost:3000`
**WebSocket URL:** `ws://localhost:3000/ws`

---

## Authentication

All authenticated endpoints require JWT token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

### Register User

**POST** `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "created_at": "2025-12-22T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login

**POST** `/api/auth/login`

Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "github_username": "johndoe",
      "avatar_url": "https://avatars.githubusercontent.com/..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### GitHub OAuth

**GET** `/api/auth/github`

Get GitHub OAuth authorization URL.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "authUrl": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

**Frontend should:** Redirect user to the `authUrl`.

### GitHub OAuth Callback

**GET** `/api/auth/github/callback?code=xxx`

Handle GitHub OAuth callback.

**Query Parameters:**
- `code` - Authorization code from GitHub

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "github_username": "johndoe",
      "github_id": "12345",
      "avatar_url": "https://..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Get Current User

**GET** `/api/users/me`

Get currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "github_username": "johndoe",
      "avatar_url": "https://...",
      "created_at": "2025-12-22T10:00:00.000Z"
    }
  }
}
```

---

## Projects

### List Projects

**GET** `/api/projects`

Get all projects for authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "name": "my-django-blog",
        "source_type": "upload",
        "file_path": "/path/to/project",
        "file_size": 1048576,
        "created_at": "2025-12-22T10:00:00.000Z",
        "updated_at": "2025-12-22T10:00:00.000Z"
      }
    ]
  }
}
```

### Get Project by ID

**GET** `/api/projects/:id`

Get specific project details.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "my-django-blog",
      "source_type": "upload",
      "file_size": 1048576,
      "created_at": "2025-12-22T10:00:00.000Z"
    }
  }
}
```

### Upload Django Project (ZIP)

**POST** `/api/projects/upload`

Upload Django project as ZIP file.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:** `FormData`
- `file` - ZIP file (max 100MB)

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "my-django-blog",
      "source_type": "upload",
      "file_path": "/storage/projects/user_id/project_id",
      "file_size": 1048576,
      "created_at": "2025-12-22T10:00:00.000Z"
    }
  }
}
```

### Clone from GitHub

**POST** `/api/github/clone`

Clone Django project from GitHub repository.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "repoUrl": "https://github.com/username/django-project",
  "name": "My Django Project"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "My Django Project",
      "source_type": "github",
      "github_url": "https://github.com/username/django-project",
      "file_path": "/storage/projects/user_id/project_id",
      "created_at": "2025-12-22T10:00:00.000Z"
    }
  }
}
```

### Delete Project

**DELETE** `/api/projects/:id`

Delete a project and all associated conversions.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

## Conversions

### Start Conversion

**POST** `/api/conversions`

Start Django-to-Flask conversion for a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "projectId": "uuid"
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "uuid",
      "projectId": "uuid",
      "status": "pending",
      "progress": 0,
      "createdAt": "2025-12-22T10:00:00.000Z"
    }
  },
  "message": "Conversion started. Connect to WebSocket for real-time updates."
}
```

**Note:** Conversion runs asynchronously. Use WebSocket or polling to track progress.

### Get Conversion Status

**GET** `/api/conversions/:id`

Get status of a conversion job.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "uuid",
      "projectId": "uuid",
      "status": "converting",
      "progress": 45,
      "currentStep": "converting_views",
      "error": null,
      "startedAt": "2025-12-22T10:00:00.000Z",
      "completedAt": null,
      "createdAt": "2025-12-22T10:00:00.000Z"
    }
  }
}
```

**Status Values:**
- `pending` - Queued, not started
- `analyzing` - Analyzing Django project
- `converting` - Converting to Flask
- `completed` - Successfully completed
- `failed` - Conversion failed

### List User Conversions

**GET** `/api/conversions`

Get all conversions for authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (default: 1)
- `pageSize` (default: 10)
- `status` (optional: filter by status)

**Example:** `/api/conversions?page=1&pageSize=10&status=completed`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "status": "completed",
        "progress": 100,
        "completedAt": "2025-12-22T10:05:00.000Z",
        "createdAt": "2025-12-22T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### Get Conversion Report

**GET** `/api/conversions/:id/report`

Get detailed conversion report.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "report": {
      "accuracy_score": 85.5,
      "total_files_converted": 25,
      "models_converted": 8,
      "views_converted": 12,
      "urls_converted": 15,
      "forms_converted": 3,
      "templates_converted": 10,
      "issues": [
        {
          "file": "myapp/models.py",
          "error": "Complex ManyToMany relationship requires manual review"
        }
      ],
      "warnings": [
        {
          "type": "relationship",
          "message": "ForeignKey on_delete behavior needs verification"
        }
      ],
      "suggestions": [
        {
          "category": "models",
          "message": "Install Flask-SQLAlchemy",
          "code": "pip install flask-sqlalchemy"
        }
      ],
      "gemini_verification": {
        "score": 90,
        "feedback": "Conversion looks good. Review ForeignKey relationships."
      },
      "summary": "Successfully converted Django project to Flask.\n\n..."
    }
  }
}
```

### Download Converted Project

**GET** `/api/conversions/:id/download`

Download converted Flask project as ZIP file.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
- Content-Type: `application/zip`
- Downloads file named `converted-{jobId}.zip`

### Cancel Conversion

**DELETE** `/api/conversions/:id`

Cancel a running conversion.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Conversion cancelled successfully"
}
```

---

## WebSocket Real-Time Updates

### Connect

**URL:** `ws://localhost:3000/ws?token=<jwt_token>`

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=' + yourJwtToken);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket closed');
};
```

### Message Types

#### Connected
```json
{
  "type": "connected",
  "userId": "uuid",
  "message": "WebSocket connection established",
  "timestamp": 1703251200000
}
```

#### Conversion Progress
```json
{
  "type": "conversion:progress",
  "jobId": "uuid",
  "progress": 50,
  "step": "converting_views",
  "message": "Converting Django views to Flask routes",
  "timestamp": 1703251200000
}
```

**Progress Steps:**
- `analyzing` (10%)
- `converting_models` (30%)
- `converting_views` (50%)
- `converting_urls` (65%)
- `converting_templates` (80%)
- `verifying` (90%)
- `generating_report` (95%)
- `completed` (100%)

#### Conversion Completed
```json
{
  "type": "conversion:completed",
  "jobId": "uuid",
  "result": {
    "success": true,
    "jobId": "uuid",
    "outputPath": "/path/to/converted",
    "report": { /* report object */ }
  },
  "timestamp": 1703251200000
}
```

#### Conversion Failed
```json
{
  "type": "conversion:failed",
  "jobId": "uuid",
  "error": "Failed to parse Django models: SyntaxError",
  "timestamp": 1703251200000
}
```

#### Ping/Pong (Keep-Alive)

**Send:**
```json
{
  "type": "ping"
}
```

**Receive:**
```json
{
  "type": "pong",
  "timestamp": 1703251200000
}
```

---

## GitHub Integration

### Create GitHub Repository

**POST** `/api/github/create-repo`

Create a new GitHub repository.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "converted-flask-app",
  "description": "Converted from Django using FrameShift",
  "isPrivate": true
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "repo": {
      "name": "converted-flask-app",
      "url": "https://github.com/username/converted-flask-app",
      "clone_url": "https://github.com/username/converted-flask-app.git"
    }
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE"
  }
}
```

### Common Status Codes

- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User doesn't have permission
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Example Errors

**Invalid credentials:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid email or password"
  }
}
```

**Unauthorized:**
```json
{
  "success": false,
  "error": {
    "message": "Authentication required"
  }
}
```

**File too large:**
```json
{
  "success": false,
  "error": {
    "message": "File size exceeds 100MB limit"
  }
}
```

---

## Rate Limiting

API endpoints have rate limiting:

- **General endpoints:** 100 requests per 15 minutes
- **Conversion endpoints:** 5 conversions per hour per user
- **Authentication:** 10 login attempts per 15 minutes

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703251200
```

---

## Health Check

**GET** `/health`

Check if API is running.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "FrameShift API is running",
  "timestamp": "2025-12-22T10:00:00.000Z"
}
```

---

## CORS

CORS is enabled for:
- `http://localhost:3001` (default frontend URL)
- Configure `FRONTEND_URL` in `.env` for production

---

## Authentication Flow Example

### 1. Register/Login
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { data } = await response.json();
const token = data.token;

// Store token
localStorage.setItem('token', token);
```

### 2. Make Authenticated Request
```javascript
const response = await fetch('http://localhost:3000/api/projects', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();
```

### 3. Connect to WebSocket
```javascript
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'conversion:progress') {
    updateProgressBar(message.progress);
  }
};
```

---

## Complete Conversion Flow

1. **Upload Project**
   ```
   POST /api/projects/upload
   → Get project ID
   ```

2. **Start Conversion**
   ```
   POST /api/conversions
   Body: { projectId }
   → Get job ID
   ```

3. **Connect WebSocket** (for real-time updates)
   ```
   ws://localhost:3000/ws?token=xxx
   → Listen for conversion:progress messages
   ```

4. **Poll Status** (alternative to WebSocket)
   ```
   GET /api/conversions/:jobId
   → Check progress_percentage and status
   ```

5. **Get Report** (when completed)
   ```
   GET /api/conversions/:jobId/report
   → View conversion details
   ```

6. **Download Result**
   ```
   GET /api/conversions/:jobId/download
   → Download ZIP file
   ```

---

**API Version:** 1.0
**Last Updated:** 2025-12-22

For issues or questions, see backend code at `frameshift_backend/`
