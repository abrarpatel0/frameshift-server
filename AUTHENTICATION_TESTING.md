# Authentication System Testing Guide

## Priority 1: Complete Authentication System - Testing Documentation

This guide provides comprehensive testing steps for all authentication features implemented in Priority 1.

---

## Table of Contents

1. [Setup & Prerequisites](#setup--prerequisites)
2. [Email Service Testing](#email-service-testing)
3. [User Registration with Email Verification](#user-registration-with-email-verification)
4. [Password Reset Flow](#password-reset-flow)
5. [GitHub Account Linking](#github-account-linking)
6. [Conversion Email Notifications](#conversion-email-notifications)
7. [Security Testing](#security-testing)
8. [Troubleshooting](#troubleshooting)

---

## Setup & Prerequisites

### 1. Environment Variables

Ensure your `.env` file contains:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@frameshift.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=frameshift
DB_USER=postgres
DB_PASSWORD=your-password
```

### 2. Database Migration

Verify the `verification_tokens` table exists:

```bash
psql -U postgres -d frameshift -c "\d verification_tokens"
```

Expected output should show:
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to users)
- `token` (VARCHAR, unique)
- `type` (VARCHAR, email_verification or password_reset)
- `expires_at` (TIMESTAMP)
- `used` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `used_at` (TIMESTAMP)

### 3. Start the Server

```bash
npm start
```

Server should be running on `http://localhost:5000`

---

## Email Service Testing

### Test 1: Verify Email Service Configuration

**Endpoint**: Internal service test

**Steps**:
1. Check server logs on startup for email service initialization
2. Look for: `Email service initialized with SMTP configuration`

**Expected Result**: No errors in logs

### Test 2: Email Template Fallback

**What to Test**: Email service works even without template files

**Steps**:
1. Check if `templates/` directory exists
2. Email service should use inline HTML fallbacks if files don't exist

**Expected Result**: Emails sent successfully regardless of template file existence

---

## User Registration with Email Verification

### Test 3: Register New User (Email/Password)

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "email": "testuser@example.com",
  "password": "SecurePass123!",
  "full_name": "Test User"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!",
    "full_name": "Test User"
  }'
```

**Expected Response** (201):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "full_name": "Test User",
      "email_verified": false,
      "github_id": null,
      "github_username": null
    },
    "token": "jwt-token-here"
  },
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Email Verification**:
- Check the email inbox for `testuser@example.com`
- Should receive welcome email with subject: "Welcome to FrameShift! 🚀"
- Email should contain verification link: `http://localhost:3000/verify-email?token=...`

### Test 4: Verify Email Address

**Endpoint**: `POST /api/auth/verify-email`

**Request Body**:
```json
{
  "token": "token-from-email"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-verification-token-here"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "email_verified": true
    }
  },
  "message": "Email verified successfully"
}
```

**Database Verification**:
```sql
SELECT email_verified FROM users WHERE email = 'testuser@example.com';
-- Should return: email_verified = true

SELECT used, used_at FROM verification_tokens WHERE token = 'your-token';
-- Should return: used = true, used_at = [timestamp]
```

### Test 5: Resend Verification Email

**Endpoint**: `POST /api/auth/resend-verification`

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/resend-verification \
  -H "Authorization: Bearer your-jwt-token"
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Email Verification**: Should receive new verification email

### Test 6: Attempt to Use Expired Token

**Setup**:
1. Wait for verification token to expire (24 hours), OR
2. Manually update database:
   ```sql
   UPDATE verification_tokens
   SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE token = 'your-token';
   ```

**Endpoint**: `POST /api/auth/verify-email`

**Expected Response** (400):
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired verification token"
  }
}
```

### Test 7: Attempt to Reuse Token

**Setup**:
1. Use a token that has already been used (from Test 4)

**Endpoint**: `POST /api/auth/verify-email`

**Expected Response** (400):
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired verification token"
  }
}
```

---

## Password Reset Flow

### Test 8: Request Password Reset

**Endpoint**: `POST /api/auth/forgot-password`

**Request Body**:
```json
{
  "email": "testuser@example.com"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent"
}
```

**Email Verification**:
- Check email inbox
- Should receive email with subject: "Reset Your FrameShift Password"
- Email should contain reset link: `http://localhost:3000/reset-password?token=...`

**Security Note**: Response is the same whether email exists or not (prevents email enumeration)

### Test 9: Request Password Reset for Non-existent Email

**Endpoint**: `POST /api/auth/forgot-password`

**Request Body**:
```json
{
  "email": "nonexistent@example.com"
}
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent"
}
```

**Email Verification**: No email should be sent

**Security**: Same response as Test 8 (prevents attackers from discovering valid emails)

### Test 10: Reset Password with Valid Token

**Endpoint**: `POST /api/auth/reset-password`

**Request Body**:
```json
{
  "token": "token-from-email",
  "password": "NewSecurePass456!"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-reset-token",
    "password": "NewSecurePass456!"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com"
    }
  },
  "message": "Password reset successfully"
}
```

**Verification**:
1. Try logging in with old password - should fail
2. Try logging in with new password - should succeed

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "NewSecurePass456!"
  }'
```

### Test 11: Reset Password with Expired Token

**Setup**:
```sql
UPDATE verification_tokens
SET expires_at = NOW() - INTERVAL '1 hour'
WHERE token = 'your-reset-token' AND type = 'password_reset';
```

**Endpoint**: `POST /api/auth/reset-password`

**Expected Response** (400):
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired reset token"
  }
}
```

### Test 12: Reset Password with Weak Password

**Endpoint**: `POST /api/auth/reset-password`

**Request Body**:
```json
{
  "token": "valid-token",
  "password": "123"
}
```

**Expected Response** (400):
```json
{
  "success": false,
  "error": {
    "message": "Password must be at least 8 characters long"
  }
}
```

### Test 13: Change Password (Authenticated User)

**Endpoint**: `POST /api/auth/change-password`

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Request Body**:
```json
{
  "currentPassword": "NewSecurePass456!",
  "newPassword": "AnotherSecurePass789!"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/change-password \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "NewSecurePass456!",
    "newPassword": "AnotherSecurePass789!"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com"
    }
  },
  "message": "Password changed successfully"
}
```

**Verification**: Login with new password should work

---

## GitHub Account Linking

### Test 14: Get GitHub Link Status (Unlinked)

**Endpoint**: `GET /api/github/status`

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/github/status \
  -H "Authorization: Bearer your-jwt-token"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "isLinked": false,
    "github_username": null,
    "avatar_url": null,
    "canPushToGithub": false
  }
}
```

### Test 15: Link GitHub Account to Existing User

**Prerequisites**:
1. User already registered with email/password
2. User is logged in (has JWT token)

**Step 1: Get GitHub Authorization Code**

Frontend should redirect to:
```
https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/github/callback&scope=repo,user
```

User authorizes, GitHub redirects back with `code` parameter.

**Step 2: Link Account**

**Endpoint**: `POST /api/github/link`

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Request Body**:
```json
{
  "code": "github-authorization-code"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/github/link \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "github-auth-code"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "github_id": "12345678",
      "github_username": "testuser",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
    }
  },
  "message": "GitHub account linked successfully"
}
```

**Database Verification**:
```sql
SELECT github_id, github_username, github_access_token
FROM users
WHERE email = 'testuser@example.com';
-- All should be populated
```

### Test 16: Get GitHub Link Status (Linked)

**Endpoint**: `GET /api/github/status`

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "isLinked": true,
    "github_username": "testuser",
    "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
    "canPushToGithub": true
  }
}
```

