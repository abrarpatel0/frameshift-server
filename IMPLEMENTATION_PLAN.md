# FrameShift Implementation Plan

Complete implementation roadmap for priority features requested.

---

## 🎯 YOUR PRIORITIES

Based on your requirements, here are the features to implement:

### Priority 1: Complete Authentication System
1. ✅ Link GitHub account to existing email/password account
2. ✅ Welcome email on registration
3. ✅ Email verification after signup
4. ✅ Conversion completion email
5. ✅ Conversion failure email
6. ✅ Password reset emails

### Priority 2: GitHub Integration Enhancement
1. ✅ Push converted project to GitHub button
2. ✅ Show button only if GitHub account is linked
3. ✅ Otherwise, only show ZIP download

### Priority 3: High-Accuracy Conversion
1. ✅ AI verification with Gemini API
2. ✅ Framework detection (ensure it's Django before converting)
3. ✅ Improve conversion accuracy for:
   - Models (Django ORM → SQLAlchemy)
   - Views (Django views → Flask routes)
   - URLs (Django URLs → Flask blueprints)
   - Templates (Django templates → Jinja2)
   - Forms (Django Forms → WTForms)

---

## 📋 IMPLEMENTATION BREAKDOWN

---

## PHASE 1: EMAIL SERVICE INFRASTRUCTURE (2-3 hours)

### Files to Create/Modify

#### 1.1 Create Email Service
**File:** `src/services/email.service.js`

```javascript
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head><style>/* Email styles */</style></head>
        <body>
          <h1>Welcome to FrameShift! 🚀</h1>
          <p>Hi ${user.full_name || 'there'},</p>
          <p>Thank you for signing up! Start converting Django to Flask...</p>
          <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">
            Verify Email
          </a>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: 'Welcome to FrameShift!',
      html: emailHtml
    });
  }

  // Send email verification
  async sendVerificationEmail(user, token) { ... }

  // Send password reset
  async sendPasswordResetEmail(user, token) { ... }

  // Send conversion completion
  async sendConversionCompleteEmail(user, job, report) { ... }

  // Send conversion failure
  async sendConversionFailedEmail(user, job, error) { ... }

  // Generic send method
  async sendEmail({ to, subject, html }) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        html
      });
      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}

export default new EmailService();
```

#### 1.2 Create Email Templates
**Directory:** `src/templates/emails/`

Create HTML email templates:
- `welcome.html` - Welcome + verification link
- `verification.html` - Email verification
- `password-reset.html` - Password reset link
- `conversion-complete.html` - Success notification with download link
- `conversion-failed.html` - Failure notification with error details

#### 1.3 Environment Variables
Add to `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=FrameShift <noreply@frameshift.com>
FRONTEND_URL=http://localhost:3001
```

---

## PHASE 2: EMAIL VERIFICATION (2 hours)

### Database Changes

#### 2.1 Create Email Verification Tokens Table
**File:** `database/migrations/006_create_verification_tokens_table.sql`

```sql
CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'email_verification', 'password_reset'
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);
```

#### 2.2 Create Token Model
**File:** `src/models/verificationToken.model.js`

```javascript
import pool from '../database/config.js';
import crypto from 'crypto';

class VerificationTokenModel {
  static async create(userId, type, expiresInMinutes = 60) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, token, type, expiresAt]
    );

    return result.rows[0];
  }

  static async findByToken(token, type) {
    const result = await pool.query(
      `SELECT * FROM verification_tokens
       WHERE token = $1 AND type = $2 AND used = false AND expires_at > NOW()`,
      [token, type]
    );
    return result.rows[0];
  }

  static async markAsUsed(tokenId) {
    await pool.query(
      `UPDATE verification_tokens SET used = true WHERE id = $1`,
      [tokenId]
    );
  }

  static async deleteExpired() {
    await pool.query(`DELETE FROM verification_tokens WHERE expires_at < NOW()`);
  }
}

export default VerificationTokenModel;
```

### Auth Service Changes

#### 2.3 Update Auth Service
**File:** `src/services/auth.service.js`

Add new methods:
```javascript
// Send verification email after registration
static async register(email, password, fullName) {
  // ... existing registration code ...

  // Generate verification token
  const verificationToken = await VerificationTokenModel.create(
    user.id,
    'email_verification',
    60 * 24 // 24 hours
  );

  // Send welcome + verification email
  await emailService.sendWelcomeEmail(user, verificationToken.token);

  return { user, token: jwtToken };
}

// Verify email
static async verifyEmail(token) {
  const verificationToken = await VerificationTokenModel.findByToken(
    token,
    'email_verification'
  );

  if (!verificationToken) {
    throw new Error('Invalid or expired verification token');
  }

  // Mark email as verified
  await UserModel.update(verificationToken.user_id, {
    email_verified: true
  });

  // Mark token as used
  await VerificationTokenModel.markAsUsed(verificationToken.id);

  return true;
}

// Resend verification email
static async resendVerification(userId) {
  const user = await UserModel.findById(userId);

  if (user.email_verified) {
    throw new Error('Email already verified');
  }

  const verificationToken = await VerificationTokenModel.create(
    userId,
    'email_verification',
    60 * 24
  );

  await emailService.sendVerificationEmail(user, verificationToken.token);
}
```

#### 2.4 Add Auth Controller Endpoints
**File:** `src/controllers/auth.controller.js`

```javascript
// POST /api/auth/verify-email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  await AuthService.verifyEmail(token);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

// POST /api/auth/resend-verification
export const resendVerification = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  await AuthService.resendVerification(userId);

  res.status(200).json({
    success: true,
    message: 'Verification email sent'
  });
});
```

#### 2.5 Update Auth Routes
**File:** `src/routes/auth.routes.js`

```javascript
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', authenticateToken, resendVerification);
```

---

## PHASE 3: PASSWORD RESET (2 hours)

### Implementation

#### 3.1 Add Auth Service Methods
**File:** `src/services/auth.service.js`

```javascript
// Request password reset
static async requestPasswordReset(email) {
  const user = await UserModel.findByEmail(email);

  if (!user) {
    // Don't reveal if email exists (security)
    logger.info(`Password reset requested for non-existent email: ${email}`);
    return;
  }

  // Generate reset token (15 minutes expiry)
  const resetToken = await VerificationTokenModel.create(
    user.id,
    'password_reset',
    15
  );

  // Send reset email
  await emailService.sendPasswordResetEmail(user, resetToken.token);
}

// Reset password with token
static async resetPassword(token, newPassword) {
  const resetToken = await VerificationTokenModel.findByToken(
    token,
    'password_reset'
  );

  if (!resetToken) {
    throw new Error('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await this.hashPassword(newPassword);

  // Update password
  await UserModel.update(resetToken.user_id, {
    password_hash: passwordHash
  });

  // Mark token as used
  await VerificationTokenModel.markAsUsed(resetToken.id);

  return true;
}
```

#### 3.2 Add Auth Controller Endpoints
**File:** `src/controllers/auth.controller.js`

```javascript
// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  await AuthService.requestPasswordReset(email);

  // Always return success (don't reveal if email exists)
  res.status(200).json({
    success: true,
    message: 'If the email exists, a reset link has been sent'
  });
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Validate password
  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: { message: 'Password must be at least 8 characters' }
    });
  }

  await AuthService.resetPassword(token, password);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully'
  });
});
```

#### 3.3 Update Routes
**File:** `src/routes/auth.routes.js`

```javascript
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
```

---

## PHASE 4: LINK GITHUB TO EXISTING ACCOUNT (1-2 hours)

### Implementation

#### 4.1 Update User Model
**File:** `src/models/user.model.js`

```javascript
// Link GitHub to existing account
static async linkGithubAccount(userId, githubProfile) {
  const { id: githubId, username, accessToken, avatarUrl } = githubProfile;

  // Check if GitHub ID already linked to another account
  const existingGithubUser = await this.findByGithubId(githubId);
  if (existingGithubUser && existingGithubUser.id !== userId) {
    throw new Error('GitHub account already linked to another user');
  }

  // Update user with GitHub info
  const result = await pool.query(
    `UPDATE users
     SET github_id = $1,
         github_username = $2,
         github_access_token = $3,
         avatar_url = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [githubId, username, accessToken, avatarUrl, userId]
  );

  return this.sanitizeUser(result.rows[0]);
}

