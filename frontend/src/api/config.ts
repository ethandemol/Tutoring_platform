// Centralized API configuration
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return 'http://localhost:5002';
  }
  
  // Ensure the URL has a protocol
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl;
  }
  
  // Add https:// if no protocol is provided
  return `https://${envUrl}`;
};

export const API_BASE_URL = getApiBaseUrl();

console.log('🔧 API Configuration:');
console.log('  - VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  - API_BASE_URL:', API_BASE_URL);

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    VERIFY: '/auth/verify',
  },
  
  // Workspaces
  WORKSPACES: {
    LIST: '/workspaces',
    CREATE: '/workspaces',
    UPDATE: (id: string) => `/workspaces/${id}`,
    DELETE: (id: string) => `/workspaces/${id}`,
    THEME: (id: string) => `/workspaces/${id}/theme`,
    FILES: (id: string) => `/workspaces/${id}/files`,
    TODOS: (id: string) => `/workspaces/${id}/todos`,
    CATEGORIES: (id: string) => `/workspaces/${id}/categories`,
  },
  
  // Files
  FILES: {
    UPLOAD: (workspaceId: string) => `/files/upload/${workspaceId}`,
    WORKSPACE: (workspaceId: string) => `/files/workspace/${workspaceId}`,
    DOWNLOAD: (id: string) => `/files/${id}/download`,
    PREVIEW: (id: string) => `/files/${id}/preview`,
    DELETE: (id: string) => `/files/${id}`,
    UPDATE: (id: string) => `/files/${id}`,
    CATEGORY: (id: string) => `/files/${id}/category`,
  },
  
  // Folders
  FOLDERS: {
    WORKSPACE: (workspaceId: string) => `/folders/workspace/${workspaceId}`,
    CREATE: '/folders',
    UPDATE: (id: string) => `/folders/${id}`,
    ADD_FILES: (id: string) => `/folders/${id}/files`,
    MOVE_FILES: (id: string) => `/folders/${id}/move-files`,
    DELETE: (id: string) => `/folders/${id}`,
  },
  
  // Chat
  CHAT: {
    SESSIONS: '/chat-sessions/sessions',
    RECENT_SESSIONS: '/chat-sessions/recent-sessions',
    SESSION: (id: string) => `/chat-sessions/sessions/${id}`,
    MESSAGES: (id: string) => `/chat-sessions/sessions/${id}/messages`,
    STAR: (id: string) => `/chat-sessions/sessions/${id}/star`,
    MODELS: '/chat/models',
  },
  
  // RAG
  RAG: {
    MESSAGE: '/rag/message',
  },
  
  // Generate
  GENERATE: {
    CONTENT: '/generate-new/content',
    FILE: (fileId: string) => `/generate-new/file/${fileId}`,
    WORKSPACE: (workspaceId: string) => `/generate-new/workspace/${workspaceId}`,
  },
  
  // URLs
  URLS: {
    PROCESS: (workspaceId: string) => `/urls/process/${workspaceId}`,
  },
  
  // Handwriting
  HANDWRITING: {
    UPLOAD: (workspaceId: string) => `/handwriting/upload/${workspaceId}`,
    PREVIEW_PDF: '/handwriting/preview-pdf',
    SAVE_PDFS: '/handwriting/save-pdfs',
  },
  
  // Transcribe
  TRANSCRIBE: {
    TRANSCRIBE: '/transcribe',
    TRANSCRIPT: (fileId: string) => `/transcript/${fileId}`,
  },
  
  // TTS
  TTS: {
    TTS: '/tts',
  },
  
  // Feedback
  FEEDBACK: {
    SUBMIT: '/feedback/submit',
  },
  
  // Todos
  TODOS: {
    LIST: (workspaceId: string) => `/workspaces/${workspaceId}/todos`,
    CREATE: (workspaceId: string) => `/workspaces/${workspaceId}/todos`,
    UPDATE: (workspaceId: string, todoId: string) => `/workspaces/${workspaceId}/todos/${todoId}`,
    DELETE: (workspaceId: string, todoId: string) => `/workspaces/${workspaceId}/todos/${todoId}`,
    TOGGLE: (workspaceId: string, todoId: string) => `/workspaces/${workspaceId}/todos/${todoId}/toggle`,
  },
}; 