### Test 17: Attempt to Link Already-Linked GitHub Account

**Setup**:
1. GitHub account already linked to User A
2. User B tries to link the same GitHub account

**Endpoint**: `POST /api/github/link`

**Expected Response** (400):
```json
{
  "success": false,
  "error": {
    "message": "GitHub account already linked to another user"
  }
}
```

### Test 18: Unlink GitHub Account

**Endpoint**: `DELETE /api/github/unlink`

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**cURL Example**:
```bash
curl -X DELETE http://localhost:5000/api/github/unlink \
  -H "Authorization: Bearer your-jwt-token"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "testuser@example.com",
      "github_id": null,
      "github_username": null
    }
  },
  "message": "GitHub account unlinked successfully"
}
```

**Database Verification**:
```sql
SELECT github_id, github_username, github_access_token
FROM users
WHERE email = 'testuser@example.com';
-- All should be NULL
```

### Test 19: Register with GitHub OAuth (New Flow)

**Step 1: Initiate GitHub Auth**

**Endpoint**: `GET /api/auth/github`

User is redirected to GitHub authorization page.

**Step 2: GitHub Callback**

After user authorizes, GitHub redirects to:
```
GET /api/auth/github/callback?code=authorization_code
```

**Expected Response**: Redirect to frontend with JWT token

**Verification**:
```sql
SELECT * FROM users WHERE github_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;
-- Should show new user with GitHub info populated
```

---

## Conversion Email Notifications

### Test 20: Conversion Completion Email

**Prerequisites**:
1. User has a conversion job running
2. Conversion completes successfully

**Trigger**: Conversion service completes a job

**Email Verification**:
- User receives email with subject: "Your Django to Flask Conversion is Complete! 🎉"
- Email contains:
  - Accuracy score
  - Files converted count
  - Download link
  - View report link

