# Sparqit Project Startup Guide

This guide will help you set up, run, and use the full-stack Sparqit platform, including all major features: file uploads, workspace management, AI content generation, voice chat, and more.

---

## Project Structure

```
sparqit-new/
├── frontend/          # React/Vite frontend application
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   ├── package.json  # Frontend dependencies
│   └── ...           # Frontend config files
├── backend/          # Node.js/Express backend
│   ├── src/          # Backend source code
│   ├── package.json  # Backend dependencies
│   └── ...           # Backend config files
├── run-frontend.sh   # Script to run frontend

└── README.md         # This file
```

---

## 1. Prerequisites
- **Node.js** (v18+ recommended)
- **npm** (comes with Node.js)
- **PostgreSQL** (running locally or in the cloud)
- **AWS Account** (for S3 file storage)
- **OpenAI API Key** (for AI features)

---

## 2. Environment Setup

### Backend
- Go to the backend directory:
  ```bash
  cd backend
  ```
- Create a `.env` file with the following (edit as needed):
  ```env
  PORT=5001
  NODE_ENV=development
  DATABASE_URL=postgresql://sparqit_user:sparqit_password_123@localhost:5432/sparqit_new
  JWT_SECRET=your-super-secret-jwt-key
  JWT_EXPIRES_IN=7d
  CORS_ORIGIN=http://localhost:8080
  # AWS S3
  AWS_ACCESS_KEY_ID=your-aws-access-key-id
  AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
  AWS_REGION=us-east-1
  AWS_S3_BUCKET_NAME=sparqit-uploads
  # OpenAI
  OPENAI_API_KEY=your-openai-api-key

  ```
- Ensure your PostgreSQL database is running and accessible.

### Frontend
- (Optional) Set custom API URLs if needed.

---

## 3. Install Dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

---

## 4. Database Setup

Run the setup script to sync tables:
```bash
cd backend
npm run setup-db
```

---

## 5. Start the Project

### Backend Only
```bash
cd backend
npm run dev
```
- Backend: [http://localhost:5001](http://localhost:5001)
- Health: [http://localhost:5001/api/health](http://localhost:5001/api/health)





### Frontend
Open a new terminal:
```bash
cd frontend
npm run dev
```
- Frontend: [http://localhost:8080](http://localhost:8080)

**Or use the script:**
```bash
./run-frontend.sh
```

---

## 6. Major Features & Usage

### 1. **Workspace Management**
- Create, rename, and delete workspaces
- Each user has their own workspaces
- Soft deletion and settings support

### 2. **File Uploads (PDF, S3)**
- Upload PDFs to workspaces (max 50MB)
- Files stored in AWS S3, organized by workspace
- File status: pending, processed, failed
- Download, delete, and view files

### 3. **AI Content Generation**
- Generate exams, quizzes, flashcards, cheat sheets, study guides, and notes from workspace content
- Uses OpenAI API for content generation
- Generated files are added to the workspace

### 4. **Voice Chat & Video Calls**
- Real-time voice chat with AI assistant
- Continuous mode toggle for hands-free conversation
- Video call page with integrated voice chat

### 5. **URL & Handwriting Processing**
- Add content by pasting URLs (websites, YouTube, etc.)
- Upload handwriting for AI analysis
- Summaries and extracted content are added to workspace

### 6. **To-Do Management**
- Add, view, and manage to-dos per workspace

---

## 7. API Overview

### Workspaces
- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces` - Create workspace
- `PUT /api/workspaces/:id` - Rename workspace
- `DELETE /api/workspaces/:id` - Delete workspace

### Files
- `POST /api/files/upload/:workspaceId` - Upload PDF
- `GET /api/files/workspace/:workspaceId` - List files
- `GET /api/files/:id/download` - Download file
- `DELETE /api/files/:id` - Delete file

### Generate (AI Content)
- `POST /api/generate/{exam|quiz|practice|flashcards|cheatsheet|studyguide|notes}/:workspaceId`

### Voice Chat
- `GET /api/voice-chat/status` - Check availability
- `POST /api/voice-chat/context/:fileId` - Get file context
- `POST /api/voice-chat/continuous/start` - Start continuous session

### To-Dos
- `POST /api/workspaces/:workspaceId/todos` - Add to-do
- `GET /api/workspaces/:workspaceId/todos` - List to-dos

### URL & Handwriting
- `POST /api/urls/process/:workspaceId` - Add content from URL
- `POST /api/handwriting/upload/:workspaceId` - Upload handwriting

---

## 8. Frontend Usage
- **Sidebar:** Manage workspaces, upload files, and access AI features
- **Dialogs:** For file upload, URL paste, and AI content generation
- **Voice Chat Panel:** Connect, record, and chat with AI
- **Video Call Page:** Video + voice chat with AI assistant
- **To-Do List:** Manage tasks per workspace

---

## 9. Troubleshooting

- **Port already in use:** Change `PORT` in `.env` or use a different frontend port
- **JWT_SECRET error:** Ensure `.env` is present and correct in `backend/`
- **Database connection errors:** Ensure PostgreSQL is running and credentials are correct
- **S3 errors:** Check AWS credentials and bucket name
- **OpenAI errors:** Check your API key and usage limits
- **Voice chat issues:** Ensure `OPENAI_API_KEY` is set
- **Frontend can't reach backend:** Ensure backend is running and accessible at the correct port
- **File upload issues:** Only PDFs up to 50MB are allowed
- **General:** Check logs in terminal for error messages

---

## 10. Useful Commands
- **Restart backend:**
  ```bash
  cd backend
  npm run dev
  ```
- **Restart frontend:**
  ```bash
  cd frontend
  npm run dev
  ```

- **Re-sync database tables:**
  ```bash
  cd backend
  npm run setup-db
  ```

---

## 11. Need Help?
If you get stuck, check the logs in your terminal for error messages. Most issues are due to:
- Incorrect `.env` config
- Database not running
- Port conflicts
- Missing dependencies (run `npm install`)
- AWS/OpenAI misconfiguration

For more help, check the detailed docs in the repo or ask the team! 