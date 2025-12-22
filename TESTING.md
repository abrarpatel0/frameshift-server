# FrameShift Testing Guide

Complete guide for testing the FrameShift Django-to-Flask conversion system.

## Prerequisites

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
cd python
pip install -r requirements.txt
cd ..
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:
```env
# Database (required)
DATABASE_URL=postgresql://postgres:password@localhost:5432/frameshift
DB_HOST=localhost
DB_PORT=5432
DB_NAME=frameshift
DB_USER=postgres
DB_PASSWORD=your_password

# JWT (required)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Optional but recommended
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GEMINI_API_KEY=your_gemini_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 3. Set Up PostgreSQL Database

```bash
# Create database
createdb frameshift

# Run migrations
npm run migrate
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## Testing Workflow

### Step 1: Health Check

Verify the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "FrameShift API is running",
  "timestamp": "2025-12-22T..."
}
```

### Step 2: User Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "full_name": "Test User"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid...",
      "email": "test@example.com",
      "full_name": "Test User"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the token** for subsequent requests!

### Step 3: Login (Alternative to Registration)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Step 4: GitHub OAuth (Optional)

1. Get OAuth URL:
```bash
curl http://localhost:3000/api/auth/github
```

2. Visit the returned `authUrl` in browser
3. Authorize the app
4. You'll be redirected with a token

### Step 5: Upload Django Project

**Option A: Upload ZIP File**

```bash
curl -X POST http://localhost:3000/api/projects/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/django-project.zip"
```

**Option B: Clone from GitHub**

```bash
curl -X POST http://localhost:3000/api/github/clone \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/username/django-project",
    "name": "My Django Project"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "project-uuid",
      "name": "django-project",
      "source_type": "upload",
      "file_path": "/path/to/storage/projects/...",
      "created_at": "..."
    }
  }
}
```

**Save the project ID!**

### Step 6: List Projects

```bash
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 7: Start Conversion

```bash
curl -X POST http://localhost:3000/api/conversions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job-uuid",
      "projectId": "project-uuid",
      "status": "pending",
      "progress": 0,
      "createdAt": "..."
    }
  },
  "message": "Conversion started. Connect to WebSocket for real-time updates."
}
```

**Save the job ID!**

### Step 8: Monitor Progress

**Option A: WebSocket (Recommended)**

Create a WebSocket client:

```javascript
// frontend-test.js
const WebSocket = require('ws');

const token = 'YOUR_JWT_TOKEN';
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.on('open', () => {
  console.log('✅ WebSocket connected');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Message:', message);

  switch(message.type) {
    case 'connected':
      console.log('🎉 Connection established');
      break;
    case 'conversion:progress':
      console.log(`⏳ Progress: ${message.progress}% - ${message.message}`);
      break;
    case 'conversion:completed':
      console.log('✅ Conversion completed!');
      console.log('Result:', message.result);
      break;
    case 'conversion:failed':
      console.error('❌ Conversion failed:', message.error);
      break;
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

Run:
```bash
node frontend-test.js
```

**Option B: Poll Status**

```bash
curl http://localhost:3000/api/conversions/JOB_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "job-uuid",
      "status": "converting",
      "progress": 45,
      "currentStep": "converting_views",
      "startedAt": "...",
      "createdAt": "..."
    }
  }
}
```

### Step 9: Get Conversion Report

```bash
curl http://localhost:3000/api/conversions/JOB_ID/report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
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
      "templates_converted": 10,
      "issues": [
        {
          "file": "myapp/models.py",
          "error": "..."
        }
      ],
      "warnings": [
        {
          "type": "relationship",
          "message": "ForeignKey requires manual review"
        }
      ],
      "suggestions": [
        {
          "category": "models",
          "message": "Install Flask-SQLAlchemy",
          "code": "pip install flask-sqlalchemy"
        }
      ],
      "summary": "Django to Flask Conversion Summary\n..."
    }
  }
}
```

### Step 10: Download Converted Project

```bash
curl http://localhost:3000/api/conversions/JOB_ID/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o converted-project.zip
```

This downloads a ZIP file containing the converted Flask project.

### Step 11: Push to GitHub (Optional)

First, create a new repo:
```bash
curl -X POST http://localhost:3000/api/github/create-repo \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "converted-flask-app",
    "description": "Converted from Django",
    "isPrivate": true
  }'
```

Then push (placeholder for now):
```bash
curl -X POST http://localhost:3000/api/github/push/JOB_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repoName": "converted-flask-app"
  }'