**Code Location**: [conversion.service.js:42-49](src/services/conversion.service.js#L42-L49)

**Manual Test**:
1. Upload a Django project
2. Wait for conversion to complete
3. Check email inbox

### Test 21: Conversion Failure Email

**Prerequisites**:
1. User has a conversion job
2. Conversion fails (invalid Django project, Python error, etc.)

**Trigger**: Conversion service encounters error

**Email Verification**:
- User receives email with subject: "Your Django to Flask Conversion Failed"
- Email contains:
  - Error message
  - Support contact information
  - Link to retry conversion

**Code Location**: [conversion.service.js:66-72](src/services/conversion.service.js#L66-L72)

**Manual Test**:
1. Upload an invalid Django project (e.g., non-Django folder)
2. Wait for conversion to fail
3. Check email inbox

---

## Security Testing

### Test 22: Token Expiration Times

**Email Verification Tokens**: 24 hours
```javascript
// Code: verificationToken.model.js
const expiresInMinutes = 60 * 24; // 1440 minutes = 24 hours
```

**Password Reset Tokens**: 15 minutes
```javascript
// Code: auth.service.js
await VerificationTokenModel.create(user.id, 'password_reset', 15);
```

**Test**:
1. Generate tokens
2. Check `expires_at` in database
3. Verify tokens rejected after expiration

### Test 23: Token Reuse Prevention

**Test**:
1. Use a verification or reset token
2. Attempt to use the same token again

**Expected**: Should be rejected (token marked as `used = true`)

**Database Check**:
```sql
SELECT token, used, used_at FROM verification_tokens WHERE used = true;
```

### Test 24: Rate Limiting on Password Reset

**Endpoint**: `POST /api/auth/forgot-password`

**Test**:
1. Send 10 password reset requests rapidly

**Expected**: Rate limiting should kick in after configured threshold

**Code Location**: [auth.routes.js](src/routes/auth.routes.js) - `authLimiter` middleware

### Test 25: Email Enumeration Prevention

**Test 1: Valid Email**
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com"}'
```

**Test 2: Invalid Email**
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@example.com"}'
```

**Expected**: Both should return identical response:
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent"
}
```

### Test 26: JWT Token Validation

**Test**:
1. Access protected endpoint without token
2. Access with invalid token
3. Access with expired token

**Expected**: All should return 401 Unauthorized

---

## Troubleshooting

### Issue 1: Emails Not Sending

**Symptoms**: No emails received

**Checks**:
1. Verify SMTP credentials in `.env`
2. Check server logs for email errors
3. For Gmail, ensure "App Passwords" are used (not regular password)
4. Check spam/junk folder

**Debug**:
```javascript
// In email.service.js, temporarily add:
console.log('Email config:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER
});
```

### Issue 2: Database Migration Failed

**Symptoms**: `verification_tokens` table doesn't exist

**Fix**:
```bash
psql -U postgres -d frameshift -f database/migrations/006_create_verification_tokens_table.sql
```

**Verify**:
```bash
psql -U postgres -d frameshift -c "\d verification_tokens"
```

### Issue 3: GitHub Linking Returns 500 Error

**Symptoms**: Error when linking GitHub account

**Checks**:
1. Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`
2. Verify GitHub OAuth callback URL matches configuration
3. Check that `github_access_token` is included in `UserModel.findById()`

**Code Check**: [user.model.js:47](src/models/user.model.js#L47)
```javascript
// Should include github_access_token in SELECT
'SELECT id, email, full_name, github_id, github_username, github_access_token, ...'
```

### Issue 4: Verification Links Not Working

**Symptoms**: Frontend URL in emails is incorrect

**Fix**: Update `FRONTEND_URL` in `.env`:
```env
FRONTEND_URL=http://localhost:3000
```

**Restart server** after changing environment variables.

### Issue 5: Password Reset Token Expires Too Quickly

**Symptoms**: Users complain reset link expired before they could use it

**Current**: 15 minutes

**To extend**: Edit [auth.service.js:91](src/services/auth.service.js#L91)
```javascript
// Change from 15 to desired minutes (e.g., 60 for 1 hour)
const resetToken = await VerificationTokenModel.create(
  user.id,
  'password_reset',
  60  // 1 hour
);
```

---

## Summary Checklist

### Email Features
- [ ] Welcome email sent on registration
- [ ] Email verification link works
- [ ] Verification token expires after 24 hours
- [ ] Resend verification email works
- [ ] Password reset email sent
- [ ] Password reset token expires after 15 minutes
- [ ] Conversion completion email sent
- [ ] Conversion failure email sent

### GitHub Features
- [ ] Link GitHub to existing email/password account
- [ ] GitHub status endpoint shows correct linking state
- [ ] Unlink GitHub account works
- [ ] Cannot link same GitHub account to multiple users
- [ ] Register new user via GitHub OAuth

### Security
- [ ] Tokens cannot be reused
- [ ] Expired tokens are rejected
- [ ] Password reset doesn't reveal if email exists
- [ ] Rate limiting on sensitive endpoints
- [ ] GitHub access token stored securely

### Database
- [ ] `verification_tokens` table created
- [ ] Indexes created for performance
- [ ] Tokens marked as used after consumption
- [ ] Users table includes GitHub fields

---

## Next Steps

After completing Priority 1 testing:

1. **Priority 2**: GitHub Push Button Implementation
   - Push converted Flask project directly to GitHub
   - Show push button only if GitHub is linked
   - Fallback to ZIP download if not linked

2. **Priority 3**: AI Verification & High Accuracy
   - Real Gemini AI verification (not placeholder)
   - Framework detection before conversion
   - Improved Django → Flask conversion accuracy

---

## Support

For issues or questions:
- Check server logs: `npm start` output
- Review database state: `psql -U postgres -d frameshift`
- Email service logs: Look for "Email sent successfully" or errors in console

**Priority 1 Implementation Complete** ✅