// Unlink GitHub account
static async unlinkGithubAccount(userId) {
  const result = await pool.query(
    `UPDATE users
     SET github_id = NULL,
         github_username = NULL,
         github_access_token = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );

  return this.sanitizeUser(result.rows[0]);
}

// Check if GitHub is linked
static async hasGithubLinked(userId) {
  const result = await pool.query(
    `SELECT github_id FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.github_id !== null;
}
```

#### 4.2 Update GitHub Controller
**File:** `src/controllers/github.controller.js`

```javascript
// POST /api/github/link - Link GitHub to existing account
export const linkGithubAccount = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { code } = req.body;

  // Exchange code for token and get profile
  const githubProfile = await GitHubService.getGithubProfile(code);

  // Link to existing account
  const user = await UserModel.linkGithubAccount(userId, githubProfile);

  res.status(200).json({
    success: true,
    data: { user },
    message: 'GitHub account linked successfully'
  });
});

// DELETE /api/github/unlink - Unlink GitHub
export const unlinkGithubAccount = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const user = await UserModel.unlinkGithubAccount(userId);

  res.status(200).json({
    success: true,
    data: { user },
    message: 'GitHub account unlinked'
  });
});

// GET /api/github/status - Check if GitHub is linked
export const getGithubStatus = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  const isLinked = await UserModel.hasGithubLinked(userId);

  res.status(200).json({
    success: true,
    data: {
      isLinked,
      canPushToGithub: isLinked
    }
  });
});
```

#### 4.3 Update Routes
**File:** `src/routes/github.routes.js`

```javascript
router.post('/link', authenticateToken, linkGithubAccount);
router.delete('/unlink', authenticateToken, unlinkGithubAccount);
router.get('/status', authenticateToken, getGithubStatus);
```

---

## PHASE 5: PUSH TO GITHUB AFTER CONVERSION (2 hours)

### Implementation

#### 5.1 Fix User Model to Include GitHub Token
**File:** `src/models/user.model.js`

```javascript
// Fix findById to include github_access_token
static async findById(id) {
  const result = await pool.query(
    `SELECT id, email, full_name, github_id, github_username,
            github_access_token, avatar_url, email_verified,
            created_at, updated_at, last_login
     FROM users WHERE id = $1`,
    [id]
  );

  return result.rows[0];
}
```

#### 5.2 Implement Push Controller
**File:** `src/controllers/github.controller.js`

```javascript
// POST /api/github/push/:conversionId - Push converted project to GitHub
export const pushConvertedProject = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { conversionId } = req.params;
  const { repoName, description, isPrivate = true } = req.body;

  // Get user with GitHub token
  const user = await UserModel.findById(userId);

  if (!user.github_access_token) {
    return res.status(400).json({
      success: false,
      error: { message: 'GitHub account not linked' }
    });
  }

  // Get conversion job
  const job = await ConversionJobModel.findById(conversionId);

  if (!job || job.user_id !== userId) {
    return res.status(404).json({
      success: false,
      error: { message: 'Conversion job not found' }
    });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({
      success: false,
      error: { message: 'Conversion not completed yet' }
    });
  }

  // Initialize GitHub service
  const githubService = new GitHubService(user.github_access_token);

  // Create repository
  const repo = await githubService.createRepository({
    name: repoName || `flask-converted-${Date.now()}`,
    description: description || 'Converted from Django to Flask by FrameShift',
    private: isPrivate
  });

  // Push converted code
  await githubService.pushToRepo(
    job.converted_file_path,
    repo.clone_url,
    'main'
  );

  res.status(200).json({
    success: true,
    data: {
      repository: {
        name: repo.name,
        url: repo.html_url,
        clone_url: repo.clone_url
      }
    },
    message: 'Converted project pushed to GitHub successfully'
  });
});
```

---

## PHASE 6: CONVERSION COMPLETION/FAILURE EMAILS (1 hour)

### Implementation

#### 6.1 Update Conversion Service
**File:** `src/services/conversion.service.js`

```javascript
import emailService from './email.service.js';
import UserModel from '../models/user.model.js';

