import { Upload, Link2, MessageCircle, PenTool, Video, FileText, Grid3X3, List, X, Eye, Download, Trash2, MoreVertical, Edit3, Plus, Youtube, Globe, Pencil, Brain, ChevronDown, CheckSquare, Square, Calendar, Activity, Phone, Mic, Zap, CheckCircle, BookOpen, Lightbulb, Palette, FolderOpen, FolderPlus, ArrowLeft, Folder } from "lucide-react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatPanel } from "./ChatPanel";
import { UrlPasteDialog } from "./UrlPasteDialog";
import { UrlPreviewDialog } from "./UrlPreviewDialog";
import { FileUpload } from "./FileUpload";
import { FileCard } from "./FileCard";
import { TodoList } from "./TodoList";
import { useToast } from "@/hooks/use-toast";
import { QuizConfigDialog, QuizConfig } from "./QuizConfigDialog";
import { ExamConfigDialog, ExamConfig } from "./ExamConfigDialog";
import { getWorkspaceEmoji, getWorkspaceBackgroundColor } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSelectionDialog } from "./FileSelectionDialog";
import { ThemeSelector } from "./ThemeSelector";
import { getThemeById, WorkspaceTheme } from "@/lib/themes";

interface FileItem {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  s3Url: string;
  workspaceId: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  folderId?: string; // Reference to folder
  metadata?: {
    type: 'youtube' | 'website' | 'generated' | 'handwriting_pdf';
    originalUrl?: string;
    title?: string;
    description?: string;
    summary?: string;
    videoId?: string;
    embedUrl?: string;
    channel?: string;
    thumbnail?: string;
    content?: string;
    generationType?: 'practice_questions' | 'exam' | 'quiz' | 'flashcards' | 'cheat_sheet' | 'study_guide' | 'notes';
    sourceWorkspace?: string;
    sourceFileId?: string | number;
    generatedAt?: string;
  };
}

interface Folder {
  id: string;
  name: string;
  workspaceId: number;
  createdAt: string;
  fileIds: string[]; // Array of file IDs in this folder
}

interface ContentItem {
  id: string;
  title: string;
  type: 'document' | 'slide' | 'homework';
  timestamp: string;
  description?: string;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
}

interface ChatSession {
  id: string;
  name: string;
  workspaceId?: string;
  fileId?: string;
  isStarred?: boolean;
  summary?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  mode?: 'chat' | 'call';
  messages?: any[];
  fileName?: string;
  file?: {
    originalName: string;
  };
  workspace?: {
    id: string;
    name: string;
  };
  isFileChat?: boolean;
  isWorkspaceChat?: boolean;
  isGeneralChat?: boolean;
}



interface MainContentProps {
  activeWorkspace: string | null;
  workspaceName: string;
  workspaceDescription?: string;
  onDescriptionUpdate?: (description: string) => void;
  onChatClick?: () => void;
  isChatOpen?: boolean;
  onCallClick?: () => void;
  isCallOpen?: boolean;
  isGenerating?: boolean;
  onGeneratingChange?: (isGenerating: boolean) => void;
  currentThemeId?: string;
}

