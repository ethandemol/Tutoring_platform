import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';

interface File {
  id: number;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  s3Bucket: string;
  s3Url: string;
  workspaceId: number;
  userId: number;
  isProcessed: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FileContextType {
  files: File[];
  isLoading: boolean;
  error: string | null;
  uploadFile: (workspaceId: number, file: globalThis.File) => Promise<{ success: boolean; error?: string; file?: File }>;
  fetchFiles: (workspaceId: number) => Promise<void>;
  deleteFile: (fileId: number) => Promise<{ success: boolean; error?: string }>;
  getFile: (id: number) => File | undefined;
  getFilesByWorkspace: (workspaceId: number) => File[];
  downloadFile: (fileId: number) => Promise<{ success: boolean; error?: string; downloadUrl?: string }>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export const useFile = () => {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFile must be used within a FileProvider');
  }
  return context;
};

interface FileProviderProps {
  children: ReactNode;
}

export const FileProvider: React.FC<FileProviderProps> = ({ children }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchFiles = async (workspaceId: number) => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.WORKSPACE(workspaceId.toString())), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Filter out file-specific generated files from the file context (keep workspace-generated files)
        const nonGeneratedFiles = data.data.filter((file: File) => 
          file.metadata?.type !== 'generated' || !file.metadata?.sourceFileId
        );
        setFiles(nonGeneratedFiles);
      } else {
        setError(data.message || 'Failed to fetch files');
      }
    } catch (error) {
      console.error('Fetch files error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFile = async (workspaceId: number, file: globalThis.File): Promise<{ success: boolean; error?: string; file?: File }> => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.UPLOAD(workspaceId.toString())), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFiles(prev => [data.data, ...prev]);
        return { success: true, file: data.data };
      } else {
        return { success: false, error: data.message || 'Failed to upload file' };
      }
    } catch (error) {
      console.error('Upload file error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const deleteFile = async (fileId: number) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DELETE(fileId.toString())), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Failed to delete file' };
      }
    } catch (error) {
      console.error('Delete file error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const downloadFile = async (fileId: number) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DOWNLOAD(fileId.toString())), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true, downloadUrl: data.data.downloadUrl };
      } else {
        return { success: false, error: data.message || 'Failed to generate download URL' };
      }
    } catch (error) {
      console.error('Download file error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const getFile = (id: number) => {
    return files.find(f => f.id === id);
  };

  const getFilesByWorkspace = (workspaceId: number) => {
    return files.filter(f => f.workspaceId === workspaceId);
  };

  const value: FileContextType = {
    files,
    isLoading,
    error,
    uploadFile,
    fetchFiles,
    deleteFile,
    getFile,
    getFilesByWorkspace,
    downloadFile,
  };

  return <FileContext.Provider value={value}>{children}</FileContext.Provider>;
}; 