static async startConversion(jobId, projectPath, userId) {
  logger.info(`Starting conversion job ${jobId}`);

  try {
    const outputPath = await storageService.createConvertedDirectory(userId, jobId);
    await ConversionJobModel.markAsStarted(jobId);

    const result = await this.runPythonConversion(jobId, projectPath, outputPath);

    await ConversionJobModel.markAsCompleted(jobId, outputPath);
    await this.saveReport(jobId, result.report);

    // ✅ SEND SUCCESS EMAIL
    const user = await UserModel.findById(userId);
    const job = await ConversionJobModel.findById(jobId);
    await emailService.sendConversionCompleteEmail(user, job, result.report);

    logger.info(`Conversion job ${jobId} completed successfully`);

    return { success: true, jobId, outputPath, report: result.report };

  } catch (error) {
    logger.error(`Conversion job ${jobId} failed:`, error);

    await ConversionJobModel.markAsFailed(jobId, error.message);

    // ✅ SEND FAILURE EMAIL
    const user = await UserModel.findById(userId);
    const job = await ConversionJobModel.findById(jobId);
    await emailService.sendConversionFailedEmail(user, job, error.message);

    throw error;
  }
}
```

---

## PHASE 7: FRAMEWORK DETECTION (2-3 hours)

### Implementation

#### 7.1 Create Framework Detector
**File:** `python/analyzers/framework_detector.py`

```python
import os
from pathlib import Path
from typing import Dict, Optional