export function MainContent({ activeWorkspace, workspaceName, workspaceDescription, onDescriptionUpdate, onChatClick, isChatOpen, onCallClick, isCallOpen, isGenerating, onGeneratingChange, currentThemeId: initialThemeId = 'navy' }: MainContentProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [fileToRename, setFileToRename] = useState<FileItem | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(workspaceDescription || "");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Folder-related state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isGenerateDropdownOpen, setIsGenerateDropdownOpen] = useState(false);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFilesForFolder, setSelectedFilesForFolder] = useState<Set<string>>(new Set());
  const [pendingFolderName, setPendingFolderName] = useState('');
  const [isFolderCreationMode, setIsFolderCreationMode] = useState(false);
  
  // Folder management state
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [newFolderNameForRename, setNewFolderNameForRename] = useState("");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  
  // Theme state
  const [currentThemeId, setCurrentThemeId] = useState(initialThemeId);
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>(getThemeById(initialThemeId));
  
  // Update theme when prop changes
  useEffect(() => {
    setCurrentThemeId(initialThemeId);
    setWorkspaceTheme(getThemeById(initialThemeId));
  }, [initialThemeId]);
  
  // New generation mode state
  const [isGenerationMode, setIsGenerationMode] = useState(false);
  const [selectedFilesForGeneration, setSelectedFilesForGeneration] = useState<Set<string>>(new Set());
  const [pendingGenerationType, setPendingGenerationType] = useState<string>('');
  
  // Quiz configuration state
  const [showQuizConfigDialog, setShowQuizConfigDialog] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({
    numQuestions: 10,
    questionType: 'both'
  });
  
  console.log('🔍 [MAIN CONTENT] Current quizConfig state:', quizConfig);
  
  // Exam configuration state
  const [showExamConfigDialog, setShowExamConfigDialog] = useState(false);
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    numMultipleChoice: 5,
    numShortAnswer: 3,
    numEssay: 2,
    totalPoints: 100
  });
  
  // ToDo state
  const [todos, setTodos] = useState<TodoItem[]>([]);


  const { toast } = useToast();
  
  // ToDo functions
  const handleAddTodo = async (todo: { text: string; dueDate?: string; workspaceId?: string }) => {
    if (!activeWorkspace) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.CREATE(activeWorkspace)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: todo.text,
          dueDate: todo.dueDate || null
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setTodos(prev => [...prev, data.data]);
        toast({
          title: "Todo added",
          description: "Todo has been added successfully",
        });
      } else {
        toast({
          title: "Error adding todo",
          description: data.message || "Failed to add todo",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error adding todo",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleToggleTodo = async (todoId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.TOGGLE(activeWorkspace, todoId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setTodos(prev => prev.map(todo => 
          todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
        ));
      }
    } catch (error) {
      toast({
        title: "Error updating todo",
        description: "Failed to update todo",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.DELETE(activeWorkspace, todoId)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setTodos(prev => prev.filter(todo => todo.id !== todoId));
        toast({
          title: "Todo deleted",
          description: "Todo has been deleted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting todo",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTodo = async (todoId: string, updates: { text?: string; dueDate?: string }) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.UPDATE(activeWorkspace, todoId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setTodos(prev => prev.map(todo => 
          todo.id === todoId ? { ...todo, ...updates } : todo
        ));
      } else {
        toast({
          title: "Error updating todo",
          description: data.message || "Failed to update todo",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error updating todo",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const fetchTodos = async () => {
    if (!activeWorkspace) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.LIST(activeWorkspace)), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTodos(data.data);
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };
  
  // Fetch todos when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      fetchTodos();
    }
  }, [activeWorkspace]);

  const fetchFolders = async () => {
    if (!activeWorkspace) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const url = buildApiUrl(API_ENDPOINTS.FOLDERS.WORKSPACE(activeWorkspace));
      console.log('🔍 [fetchFolders] Fetching folders from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      console.log('🔍 [fetchFolders] Response data:', data);
      
      if (response.ok && data.success) {
        console.log('🔍 [fetchFolders] Folders found:', data.data.length);
        setFolders(data.data);
      } else {
        console.error('🔍 [fetchFolders] Error response:', data);
        toast({
          title: "Error fetching folders",
          description: data.message || "Failed to load folders",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('🔍 [fetchFolders] Network error:', error);
      toast({
        title: "Error fetching folders",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const fetchFiles = async () => {
    if (!activeWorkspace) return;
    
    setIsLoadingFiles(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = buildApiUrl(API_ENDPOINTS.FILES.WORKSPACE(activeWorkspace));
      console.log('🔍 [fetchFiles] Fetching files from:', url);
      console.log('🔍 [fetchFiles] Workspace ID:', activeWorkspace);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('🔍 [fetchFiles] Response status:', response.status);
      const data = await response.json();
      console.log('🔍 [fetchFiles] Response data:', data);
      
      if (response.ok && data.success) {
        console.log('🔍 [fetchFiles] Files found:', data.data.length);
        setFiles(data.data);
      } else {
        console.error('🔍 [fetchFiles] Error response:', data);
        toast({
          title: "Error fetching files",
          description: data.message || "Failed to load files",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('🔍 [fetchFiles] Network error:', error);
      toast({
        title: "Error fetching files",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Update description value when workspace description changes
  useEffect(() => {
    setDescriptionValue(workspaceDescription || "");
  }, [workspaceDescription]);

  // Fetch files and folders when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      fetchFiles();
      fetchFolders();
    }
  }, [activeWorkspace]);







  const handleFileReorderDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFileReorderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFileReorderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDraggedIndex(null);
  };

  const handleFileReorderDragEnd = () => {
    setDraggedIndex(null);
  };

  const handlePreviewFile = (file: FileItem) => {
    // Navigate to the file preview page for all file types (PDFs and URL-based files)
    // The FilePreviewPage will handle different file types appropriately
    navigate(`/file/${file.id}`);
  };

  const handleDocumentPreview = (file: FileItem) => {
    // Navigate to the file preview page with chat (same as chat button)
    navigate(`/file/${file.id}`);
  };

  const getFileIcon = (file: FileItem) => {
    if (file.metadata?.type === 'youtube') {
      return <Youtube className="w-6 h-6 text-red-500" />;
    } else if (file.metadata?.type === 'website') {
      return <Globe className="w-6 h-6 text-blue-500" />;
    } else {
      return <FileText className="w-6 h-6 text-primary" />;
    }
  };

  const getFileTypeLabel = (file: FileItem) => {
    if (file.metadata?.type === 'youtube') {
      return 'YouTube Video';
    } else if (file.metadata?.type === 'website') {
      return 'Website';
    } else {
      return 'PDF Document';
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DOWNLOAD(file.id)), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        // Open the file in a new tab
        window.open(data.data.downloadUrl, '_blank');
        
        toast({
          title: "File opened",
          description: `${file.originalName} has been opened in a new tab`,
        });
      } else {
        toast({
          title: "Download failed",
          description: data.message || "Failed to get download URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DELETE(file.id)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "File deleted",
          description: `${file.originalName} has been deleted successfully`,
        });
        // Remove the file from the local state
        setFiles(prev => prev.filter(f => f.id !== file.id));
      } else {
        toast({
          title: "Delete failed",
          description: data.message || "Failed to delete file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  const handleRenameFile = async (file: FileItem) => {
    if (!newFileName.trim() || newFileName.trim() === file.originalName) {
      setFileToRename(null);
      setNewFileName("");
      return;
    }

    try {
      setIsRenaming(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(`/files/${file.id}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ originalName: newFileName.trim() }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "File renamed",
          description: `File has been renamed to "${newFileName.trim()}"`,
        });
        // Update the file in the local state
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, originalName: newFileName.trim() } : f
        ));
        setFileToRename(null);
        setNewFileName("");
      } else {
        toast({
          title: "Rename failed",
          description: data.message || "Failed to rename file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Rename failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const openRenameDialog = (file: FileItem) => {
    setFileToRename(file);
    setNewFileName(file.originalName);
  };

  const handleUpdateDescription = async () => {
    if (!activeWorkspace) return;

    setIsSavingDescription(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.UPDATE(activeWorkspace)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: descriptionValue.trim() || null }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Description updated",
          description: "Workspace description has been updated successfully",
        });
        setIsEditingDescription(false);
        // Update parent component's state
        if (onDescriptionUpdate) {
          onDescriptionUpdate(descriptionValue.trim());
        }
      } else {
        toast({
          title: "Update failed",
          description: data.message || "Failed to update description",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSavingDescription(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'processing': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const handleCreateFolder = async () => {
    if (!activeWorkspace || !newFolderName.trim()) return;
    
    // Store the folder name and switch to selection mode
    setPendingFolderName(newFolderName.trim());
    setSelectedFilesForFolder(new Set());
    setIsCreateFolderDialogOpen(false);
    setIsFolderCreationMode(true);
    
    toast({
      title: "Select files",
      description: `Select files to add to "${newFolderName.trim()}"`,
    });
  };

  const handleConfirmFolderCreation = async () => {
    if (!activeWorkspace || !pendingFolderName || selectedFilesForFolder.size === 0) return;
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Check if we're adding files to an existing folder
      const existingFolder = folders.find(f => f.name === pendingFolderName);
      
      if (existingFolder) {
        // Add files to existing folder
        const response = await fetch(buildApiUrl(API_ENDPOINTS.FOLDERS.ADD_FILES(existingFolder.id)), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileIds: Array.from(selectedFilesForFolder)
          }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Refresh folders and files from backend
          await fetchFolders();
          await fetchFiles();
          
          toast({
            title: "Files added to folder",
            description: `${selectedFilesForFolder.size} file${selectedFilesForFolder.size !== 1 ? 's' : ''} added to "${pendingFolderName}"`,
          });
        } else {
          toast({
            title: "Error adding files to folder",
            description: data.message || "Failed to add files to folder",
            variant: "destructive",
          });
        }
      } else {
        // Create new folder
        const response = await fetch(buildApiUrl(API_ENDPOINTS.FOLDERS.CREATE), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: pendingFolderName,
            workspaceId: parseInt(activeWorkspace),
            fileIds: Array.from(selectedFilesForFolder)
          }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Refresh folders and files from backend
          await fetchFolders();
          await fetchFiles();
          
          toast({
            title: "Folder created",
            description: `${selectedFilesForFolder.size} file${selectedFilesForFolder.size !== 1 ? 's' : ''} added to "${pendingFolderName}"`,
          });
        } else {
          toast({
            title: "Error creating folder",
            description: data.message || "Failed to create folder",
            variant: "destructive",
          });
        }
      }
      
      // Reset state
      setSelectedFilesForFolder(new Set());
      setPendingFolderName('');
      setIsFolderCreationMode(false);
      setNewFolderName('');
      
    } catch (error) {
      console.error('Error creating/updating folder:', error);
      toast({
        title: "Error creating/updating folder",
        description: "Failed to create or update folder",
        variant: "destructive",
      });
    }
  };

  const handleFileSelectionForFolderToggle = (fileId: string) => {
    setSelectedFilesForFolder(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleFolderClick = (folderId: string) => {
    setSelectedFolder(folderId);
  };

  const handleBackToFiles = () => {
    setSelectedFolder(null);
  };

  const getFilesInFolder = (folderId: string) => {
    return files.filter(file => file.folderId === folderId);
  };

  const getFilesNotInFolders = () => {
    return files.filter(file => !file.folderId);
  };

  const handleRenameFolder = async (folder: Folder) => {
    if (!newFolderNameForRename.trim() || newFolderNameForRename.trim() === folder.name) return;
    
    setIsRenamingFolder(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FOLDERS.UPDATE(folder.id)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderNameForRename.trim()
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh folders from backend
        await fetchFolders();
        
        toast({
          title: "Folder renamed",
          description: `"${folder.name}" has been renamed to "${newFolderNameForRename.trim()}"`,
        });
        
        setFolderToRename(null);
        setNewFolderNameForRename("");
      } else {
        toast({
          title: "Error renaming folder",
          description: data.message || "Failed to rename folder",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error renaming folder",
        description: "Failed to rename folder",
        variant: "destructive",
      });
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    setIsDeletingFolder(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FOLDERS.DELETE(folder.id)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh folders and files from backend
        await fetchFolders();
        await fetchFiles();
        
        // If we're currently viewing this folder, go back to files
        if (selectedFolder === folder.id) {
          setSelectedFolder(null);
        }
        
        toast({
          title: "Folder deleted",
          description: `"${folder.name}" has been deleted`,
        });
        
        setFolderToDelete(null);
      } else {
        toast({
          title: "Error deleting folder",
          description: data.message || "Failed to delete folder",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting folder",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleAddFilesToFolder = (folder: Folder) => {
    // Don't set selectedFolder - stay in main workspace view
    setIsFolderCreationMode(true);
    setSelectedFilesForFolder(new Set());
    setPendingFolderName(folder.name);
    
    toast({
      title: "Select files",
      description: `Select files to add to "${folder.name}"`,
    });
  };

  // Add handler to update file category


  const handleGenerateOption = async (option: string) => {
    if (!activeWorkspace) return;
    
    setIsGenerateDropdownOpen(false);
    setPendingGenerationType(option.toLowerCase().replace(/\s+/g, '_'));
    setIsGenerationMode(true);
    setSelectedFilesForGeneration(new Set());
    
    toast({
      title: "Select files",
      description: `Select files to generate ${option.toLowerCase()} from`,
    });
  };

  // Handle file selection confirmation
  const handleFileSelectionConfirm = async (selectedFileIds: string[], config?: QuizConfig | ExamConfig) => {
    if (!activeWorkspace || selectedFileIds.length === 0) return;
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Prepare request body
      const requestBody: any = {
        type: pendingGenerationType,
        fileIds: selectedFileIds
      };
      
      // Add configuration if provided
      if (config) {
        if (pendingGenerationType === 'quiz') {
          const quizConfig = config as QuizConfig;
          requestBody.numQuestions = quizConfig.numQuestions;
          requestBody.questionType = quizConfig.questionType;
        } else if (pendingGenerationType === 'exam') {
          const examConfig = config as ExamConfig;
          requestBody.numMultipleChoice = examConfig.numMultipleChoice;
          requestBody.numShortAnswer = examConfig.numShortAnswer;
          requestBody.numEssay = examConfig.numEssay;
          requestBody.totalPoints = examConfig.totalPoints;
        }
      }
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GENERATE.WORKSPACE(activeWorkspace)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Content generated!",
          description: "Your content has been created successfully",
        });
        
        // Refresh files to show newly generated content
        fetchFiles();
      } else {
        toast({
          title: "Generation failed",
          description: data.message || "Failed to generate content",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      // Reset state
      setIsGenerationMode(false);
      setSelectedFilesForGeneration(new Set());
      setPendingGenerationType('');
    }
  };

  // New functions for generation mode
  const handleFileSelectionToggle = (fileId: string) => {
    setSelectedFilesForGeneration(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleGenerationConfirm = async () => {
    if (pendingGenerationType === 'quiz') {
      setShowQuizConfigDialog(true);
    } else if (pendingGenerationType === 'exam') {
      setShowExamConfigDialog(true);
    } else {
      await handleFileSelectionConfirm(Array.from(selectedFilesForGeneration));
    }
  };

  const handleGenerationCancel = () => {
    setIsGenerationMode(false);
    setSelectedFilesForGeneration(new Set());
    setPendingGenerationType('');
  };

  // Handle quiz configuration confirmation
  const handleQuizConfigConfirm = async (config: QuizConfig) => {
    setQuizConfig(config);
    setShowQuizConfigDialog(false);
    await handleFileSelectionConfirm(Array.from(selectedFilesForGeneration), config);
  };

  // Handle exam configuration confirmation
  const handleExamConfigConfirm = async (config: ExamConfig) => {
    setExamConfig(config);
    setShowExamConfigDialog(false);
    await handleFileSelectionConfirm(Array.from(selectedFilesForGeneration), config);
  };

  const handleThemeChange = (themeId: string) => {
    setCurrentThemeId(themeId);
    setWorkspaceTheme(getThemeById(themeId));
  };

  // Helper function to get text color with proper contrast
  const getTextColor = (isMuted = false) => {
    if (isMuted) {
      return workspaceTheme.colors.muted;
    }
    return workspaceTheme.colors.text;
  };

  // Helper function to get card background with proper contrast
  const getCardBackground = () => {
    return workspaceTheme.colors.card;
  };

  // Helper function to get surface background with proper contrast
  const getSurfaceBackground = () => {
    return workspaceTheme.colors.surface;
  };

  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Welcome to Sparqit</h2>
          <p className="text-muted-foreground max-w-md">
            Create a workspace to start organizing your learning materials and collaborate with others.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Main Content */}
              <div className="flex flex-col bg-background transition-all duration-300 flex-1 min-w-0">
        {/* Header */}
        <div 
          className="backdrop-blur-sm"
          style={{ backgroundColor: `${workspaceTheme.colors.surface}80` }}
        >
          <div className="px-8 pt-12 pb-6 group pl-12">
            <div className="flex items-center justify-between mb-2 pl-4">
              <div className="flex items-center gap-3">
                <h1 
                  className="text-3xl font-bold"
                  style={{ color: getTextColor() }}
                >
                  {workspaceName}
                </h1>
              <span className="text-3xl">{getWorkspaceEmoji({ name: workspaceName })}</span>
              </div>
              <ThemeSelector
                workspaceId={activeWorkspace || ''}
                currentThemeId={currentThemeId}
                onThemeChange={handleThemeChange}
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Palette className="w-4 h-4" />
                    Theme
                  </Button>
                }
              />
            </div>
            {isEditingDescription ? (
              <div className="flex items-center gap-2 pl-4">
                <Input
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  placeholder="Add description (e.g., 'Maths A Levels', 'NYU Calc 3')"
                  className="max-w-md"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateDescription();
                    } else if (e.key === 'Escape') {
                      setIsEditingDescription(false);
                      setDescriptionValue(workspaceDescription || "");
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleUpdateDescription}
                  disabled={isSavingDescription}
                >
                  {isSavingDescription ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingDescription(false);
                    setDescriptionValue(workspaceDescription || "");
                  }}
                  disabled={isSavingDescription}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div 
                className="cursor-pointer hover:text-foreground transition-colors flex items-center gap-2 pl-4"
                onClick={() => setIsEditingDescription(true)}
                style={{ color: getTextColor(true) }}
              >
                <span>
                  {workspaceDescription || "Add Description"}
                </span>
                <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div 
          className="flex-1 p-8 space-y-6 overflow-y-auto min-w-0"
          style={{ backgroundColor: workspaceTheme.colors.background }}
        >
          {/* Top Row - ToDo and Action Widget */}
          <div className="flex flex-col lg:flex-row gap-6 -mt-6">
            {/* ToDo Section */}
            <div 
              className="w-full lg:w-1/3 lg:flex-shrink-0 rounded-lg p-6 min-w-0"
              style={{ 
                backgroundColor: getCardBackground(),
                border: `1px solid ${workspaceTheme.colors.cardBorder}`
              }}
            >
              <TodoList
                todos={todos}
                onToggleTodo={handleToggleTodo}
                onDeleteTodo={handleDeleteTodo}
                onUpdateTodo={handleUpdateTodo}
                onAddTodo={handleAddTodo}
                workspaceId={activeWorkspace}
                workspaceName={workspaceName}
                showWorkspaceInfo={false}
                theme={workspaceTheme}
              />
            </div>
          
          {/* Action Widget */}
          <div 
            className="w-full lg:w-2/3 rounded-lg p-6 min-w-0"
            style={{ 
              backgroundColor: getCardBackground(),
              border: `1px solid ${workspaceTheme.colors.cardBorder}`
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 
                className="text-xl font-display flex items-center gap-2"
                style={{ color: getTextColor() }}
              >
                <Zap className="w-5 h-5" style={{ color: workspaceTheme.colors.accent }} />
                Quick Actions
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Upload Action */}
              <div className="group">
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <div 
                      className="flex flex-col items-center p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group-hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${getSurfaceBackground()}, ${workspaceTheme.colors.background})`,
                        border: `1px solid ${workspaceTheme.colors.border}`,
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: workspaceTheme.colors.primary }}
                  >
                        <Upload className="w-6 h-6 text-white" />
                    </div>
                      <h4 
                        className="font-semibold mb-1"
                        style={{ color: getTextColor() }}
                      >
                        Upload Files
                      </h4>
                      <p 
                        className="text-xs text-center"
                        style={{ color: getTextColor(true) }}
                      >
                        Add PDFs, images, or documents
                      </p>
                        </div>
                </DialogTrigger>
              {isUploadDialogOpen && (
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload Files to {workspaceName}</DialogTitle>
                  </DialogHeader>
                  <FileUpload 
                    workspaceId={parseInt(activeWorkspace || '0')} 
                    onUploadComplete={() => {
                          setIsUploadDialogOpen(false);
                      fetchFiles();
                    }}
                  />
                </DialogContent>
              )}
            </Dialog>
              </div>

              {/* Paste URL Action */}
              <div className="group">
            <UrlPasteDialog
              workspaceId={activeWorkspace}
              workspaceName={workspaceName}
              onSuccess={fetchFiles}
                trigger={
                    <div 
                      className="flex flex-col items-center p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group-hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${getSurfaceBackground()}, ${workspaceTheme.colors.background})`,
                        border: `1px solid ${workspaceTheme.colors.border}`,
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: workspaceTheme.colors.secondary }}
                      >
                        <Link2 className="w-6 h-6 text-white" />
                      </div>
                      <h4 
                        className="font-semibold mb-1"
                        style={{ color: getTextColor() }}
                      >
                        Paste URL
                      </h4>
                      <p 
                        className="text-xs text-center"
                        style={{ color: getTextColor(true) }}
                      >
                        Import from websites or YouTube
                      </p>
                    </div>
                }
            />
          </div>

              {/* Chat Action */}
            {onChatClick && (
                <div className="group">
                  <div 
                    className="flex flex-col items-center p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group-hover:shadow-md"
                onClick={onChatClick}
                    style={{
                      background: `linear-gradient(135deg, ${getSurfaceBackground()}, ${workspaceTheme.colors.background})`,
                      border: `1px solid ${workspaceTheme.colors.border}`,
                    }}
                  >
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: isChatOpen ? workspaceTheme.colors.accent : workspaceTheme.colors.primary }}
              >
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <h4 
                      className="font-semibold mb-1"
                      style={{ color: getTextColor() }}
                    >
                Chat
                    </h4>
                    <p 
                      className="text-xs text-center"
                      style={{ color: getTextColor(true) }}
                    >
                      Ask questions about your files
                    </p>
                  </div>
                </div>
            )}

              {/* Speech Action */}
            {onCallClick && (
                <div className="group">
                  <div 
                    className="flex flex-col items-center p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group-hover:shadow-md"
                onClick={onCallClick}
                    style={{
                      background: `linear-gradient(135deg, ${getSurfaceBackground()}, ${workspaceTheme.colors.background})`,
                      border: `1px solid ${workspaceTheme.colors.border}`,
                    }}
              >
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: isCallOpen ? workspaceTheme.colors.accent : workspaceTheme.colors.secondary }}
                    >
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <h4 
                      className="font-semibold mb-1"
                      style={{ color: getTextColor() }}
                    >
                      Speech
                    </h4>
                    <p 
                      className="text-xs text-center"
                      style={{ color: getTextColor(true) }}
                    >
                      Voice conversations
                    </p>
                  </div>
                </div>
            )}

              {/* Generate Action */}
              <div className="group">
            <DropdownMenu open={isGenerateDropdownOpen} onOpenChange={setIsGenerateDropdownOpen}>
              <DropdownMenuTrigger asChild>
                    <div 
                      className="flex flex-col items-center p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group-hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${getSurfaceBackground()}, ${workspaceTheme.colors.background})`,
                        border: `1px solid ${workspaceTheme.colors.border}`,
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: workspaceTheme.colors.accent }}
                      >
                        <Brain className="w-6 h-6 text-white" />
                      </div>
                      <h4 
                        className="font-semibold mb-1"
                        style={{ color: getTextColor() }}
                      >
                  Generate
                      </h4>
                      <p 
                        className="text-xs text-center"
                        style={{ color: getTextColor(true) }}
                      >
                        Create study materials
                      </p>
                    </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleGenerateOption("Exams")}>
                      <FileText className="w-4 h-4 mr-2" />
                  Exams
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateOption("Quizzes")}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                  Quizzes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateOption("Flashcards")}>
                      <BookOpen className="w-4 h-4 mr-2" />
                  Flashcards
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateOption("Cheat Sheet")}>
                      <Lightbulb className="w-4 h-4 mr-2" />
                  Cheat Sheet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateOption("Study Guide")}>
                      <BookOpen className="w-4 h-4 mr-2" />
                  Study Guide
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateOption("Notes")}>
                      <FileText className="w-4 h-4 mr-2" />
                  Notes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              </div>

              {/* Create Folder Action */}
              <div className="group">
                <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
                  <DialogTrigger asChild>
                    <div 
                      className="flex flex-col items-center p-6 rounded-xl hover:scale-105 transition-all duration-200 cursor-pointer group-hover:shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${getSurfaceBackground()}, ${workspaceTheme.colors.background})`,
                        border: `1px solid ${workspaceTheme.colors.border}`,
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: workspaceTheme.colors.secondary }}
                      >
                        <FolderPlus className="w-6 h-6 text-white" />
                      </div>
                      <h4 
                        className="font-semibold mb-1"
                        style={{ color: getTextColor() }}
                      >
                        Create Folder
                      </h4>
                      <p 
                        className="text-xs text-center"
                        style={{ color: getTextColor(true) }}
                      >
                        Organize your files with new categories
                      </p>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Folder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="folder-name">Folder Name</Label>
                        <Input
                          id="folder-name"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Enter folder name..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                              handleCreateFolder();
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateFolderDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateFolder}
                          disabled={!newFolderName.trim()}
                        >
                          Create Folder
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
          </div>



          {/* Content Display Area */}
          <div className="space-y-4">
            {/* Content Header */}
            <div className="flex items-center justify-between min-w-0">
              <div>
                <h2 
                  className="text-xl font-semibold"
                  style={{ color: getTextColor() }}
                >
                  {isFolderCreationMode ? (
                    <div className="flex items-center gap-3">
                      <span>Select Files for "{pendingFolderName}"</span>
                      <div 
                        className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${workspaceTheme.colors.secondary}20`,
                          color: workspaceTheme.colors.secondary
                        }}
                      >
                        <FolderPlus className="w-4 h-4" />
                        Folder Creation
                      </div>
                    </div>
                  ) : isGenerationMode ? (
                    <div className="flex items-center gap-3">
                      <span>Select Files for Generation</span>
                      <div 
                        className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                        style={{ 
                          backgroundColor: `${workspaceTheme.colors.primary}20`,
                          color: workspaceTheme.colors.primary
                        }}
                      >
                        <Brain className="w-4 h-4" />
                        {pendingGenerationType === 'exam' && 'Exam'}
                        {pendingGenerationType === 'quiz' && 'Quiz'}
                        {pendingGenerationType === 'flashcards' && 'Flashcards'}
                        {pendingGenerationType === 'cheatsheet' && 'Cheat Sheet'}
                        {pendingGenerationType === 'studyguide' && 'Study Guide'}
                        {pendingGenerationType === 'notes' && 'Notes'}
                      </div>
                    </div>
                  ) : (
                    "All Files"
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isFolderCreationMode ? (
                    `${selectedFilesForFolder.size} file${selectedFilesForFolder.size !== 1 ? 's' : ''} selected for folder`
                  ) : isGenerationMode ? (
                    `${selectedFilesForGeneration.size} file${selectedFilesForGeneration.size !== 1 ? 's' : ''} selected for generation`
                  ) : (
                    `${files.length} file${files.length !== 1 ? 's' : ''}`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 relative">
                {isFolderCreationMode ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsFolderCreationMode(false);
                        setPendingFolderName('');
                        setSelectedFilesForFolder(new Set());
                      }}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmFolderCreation}
                      disabled={selectedFilesForFolder.size === 0}
                      className="gap-2"
                    >
                      <FolderPlus className="w-4 h-4" />
                      Create Folder ({selectedFilesForFolder.size})
                    </Button>
                  </>
                ) : isGenerationMode ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleGenerationCancel}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleGenerationConfirm}
                      disabled={selectedFilesForGeneration.size === 0}
                      className="gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      {pendingGenerationType === 'quiz' || pendingGenerationType === 'exam' ? 'Next' : 'Generate'} ({selectedFilesForGeneration.size})
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Loading State */}
            {isLoadingFiles && (
              <div className="text-center py-8">
                <div 
                  className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
                  style={{ borderColor: workspaceTheme.colors.primary }}
                ></div>
                <p 
                  className="text-sm mt-2"
                  style={{ color: getTextColor(true) }}
                >
                  Loading files...
                </p>
              </div>
            )}

            {/* Generating State */}
            {isGenerating && (
              <div className="text-center py-8">
                <div 
                  className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
                  style={{ borderColor: workspaceTheme.colors.primary }}
                ></div>
                <p 
                  className="text-sm mt-2"
                  style={{ color: getTextColor(true) }}
                >
                  Generating...
                </p>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingFiles && !isGenerating && files.length === 0 && folders.length === 0 && (
              <div className="text-center py-8">
                <FileText 
                  className="w-12 h-12 mx-auto mb-4"
                  style={{ color: getTextColor(true) }}
                />
                <h3 
                  className="text-lg font-medium mb-2"
                  style={{ color: getTextColor() }}
                >
                  No files yet
                </h3>
                <p 
                  className="text-sm mb-4"
                  style={{ color: getTextColor(true) }}
                >
                  Upload your first PDF to get started
                </p>
                <Button onClick={() => setIsUploadDialogOpen(true)}>
                  Upload File
                </Button>
              </div>
            )}

            {/* Files and Folders Grid/List */}
            {!isLoadingFiles && !isGenerating && (files.length > 0 || folders.length > 0) && (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 min-w-0' : 'space-y-4 min-w-0'}>
                
                {/* Show back button if viewing a folder */}
                {selectedFolder && (
                  <div className="col-span-full mb-4">
                    <Button
                      variant="outline"
                      onClick={handleBackToFiles}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Files
                    </Button>
                  </div>
                )}

                {/* Drop zone for moving files out of folders */}
                {selectedFolder && (
                  <div 
                    className="col-span-full p-6 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center hover:border-primary/50 transition-all duration-300"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      e.currentTarget.classList.add('border-primary', 'bg-primary/5', 'scale-105');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-primary', 'bg-primary/5', 'scale-105');
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-primary', 'bg-primary/5', 'scale-105');
                      
                      try {
                        const fileData = e.dataTransfer.getData('application/json');
                        if (fileData) {
                          const file = JSON.parse(fileData);
                          
                          // Call API to move file out of folder (set folderId to null)
                          const token = localStorage.getItem('authToken');
                          const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.UPDATE(file.id)), {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              folderId: null
                            })
                          });

                          if (response.ok) {
                            // Refresh files to show updated state
                            fetchFiles();
                            toast({
                              title: "File moved",
                              description: `${file.originalName} moved to root`,
                            });
                          } else {
                            throw new Error('Failed to move file');
                          }
                        }
                      } catch (error) {
                        console.error('Error moving file out of folder:', error);
                        toast({
                          title: "Error",
                          description: "Failed to move file out of folder",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Folder className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop files here to move them out of this folder</p>
                      <p className="text-xs text-muted-foreground">Files will be moved to the root level</p>
                    </div>
                  </div>
                )}

                {/* Show folders if not viewing a specific folder */}
                {!selectedFolder && folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all duration-300 hover:border-primary/20 cursor-pointer min-w-0 group"
                    onClick={() => handleFolderClick(folder.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      e.currentTarget.classList.add('border-primary', 'bg-primary/5', 'scale-105');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-primary', 'bg-primary/5', 'scale-105');
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-primary', 'bg-primary/5', 'scale-105');
                      
                      try {
                        const fileData = e.dataTransfer.getData('application/json');
                        if (fileData) {
                          const file = JSON.parse(fileData);
                          
                          // Call API to move file to folder
                          const token = localStorage.getItem('authToken');
                          const response = await fetch(buildApiUrl(API_ENDPOINTS.FOLDERS.MOVE_FILES(folder.id)), {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              fileIds: [file.id]
                            })
                          });

                          if (response.ok) {
                            // Refresh files to show updated state
                            fetchFiles();
                            toast({
                              title: "File moved",
                              description: `${file.originalName} moved to ${folder.name}`,
                            });
                          } else {
                            throw new Error('Failed to move file');
                          }
                        }
                      } catch (error) {
                        console.error('Error moving file to folder:', error);
                        toast({
                          title: "Error",
                          description: "Failed to move file to folder",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {/* Preview Image Section */}
                    <div className="mb-4">
                      <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex flex-col items-center justify-center">
                          <div className="mb-3">
                            <Folder className="w-12 h-12 text-blue-600" />
                          </div>
                                                  <div className="text-center">
                          <p className="text-sm font-medium text-blue-900 mb-1">Folder</p>
                          <p className="text-xs text-blue-700 mb-2">{folder.name}</p>
                          <p className="text-xs text-blue-600">
                            {folder.fileIds.length} file{folder.fileIds.length !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-blue-500 mt-1">Drop files here</p>
                        </div>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground line-clamp-2 text-sm">
                            {folder.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">Folder</p>
                        </div>
                        
                        {/* More Options Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 opacity-100" 
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { 
                              e.stopPropagation(); 
                              handleFolderClick(folder.id); 
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              Open Folder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { 
                              e.stopPropagation(); 
                              setFolderToRename(folder);
                              setNewFolderNameForRename(folder.name);
                            }}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { 
                              e.stopPropagation(); 
                              handleAddFilesToFolder(folder);
                            }}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Files
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setFolderToDelete(folder);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show files */}
                {(selectedFolder ? getFilesInFolder(selectedFolder) : getFilesNotInFolders()).map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    viewMode={viewMode}
                    onPreview={handleDocumentPreview}
                    onDownload={handleDownloadFile}
                    onRename={openRenameDialog}
                    onDelete={setFileToDelete}
                    categories={[]}
                    isGenerationMode={isGenerationMode || isFolderCreationMode}
                    isSelected={isGenerationMode ? selectedFilesForGeneration.has(file.id) : selectedFilesForFolder.has(file.id)}
                    onSelectionToggle={isGenerationMode ? handleFileSelectionToggle : handleFileSelectionForFolderToggle}
                    isDraggable={!isGenerationMode && !isFolderCreationMode}
                    onDragStart={(e, file) => {
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={(e) => {
                      // Optional: Add any cleanup or visual feedback
                    }}
                  />
                ))}
              </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete File</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{fileToDelete?.originalName}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => fileToDelete && handleDeleteFile(fileToDelete)}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Rename File Dialog */}
            <Dialog open={!!fileToRename} onOpenChange={(open) => !open && setFileToRename(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rename File</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="rename-file-name">New Name</Label>
                    <Input
                      id="rename-file-name"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="Enter new file name"
                      onKeyDown={(e) => e.key === 'Enter' && fileToRename && handleRenameFile(fileToRename)}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setFileToRename(null);
                        setNewFileName("");
                      }}
                      disabled={isRenaming}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => fileToRename && handleRenameFile(fileToRename)}
                      disabled={!newFileName.trim() || newFileName.trim() === fileToRename?.originalName || isRenaming}
                    >
                      {isRenaming ? "Renaming..." : "Rename"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* File selection is now handled inline in generation mode */}
          </div>
        </div>

        {/* Rename Folder Dialog */}
        <Dialog open={!!folderToRename} onOpenChange={(open) => !open && setFolderToRename(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rename-folder-name">New Name</Label>
                <Input
                  id="rename-folder-name"
                  value={newFolderNameForRename}
                  onChange={(e) => setNewFolderNameForRename(e.target.value)}
                  placeholder="Enter new folder name"
                  onKeyDown={(e) => e.key === 'Enter' && folderToRename && handleRenameFolder(folderToRename)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setFolderToRename(null);
                    setNewFolderNameForRename("");
                  }}
                  disabled={isRenamingFolder}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => folderToRename && handleRenameFolder(folderToRename)}
                  disabled={!newFolderNameForRename.trim() || newFolderNameForRename.trim() === folderToRename?.name || isRenamingFolder}
                >
                  {isRenamingFolder ? "Renaming..." : "Rename"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Folder Dialog */}
        <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Folder</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{folderToDelete?.name}"? This will move all files back to the main view. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingFolder}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => folderToDelete && handleDeleteFolder(folderToDelete)}
                disabled={isDeletingFolder}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingFolder ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Quiz Configuration Dialog */}
        <QuizConfigDialog
          isOpen={showQuizConfigDialog}
          onClose={() => setShowQuizConfigDialog(false)}
          onConfirm={handleQuizConfigConfirm}
          isGenerating={false}
        />

        {/* Exam Configuration Dialog */}
        <ExamConfigDialog
          isOpen={showExamConfigDialog}
          onClose={() => setShowExamConfigDialog(false)}
          onConfirm={handleExamConfigConfirm}
          isGenerating={false}
        />

        {/* Bottom Info */}
        <div className="border-t border-border bg-surface/50 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div className="text-sm text-muted-foreground">
              {files.length} File{files.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}