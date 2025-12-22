# FrameShift Quick Start Guide

Get FrameShift up and running in 5 minutes!

## 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd python
pip install -r requirements.txt
cd ..
```

## 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required - Database
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/frameshift
DB_HOST=localhost
DB_PORT=5432
DB_NAME=frameshift
DB_USER=postgres
DB_PASSWORD=your_password

# Required - JWT
JWT_SECRET=change-this-to-a-random-secret-key

# Optional - Features
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GEMINI_API_KEY=your_gemini_api_key
```

## 3. Set Up Database

```bash
# Create PostgreSQL database
createdb frameshift

# Run migrations
npm run migrate
```

## 4. Start Server

```bash
# Development mode (auto-reload)
npm run dev

# Or production mode
npm start
```

You should see:
```
🚀 FrameShift server is running on port 3000
📡 WebSocket server is running on ws://localhost:3000/ws
```

## 5. Test Health Check

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

## 6. Create Test User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "full_name": "Test User"
  }'
```

Save the returned JWT token - you'll need it for all subsequent requests!

## What's Next?

- **Full Testing Guide**: See [TESTING.md](TESTING.md) for complete API testing workflow
- **Upload Django Project**: Use the token to upload a Django project ZIP
- **Monitor Conversion**: Connect to WebSocket for real-time progress
- **Download Result**: Get converted Flask project as ZIP

## Common Issues

### Port Already in Use
```bash
# Change PORT in .env
PORT=3001
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
psql -h localhost -U postgres -d frameshift

# Verify DATABASE_URL in .env
```

### Python Not Found
The system now auto-detects Python:
- **Windows**: Uses `python` (not `python3` which is MS Store stub)
- **Linux/Mac**: Uses `python3`

To override, set in `.env`:
```bash
# Windows example (if needed)
PYTHON_PATH=C:\Program Files\Python313\python.exe

# Linux/Mac example (if needed)
PYTHON_PATH=/usr/bin/python3
```

Verify Python works:
```bash
python --version
# Should show: Python 3.x.x
```

## API Endpoints Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/register` | POST | Register user |
| `/api/auth/login` | POST | Login user |
| `/api/projects/upload` | POST | Upload Django ZIP |
| `/api/conversions` | POST | Start conversion |
| `/api/conversions/:id` | GET | Check status |
| `/api/conversions/:id/download` | GET | Download result |
| `/ws?token=JWT` | WebSocket | Real-time updates |

## Example Full Workflow

```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","full_name":"Test"}' \
  | jq -r '.data.token')

# 2. Upload Django project
PROJECT_ID=$(curl -s -X POST http://localhost:3000/api/projects/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@django-project.zip" \
  | jq -r '.data.project.id')

# 3. Start conversion
JOB_ID=$(curl -s -X POST http://localhost:3000/api/conversions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\"}" \
  | jq -r '.data.job.id')

# 4. Check status
curl http://localhost:3000/api/conversions/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"

# 5. Download (when completed)
curl http://localhost:3000/api/conversions/$JOB_ID/download \
  -H "Authorization: Bearer $TOKEN" \
  -o converted-project.zip
```

---

**Ready to convert Django to Flask!** 🚀

For detailed testing instructions, see [TESTING.md](TESTING.md)