class FrameworkDetector:
    """Detect Python web framework used in a project"""

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)

    def detect(self) -> Dict:
        """
        Detect framework type
        Returns: {'framework': 'django|flask|fastapi|unknown', 'confidence': float, 'evidence': []}
        """
        evidence = []

        # Check for Django
        django_score = self._check_django(evidence)

        # Check for Flask
        flask_score = self._check_flask(evidence)

        # Check for FastAPI
        fastapi_score = self._check_fastapi(evidence)

        # Determine framework
        scores = {
            'django': django_score,
            'flask': flask_score,
            'fastapi': fastapi_score
        }

        max_framework = max(scores, key=scores.get)
        max_score = scores[max_framework]

        if max_score == 0:
            framework = 'unknown'
            confidence = 0
        else:
            framework = max_framework
            confidence = min(max_score / 10.0, 1.0)  # Normalize to 0-1

        return {
            'framework': framework,
            'confidence': confidence,
            'evidence': evidence,
            'scores': scores
        }

    def _check_django(self, evidence: list) -> int:
        """Check for Django indicators"""
        score = 0

        # Check for manage.py
        if self._file_exists('manage.py'):
            score += 5
            evidence.append('Found manage.py (Django project file)')

        # Check for settings.py
        settings_files = list(self.project_path.rglob('settings.py'))
        if settings_files:
            score += 4
            evidence.append('Found settings.py (Django configuration)')

        # Check for wsgi.py or asgi.py
        if self._file_exists_recursive('wsgi.py') or self._file_exists_recursive('asgi.py'):
            score += 2
            evidence.append('Found WSGI/ASGI configuration')

        # Check requirements.txt for Django
        if self._package_in_requirements('django'):
            score += 3
            evidence.append('Found Django in requirements.txt')

        # Check for Django apps pattern
        if self._file_exists_recursive('apps.py'):
            score += 2
            evidence.append('Found apps.py (Django app configuration)')

        return score

    def _check_flask(self, evidence: list) -> int:
        """Check for Flask indicators"""
        score = 0

        # Check for app.py or application.py
        if self._file_exists('app.py') or self._file_exists('application.py'):
            score += 4
            evidence.append('Found app.py (Flask application file)')

        # Check requirements.txt for Flask
        if self._package_in_requirements('flask'):
            score += 5
            evidence.append('Found Flask in requirements.txt')

        # Check for Flask patterns in code
        if self._code_contains_pattern('from flask import'):
            score += 3
            evidence.append('Found Flask imports in code')

        return score

    def _check_fastapi(self, evidence: list) -> int:
        """Check for FastAPI indicators"""
        score = 0

        # Check for main.py
        if self._file_exists('main.py'):
            score += 2
            evidence.append('Found main.py')

        # Check requirements.txt for FastAPI
        if self._package_in_requirements('fastapi'):
            score += 5
            evidence.append('Found FastAPI in requirements.txt')

        # Check for FastAPI patterns
        if self._code_contains_pattern('from fastapi import'):
            score += 4
            evidence.append('Found FastAPI imports in code')

        return score

    def _file_exists(self, filename: str) -> bool:
        return (self.project_path / filename).exists()

    def _file_exists_recursive(self, filename: str) -> bool:
        return len(list(self.project_path.rglob(filename))) > 0

    def _package_in_requirements(self, package_name: str) -> bool:
        req_file = self.project_path / 'requirements.txt'
        if not req_file.exists():
            return False

        content = req_file.read_text().lower()
        return package_name.lower() in content

    def _code_contains_pattern(self, pattern: str) -> bool:
        """Search for pattern in Python files"""
        for py_file in self.project_path.rglob('*.py'):
            try:
                if pattern in py_file.read_text():
                    return True
            except:
                continue
        return False
