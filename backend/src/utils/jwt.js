import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

/**
 * Generate JWT token for user
 * @param {Object} payload - Token payload (usually user ID)
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
export const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Decode JWT token without verification (for getting payload)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    throw new Error('Token decoding failed');
  }
};

/**
 * Generate access token for user
 * @param {string} userId - User ID
 * @returns {string} Access token
 */
export const generateAccessToken = (userId) => {
  return generateToken({ userId }, '15m'); // Short-lived access token
};

/**
 * Generate refresh token for user
 * @param {string} userId - User ID
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (userId) => {
  return generateToken({ userId, type: 'refresh' }, '7d'); // Long-lived refresh token
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string|null} Token or null
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}; 