```

## Test Sample Django Project

Create a simple Django project for testing:

```bash
# Create test Django project
mkdir test-django-project
cd test-django-project

# Create minimal Django structure
mkdir myapp
touch myapp/__init__.py
touch myapp/models.py
touch myapp/views.py
touch myapp/urls.py
touch manage.py
touch requirements.txt

# Add sample code to models.py
cat > myapp/models.py << 'EOF'
from django.db import models

class Article(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    published_date = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey('Author', on_delete=models.CASCADE)

class Author(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
EOF

# Add sample views
cat > myapp/views.py << 'EOF'
from django.shortcuts import render
from django.http import JsonResponse
from .models import Article

def article_list(request):
    articles = Article.objects.all()
    return render(request, 'articles.html', {'articles': articles})

def article_detail(request, pk):
    article = Article.objects.get(pk=pk)
    return JsonResponse({'title': article.title, 'content': article.content})
EOF

# Add URLs
cat > myapp/urls.py << 'EOF'
from django.urls import path
from . import views

urlpatterns = [
    path('articles/', views.article_list),
    path('articles/<int:pk>/', views.article_detail),
]
EOF

# Create ZIP
cd ..
zip -r test-django-project.zip test-django-project
```

Upload this ZIP to test the conversion!

## Expected Conversion Output

After conversion, you should see:

```
converted-project/
├── myapp/
│   ├── __init__.py
│   ├── models.py         # Django ORM → SQLAlchemy
│   ├── views.py          # Django views → Flask routes
│   └── routes.py         # URL patterns → Flask routes
└── templates/
    └── articles.html     # Django template → Jinja2
```

**Converted models.py:**
```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Article(db.Model):
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    published_date = db.Column(db.DateTime)
    author = db.Column(db.Integer, db.ForeignKey('author.id'))

class Author(db.Model):
    name = db.Column(db.String(100))
    email = db.Column(db.String(254), unique=True)
```

## Troubleshooting

### Python Process Fails

Check Python is installed:
```bash
python3 --version
```

Check logs:
```bash
tail -f logs/python_conversion.log
```

### WebSocket Connection Fails

Verify JWT token:
```bash
# Decode token at https://jwt.io
```

Check WebSocket path:
```
ws://localhost:3000/ws?token=YOUR_TOKEN
```

### Database Connection Issues

Test PostgreSQL connection:
```bash
psql -h localhost -U postgres -d frameshift
```

Check environment variables:
```bash
echo $DATABASE_URL
```

### File Upload Fails

Check file size (max 100MB):
```bash
ls -lh django-project.zip
```

Ensure ZIP is valid:
```bash
unzip -t django-project.zip
```

## Performance Testing

Test with large Django projects:

```bash
# Clone a real Django project
git clone https://github.com/django/djangoproject.com

# ZIP it
zip -r djangoproject.zip djangoproject.com

# Upload and convert
curl -X POST http://localhost:3000/api/projects/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@djangoproject.zip"
```

Monitor:
- Conversion time
- Memory usage
- CPU usage
- Database queries

## Load Testing

Use Apache Bench or Artillery:

```bash
# Install artillery
npm install -g artillery

# Create load test config
cat > load-test.yml << 'EOF'
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: 'Health check'
    flow:
      - get:
          url: '/health'
EOF

# Run test
artillery run load-test.yml
```

## Security Testing

Test authentication:
```bash
# Should fail (no token)
curl http://localhost:3000/api/projects

# Should fail (invalid token)
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer invalid-token"
```

Test rate limiting:
```bash
# Run 20 times quickly
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/conversions \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"projectId":"test"}'
done
```

Test file validation:
```bash
# Upload non-ZIP file (should fail)
curl -X POST http://localhost:3000/api/projects/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@malicious.exe"
```

## Success Criteria

✅ All API endpoints return correct responses
✅ WebSocket real-time updates work
✅ Python conversion completes successfully
✅ Converted Flask code is valid Python
✅ Reports show accurate statistics
✅ File downloads work
✅ GitHub integration works (if configured)
✅ Rate limiting prevents abuse
✅ Authentication blocks unauthorized access
✅ Database persists all data correctly

## Next Steps After Testing

1. Review converted Flask code
2. Install Flask dependencies
3. Set up Flask application
4. Run Flask migrations
5. Test Flask application
6. Deploy to production

---

**Testing complete!** If all tests pass, FrameShift is ready for production use! 🚀