```

#### 7.2 Update Conversion Main Script
**File:** `python/main.py`

```python
from python.analyzers.framework_detector import FrameworkDetector

def main():
    # ... existing argument parsing ...

    try:
        # STEP 0: Framework Detection (5%)
        emit_progress(args.job_id, 'detecting_framework', 5,
                     'Detecting project framework')

        detector = FrameworkDetector(args.project_path)
        framework_info = detector.detect()

        logger.info(f"Detected framework: {framework_info['framework']} "
                   f"(confidence: {framework_info['confidence']})")

        # Validate it's Django
        if framework_info['framework'] != 'django':
            error_msg = (
                f"Project is not a Django project. "
                f"Detected: {framework_info['framework'].title()} "
                f"(confidence: {framework_info['confidence']:.0%}). "
                f"Evidence: {', '.join(framework_info['evidence'])}"
            )
            logger.error(error_msg)
            ProgressEmitter.emit_error(args.job_id, error_msg)
            sys.exit(1)

        if framework_info['confidence'] < 0.5:
            logger.warning(
                f"Low confidence Django detection: {framework_info['confidence']:.0%}"
            )

        # Step 1: Analyze Django project (10%)
        emit_progress(args.job_id, 'analyzing', 10, 'Analyzing Django project structure')
        # ... rest of existing code ...
```

#### 7.3 Update Conversion Service
**File:** `src/services/conversion.service.js`

Handle new error type:
```javascript
pythonProcess.on('close', (code) => {
  setTimeout(() => {
    if (isResolved) return;
    isResolved = true;

    if (code === 0) {
      if (result) {
        logger.info(`Python process exited successfully for job ${jobId}`);
        resolve(result);
      } else {
        const error = new Error('Python process completed but no result was received');
        logger.error(`Python process failed for job ${jobId}: ${error.message}`);
        reject(error);
      }
    } else if (code === 1 && errorOutput.includes('not a Django project')) {
      // Framework detection error - special handling
      const error = new Error(errorOutput);
      error.code = 'INVALID_FRAMEWORK';
      reject(error);
    } else {
      const error = new Error(errorOutput || `Python process exited with code ${code}`);
      logger.error(`Python process failed for job ${jobId}: ${error.message}`);
      reject(error);
    }
  }, 100);
});
```

---

## PHASE 8: GEMINI AI VERIFICATION (3-4 hours)

### Implementation

#### 8.1 Install Gemini SDK
**File:** `python/requirements.txt`

Add:
```
google-generativeai==0.3.2
```

#### 8.2 Create Gemini Verifier
**File:** `python/verifiers/gemini_verifier.py`

```python
import google.generativeai as genai
from typing import Dict, List
from ..utils.logger import logger
from ..utils.file_handler import FileHandler

