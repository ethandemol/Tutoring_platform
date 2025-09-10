# Sparqit Backend API

A secure, scalable Node.js/Express backend for user authentication and management.

## Features

- 🔐 **JWT Authentication** with secure token management
- 🛡️ **Security** with bcrypt password hashing, rate limiting, and input validation
- 📊 **MongoDB** integration with Mongoose ODM
- ✅ **Input Validation** using express-validator
- 🚀 **Error Handling** with comprehensive error responses
- 📧 **Password Reset** functionality (email integration ready)
- 👥 **User Management** with role-based access control
- 🔄 **Token Refresh** for extended sessions

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (local or cloud)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
       Edit `.env` with your configuration:
    ```env
    PORT=5000
    DATABASE_URL=postgresql://username:password@localhost:5432/sparqit
    JWT_SECRET=your-super-secret-jwt-key
    JWT_EXPIRES_IN=7d
    ```

3. **Set up the database:**
   ```bash
   npm run setup-db
   ```

4. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login user | Public |
| POST | `/api/auth/logout` | Logout user | Private |
| GET | `/api/auth/verify` | Verify token | Private |
| POST | `/api/auth/refresh` | Refresh token | Private |
| POST | `/api/auth/forgot-password` | Request password reset | Public |
| POST | `/api/auth/reset-password` | Reset password | Public |

### User Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/user/profile` | Get current user profile | Private |
| PUT | `/api/user/profile` | Update user profile | Private |
| PUT | `/api/user/password` | Change password | Private |
| DELETE | `/api/user/account` | Deactivate account | Private |
| GET | `/api/user` | Get all users | Admin |
| GET | `/api/user/:id` | Get user by ID | Admin |
| PUT | `/api/user/:id/status` | Update user status | Admin |
| PUT | `/api/user/:id/role` | Update user role | Admin |

## Usage Examples

### Register a new user

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### Get user profile (authenticated)

```bash
curl -X GET http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update profile

```bash
curl -X PUT http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "preferences": {
      "theme": "dark"
    }
  }'
```

## Security Features

### Password Requirements
- Minimum 6 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable via environment variables

### Input Validation
- Email format validation
- Password strength requirements
- XSS protection with input sanitization
- SQL injection prevention

### JWT Security
- Configurable expiration times
- Secure token generation
- Token verification middleware
- Refresh token support

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/sparqit |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |

## Database Schema

### User Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(500),
  role VARCHAR(20) DEFAULT 'user',
  is_email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Please enter a valid email address",
      "value": "invalid-email"
    }
  ]
}
```

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
backend/
├── src/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── package.json
└── README.md
```

## Production Deployment

1. **Set production environment variables**
2. **Use a production MongoDB instance**
3. **Set up proper CORS origins**
4. **Use HTTPS in production**
5. **Set up monitoring and logging**
6. **Configure rate limiting appropriately**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details 