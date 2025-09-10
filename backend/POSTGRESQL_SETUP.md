# PostgreSQL Setup Guide

This guide will help you set up PostgreSQL for the Sparqit backend.

## Prerequisites

- PostgreSQL installed on your system
- Node.js and npm

## Installation

### macOS (using Homebrew)

```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create a database user (optional)
createuser --interactive sparqit_user
```

### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user
sudo -u postgres psql

# Create database user
CREATE USER sparqit_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sparqit TO sparqit_user;
\q
```

### Windows

1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember the password you set for the postgres user
4. Add PostgreSQL to your PATH

## Database Setup

### 1. Create Database

```bash
# Connect to PostgreSQL as postgres user
psql -U postgres

# Create database
CREATE DATABASE sparqit;

# Grant privileges (if using a separate user)
GRANT ALL PRIVILEGES ON DATABASE sparqit TO sparqit_user;

# Exit
\q
```

### 2. Configure Environment Variables

Edit your `.env` file:

```env
# For local development with default postgres user
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/sparqit

# Or with a custom user
DATABASE_URL=postgresql://sparqit_user:your_password@localhost:5432/sparqit
```

### 3. Run Database Setup

```bash
# Install dependencies
npm install

# Set up database (creates tables automatically)
npm run setup-db

# Start the server
npm run dev
```

## Cloud Database Options

### 1. Railway

1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Add PostgreSQL service
4. Copy the connection URL to your `.env` file

### 2. Supabase

1. Go to [Supabase](https://supabase.com/)
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string

### 3. Neon

1. Go to [Neon](https://neon.tech/)
2. Create a new project
3. Copy the connection string

### 4. PlanetScale

1. Go to [PlanetScale](https://planetscale.com/)
2. Create a new database
3. Copy the connection string

## Connection String Format

```
postgresql://username:password@host:port/database
```

### Examples:

```env
# Local development
DATABASE_URL=postgresql://postgres:password@localhost:5432/sparqit

# Railway
DATABASE_URL=postgresql://postgres:password@containers-us-west-1.railway.app:5432/railway

# Supabase
DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres

# Neon
DATABASE_URL=postgresql://user:password@ep-something.region.aws.neon.tech/neondb
```

## Troubleshooting

### Connection Issues

1. **Check if PostgreSQL is running:**
   ```bash
   # macOS
   brew services list | grep postgresql
   
   # Ubuntu
   sudo systemctl status postgresql
   ```

2. **Test connection:**
   ```bash
   psql -U postgres -d sparqit
   ```

3. **Check port:**
   ```bash
   # Default PostgreSQL port is 5432
   netstat -an | grep 5432
   ```

### Permission Issues

1. **Check user permissions:**
   ```sql
   \du
   ```

2. **Grant privileges:**
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE sparqit TO your_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
   ```

### SSL Issues (Cloud Databases)

For cloud databases, you might need SSL:

```env
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

## Database Management

### Useful Commands

```bash
# Connect to database
psql -U postgres -d sparqit

# List tables
\dt

# Describe table
\d users

# View data
SELECT * FROM users LIMIT 5;

# Exit
\q
```

### Backup and Restore

```bash
# Backup
pg_dump -U postgres sparqit > backup.sql

# Restore
psql -U postgres sparqit < backup.sql
```

## Performance Tips

1. **Indexes:** The application automatically creates indexes on `email` and `created_at`
2. **Connection Pooling:** Configured in `src/config/database.js`
3. **Query Optimization:** Use Sequelize's query methods for efficient queries

## Security

1. **Use strong passwords** for database users
2. **Limit database access** to application only
3. **Use environment variables** for sensitive data
4. **Enable SSL** for production databases
5. **Regular backups** of your data

## Next Steps

Once PostgreSQL is set up:

1. Start the backend: `npm run dev`
2. Test the API endpoints
3. Connect your frontend to the backend
4. Deploy to production with a cloud database 