class GeminiVerifier:
    """Verify Django-to-Flask conversion using Google Gemini"""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def verify_conversion(
        self,
        original_path: str,
        converted_path: str,
        conversion_results: Dict
    ) -> Dict:
        """
        Verify the conversion quality using Gemini AI

        Returns:
            {
                'overall_score': float (0-100),
                'summary': str,
                'suggestions': List[str],
                'issues_found': List[Dict],
                'confidence': float
            }
        """
        logger.info("Starting Gemini AI verification")

        # Prepare context for Gemini
        context = self._prepare_context(
            original_path,
            converted_path,
            conversion_results
        )

        # Generate prompt
        prompt = self._generate_verification_prompt(context)

        # Call Gemini API
        try:
            response = self.model.generate_content(prompt)
            verification_result = self._parse_gemini_response(response.text)

            logger.info(f"Gemini verification complete. Score: {verification_result['overall_score']}")
            return verification_result

        except Exception as e:
            logger.error(f"Gemini verification failed: {e}")
            return {
                'overall_score': 0,
                'summary': f'AI verification failed: {str(e)}',
                'suggestions': [],
                'issues_found': [],
                'confidence': 0,
                'error': str(e)
            }

    def _prepare_context(
        self,
        original_path: str,
        converted_path: str,
        results: Dict
    ) -> Dict:
        """Prepare context information for Gemini"""

        # Read sample files (limit to prevent token overflow)
        sample_django_model = self._read_sample_file(original_path, 'models.py')
        sample_flask_model = self._read_sample_file(converted_path, 'models.py')

        sample_django_view = self._read_sample_file(original_path, 'views.py')
        sample_flask_view = self._read_sample_file(converted_path, 'views.py')

        return {
            'conversion_stats': {
                'models_converted': results.get('models', {}).get('total_models', 0),
                'views_converted': results.get('views', {}).get('total_views', 0),
                'urls_converted': results.get('urls', {}).get('total_patterns', 0),
                'templates_converted': results.get('templates', {}).get('total_templates', 0)
            },
            'issues': results.get('models', {}).get('issues', []),
            'warnings': results.get('models', {}).get('warnings', []),
            'sample_conversions': {
                'model': {
                    'django': sample_django_model[:500] if sample_django_model else None,
                    'flask': sample_flask_model[:500] if sample_flask_model else None
                },
                'view': {
                    'django': sample_django_view[:500] if sample_django_view else None,
                    'flask': sample_flask_view[:500] if sample_flask_view else None
                }
            }
        }

    def _generate_verification_prompt(self, context: Dict) -> str:
        """Generate detailed prompt for Gemini"""

        return f"""You are an expert Python web developer specializing in Django and Flask frameworks.

I've automatically converted a Django project to Flask. Please review the conversion quality.

**Conversion Statistics:**
- Models converted: {context['conversion_stats']['models_converted']}
- Views converted: {context['conversion_stats']['views_converted']}
- URLs converted: {context['conversion_stats']['urls_converted']}
- Templates converted: {context['conversion_stats']['templates_converted']}

**Detected Issues:**
{self._format_issues(context['issues'])}

**Sample Model Conversion:**
Django:
```python
{context['sample_conversions']['model']['django'] or 'N/A'}
```

Flask (Converted):
```python
{context['sample_conversions']['model']['flask'] or 'N/A'}
```

**Sample View Conversion:**
Django:
```python
{context['sample_conversions']['view']['django'] or 'N/A'}
```

Flask (Converted):
```python
{context['sample_conversions']['view']['flask'] or 'N/A'}
```

**Please provide:**
1. Overall quality score (0-100)
2. Summary of conversion quality
3. List of critical issues found
4. Suggestions for improvement
5. Confidence level (0-100)

Format your response as JSON:
```json
{{
  "overall_score": <number>,
  "summary": "<string>",
  "issues_found": [
    {{"severity": "high|medium|low", "description": "<string>", "file": "<string>"}}
  ],
  "suggestions": ["<string>", ...],
  "confidence": <number>
}}
```
"""

    def _format_issues(self, issues: List[Dict]) -> str:
        """Format issues for prompt"""
        if not issues:
            return "None detected"

        formatted = []
        for issue in issues[:5]:  # Limit to first 5
            formatted.append(f"- {issue.get('type', 'Unknown')}: {issue.get('message', 'No message')}")

        if len(issues) > 5:
            formatted.append(f"... and {len(issues) - 5} more")

        return '\n'.join(formatted)

    def _read_sample_file(self, base_path: str, filename: str) -> str:
        """Read a sample file for verification"""
        files = FileHandler.find_files(base_path, filename)
        if files:
            try:
                return FileHandler.read_file(str(files[0]))
            except:
                return None
        return None

    def _parse_gemini_response(self, response_text: str) -> Dict:
        """Parse Gemini's JSON response"""
        import json
        import re

        # Extract JSON from markdown code blocks if present
        json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
        if json_match:
            json_text = json_match.group(1)
        else:
            json_text = response_text

        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            logger.error("Failed to parse Gemini response as JSON")
            return {
                'overall_score': 50,
                'summary': response_text[:500],
                'issues_found': [],
                'suggestions': [],
                'confidence': 30
            }
