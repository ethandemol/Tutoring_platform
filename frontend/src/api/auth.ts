// Real authentication API for Sparqit backend
import { buildApiUrl, API_ENDPOINTS } from './config.js';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  errors?: Array<{ field: string; message: string; value?: string }>;
}

// Helper function to make API calls
const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<AuthResponse> => {
  const url = buildApiUrl(endpoint);
  console.log('🌐 Making API call to:', url);
  console.log('📤 Request options:', options);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('📥 Response data:', data);
    
    return data;
  } catch (error) {
    console.error('❌ API call failed:', error);
    return {
      success: false,
      message: 'Network error. Please check your connection.',
    };
  }
};

// Real API endpoints
export const authAPI = {
  // Login endpoint
  login: async (email: string, password: string): Promise<AuthResponse> => {
    console.log('🔐 Attempting login for:', email);
    return apiCall(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Register endpoint
  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    console.log('📝 Attempting registration for:', email, name);
    return apiCall(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  // Verify token endpoint
  verify: async (token: string): Promise<AuthResponse> => {
    console.log('🔍 Verifying token');
    return apiCall(API_ENDPOINTS.AUTH.VERIFY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
}; 