```

#### 8.3 Update Main Script
**File:** `python/main.py`

```python
from python.verifiers.gemini_verifier import GeminiVerifier

def main():
    # ... existing code ...

    # Step 6: AI Verification (90%)
    emit_progress(args.job_id, 'verifying', 90, 'Verifying conversion with AI')

    verification_result = {}

    if args.gemini_api_key:
        try:
            verifier = GeminiVerifier(args.gemini_api_key)
            verification_result = verifier.verify_conversion(
                args.project_path,
                args.output_path,
                {
                    'models': models_result,
                    'views': views_result,
                    'urls': urls_result,
                    'templates': templates_result
                }
            )
            logger.info(f"AI verification score: {verification_result.get('overall_score', 0)}")
        except Exception as e:
            logger.error(f"AI verification error: {e}")
            verification_result = {'error': str(e), 'overall_score': 0}
    else:
        verification_result = {
            'note': 'AI verification skipped (no API key provided)',
            'gemini_enabled': False
        }

    # ... continue with report generation ...
```

---

## PHASE 9: IMPROVE CONVERSION ACCURACY (4-6 hours)

### 9.1 Django Forms → WTForms Converter

**File:** `python/converters/forms_converter.py`

```python
import ast
import re
from typing import Dict, List
from ..utils.logger import logger
from ..utils.file_handler import FileHandler

class FormsConverter:
    """Convert Django Forms to WTForms"""

    def __init__(self, project_path: str, output_path: str):
        self.project_path = project_path
        self.output_path = output_path
        self.conversion_map = self._load_form_mappings()

    def convert(self) -> Dict:
        """Convert all Django forms to WTForms"""
        logger.info("Starting forms conversion")

        forms_files = FileHandler.find_files(self.project_path, 'forms.py')

        converted_files = []
        total_forms = 0
        issues = []
        warnings = []

        for forms_file in forms_files:
            try:
                result = self._convert_forms_file(forms_file)
                converted_files.append(result['output_file'])
                total_forms += result['forms_count']
                issues.extend(result['issues'])
                warnings.extend(result['warnings'])
            except Exception as e:
                logger.error(f"Failed to convert {forms_file}: {e}")
                issues.append({
                    'file': str(forms_file),
                    'error': str(e)
                })

        logger.info(f"Forms conversion complete. Converted {total_forms} forms")

        return {
            'total_forms': total_forms,
            'converted_files': converted_files,
            'issues': issues,
            'warnings': warnings
        }

    def _load_form_mappings(self) -> Dict:
        """Load Django to WTForms field mappings"""
        return {
            'CharField': 'StringField',
            'EmailField': 'EmailField',
            'IntegerField': 'IntegerField',
            'FloatField': 'FloatField',
            'DecimalField': 'DecimalField',
            'BooleanField': 'BooleanField',
            'DateField': 'DateField',
            'DateTimeField': 'DateTimeField',
            'TimeField': 'TimeField',
            'ChoiceField': 'SelectField',
            'MultipleChoiceField': 'SelectMultipleField',
            'FileField': 'FileField',
            'ImageField': 'FileField',  # WTForms doesn't have ImageField
            'URLField': 'URLField',
            'SlugField': 'StringField',
            'PasswordField': 'PasswordField',
            'TextInput': 'StringField',
            'Textarea': 'TextAreaField',
            'ModelChoiceField': 'QuerySelectField',  # Requires query_factory
            'ModelMultipleChoiceField': 'QuerySelectMultipleField'
        }

    def _convert_forms_file(self, forms_file: str) -> Dict:
        """Convert a single forms.py file"""
        # Implementation similar to models_converter
        # Parse AST, replace field types, validators
        # Return converted code
        pass
```

### 9.2 Enhanced Models Conversion

Update `python/converters/models_converter.py` to handle:
- Complex ForeignKey relationships with proper back_populates
- ManyToMany with association tables
- Model inheritance
- Custom managers
- Model methods preservation

### 9.3 Enhanced Views Conversion

Update `python/converters/views_converter.py` to handle:
- Class-based views → Flask MethodViews
- Mixins conversion
- Form handling in views
- Better request/response handling
- Context processors

---

## 📅 IMPLEMENTATION TIMELINE

### Week 1: Core Auth Features
- **Day 1-2:** Email Service + Templates (Phase 1)
- **Day 3:** Email Verification (Phase 2)
- **Day 4:** Password Reset (Phase 3)
- **Day 5:** Link GitHub Account (Phase 4)

### Week 2: GitHub & Conversion Features
- **Day 1:** Push to GitHub (Phase 5)
- **Day 2:** Conversion Emails (Phase 6)
- **Day 3-4:** Framework Detection (Phase 7)
- **Day 5:** Testing & Bug Fixes

### Week 3: AI & Accuracy
- **Day 1-2:** Gemini AI Verification (Phase 8)
- **Day 3-4:** Conversion Accuracy Improvements (Phase 9)
- **Day 5:** Testing & Documentation

---

## 🧪 TESTING CHECKLIST

### Auth Testing
- [ ] Register with email → Receive welcome email
- [ ] Click verification link → Email verified
- [ ] Forgot password → Receive reset email
- [ ] Reset password with token → Password updated
- [ ] Login with GitHub → Account created
- [ ] Link GitHub to existing account → GitHub linked
- [ ] Unlink GitHub → GitHub unlinked

### GitHub Push Testing
- [ ] Convert project → Conversion completes
- [ ] Push to GitHub (linked account) → Repo created and code pushed
- [ ] Try push without GitHub → Error shown
- [ ] Download ZIP (no GitHub) → ZIP downloaded

### Framework Detection Testing
- [ ] Upload Django project → Conversion starts
- [ ] Upload Flask project → Error: "Not a Django project"
- [ ] Upload random Python project → Error shown
- [ ] Upload non-Python project → Error shown

### AI Verification Testing
- [ ] Convert with Gemini API key → AI analysis included
- [ ] Convert without API key → No AI analysis
- [ ] Check AI suggestions → Meaningful suggestions
- [ ] Check AI score → Reasonable accuracy

### Email Testing
- [ ] Conversion succeeds → Success email received
- [ ] Conversion fails → Failure email received
- [ ] Email has download link → Link works
- [ ] Email has error details → Error shown

---

## 🔧 ENVIRONMENT VARIABLES NEEDED

Add to `.env`:

```env
# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=FrameShift <noreply@frameshift.com>

# Frontend
FRONTEND_URL=http://localhost:3001

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# GitHub (already exists)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

---

## 📊 API ENDPOINTS ADDED

### Auth Endpoints
```
POST   /api/auth/verify-email          - Verify email with token
POST   /api/auth/resend-verification   - Resend verification email
POST   /api/auth/forgot-password       - Request password reset
POST   /api/auth/reset-password        - Reset password with token
```

### GitHub Endpoints
```
POST   /api/github/link                - Link GitHub to account
DELETE /api/github/unlink              - Unlink GitHub
GET    /api/github/status              - Check if GitHub linked
POST   /api/github/push/:conversionId  - Push to GitHub
```

---

## 🎯 SUCCESS CRITERIA

### Authentication
- ✅ Users receive all 5 email types
- ✅ Email verification works
- ✅ Password reset works
- ✅ GitHub can be linked/unlinked

### GitHub Integration
- ✅ Push button shown only when GitHub linked
- ✅ ZIP download always available
- ✅ Push creates repo and pushes code

### Conversion Quality
- ✅ Framework detection prevents invalid conversions
- ✅ Gemini AI provides meaningful analysis
- ✅ Conversion accuracy > 85% for standard Django projects
- ✅ Forms, models, views, URLs all converted

---

**Ready to start implementation? Let me know which phase to begin with!** 🚀
