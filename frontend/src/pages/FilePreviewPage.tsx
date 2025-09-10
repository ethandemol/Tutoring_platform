import React, { useState, useEffect, useRef } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Download, ChevronLeft, ChevronRight, ArrowLeft, Settings, Star, Trash2, Plus, Video, Phone, PhoneOff, Mic, MicOff, MoreHorizontal, Play, Pause, RotateCcw, Volume2, VolumeX, Grid, List, BookOpen, Lightbulb, HelpCircle, Brain, Target, Zap, FileSpreadsheet, ClipboardList, Presentation, GraduationCap, BookMarked, Youtube, Globe, ExternalLink, MessageCircle, CheckCircle, Eye, FileQuestion, History, Edit3, ChevronDown, Send, Shield, X } from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Custom Components
import { AppSidebar } from '@/components/AppSidebar';
import { QuizConfigDialog, QuizConfig } from '@/components/QuizConfigDialog';
import { ExamConfigDialog, ExamConfig } from '@/components/ExamConfigDialog';
import { YouTubeTranscript } from '@/components/YouTubeTranscript';
import { FileVoiceCallPanel } from '@/components/FileVoiceCallPanel';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatModeSelector, ChatMode } from '@/components/ChatModeSelector';

// Hooks and Contexts
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/contexts/SidebarContext';

interface FileItem {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  processingStatus: string;
  createdAt: string;
  s3Key: string;
  workspaceId: number;
  metadata?: {
    type: 'youtube' | 'website' | 'handwriting_pdf' | 'generated';
    originalUrl?: string;
    title?: string;
    description?: string;
    summary?: string;
    videoId?: string;
    embedUrl?: string;
    channel?: string;
    thumbnail?: string;
    content?: string;
    // Generated file metadata
    generationType?: string;
    sourceFile?: string;
    sourceFileId?: string | number;
    generatedAt?: string;
  };
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sourceCitations?: SourceCitation[];
}

interface SourceCitation {
  chunkId: number;
  fileId: number;
  fileName: string;
  pageNumber?: number;
  startChar: number;
  endChar: number;
  similarity: number;
  chunkIndex: number;
  content: string;
  metadata?: {
    timestamp?: number;
    type?: string;
  };
}

interface ChatSession {
  id: string;
  name: string;
  workspaceId?: string;
  fileId?: string;
  mode?: 'chat' | 'call';
  isStarred?: boolean;
  summary?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

const URLContentViewer = ({ file }: { file: FileItem }) => {
  if (!file.metadata) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No content available
      </div>
    );
  }

  const { metadata } = file;

  if (metadata.type === 'youtube') {
    return (
      <div className="flex flex-col h-full">
        {/* YouTube Video Content */}
        <div className="flex-1 overflow-auto bg-muted p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Video Embed */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="aspect-video">
                <iframe
                  src={metadata.embedUrl}
                  title={metadata.title}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Video Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Youtube className="w-6 h-6 text-red-500" />
                  <h1 className="text-2xl font-bold text-foreground">{metadata.title}</h1>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(metadata.originalUrl, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Original
                </Button>
              </div>
              

            </div>

            {/* Transcript */}
            <YouTubeTranscript fileId={file.id} videoId={metadata.videoId} />
          </div>
        </div>
      </div>
    );
  }

  if (metadata.type === 'website') {
    return (
      <div className="flex flex-col h-full">
        {/* Website Content */}
        <div className="flex-1 overflow-auto bg-muted p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Website Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-blue-500" />
                  <h1 className="text-2xl font-bold text-foreground">{metadata.title}</h1>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(metadata.originalUrl, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Original
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-muted-foreground">{metadata.description}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">AI Summary</h3>
                  <p className="text-muted-foreground">{metadata.summary}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Content</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-muted-foreground whitespace-pre-wrap">{metadata.content}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Unknown content type
    </div>
  );
};

const PDFViewer = ({ file, viewMode, onExplainSelected, onAskSelected, pageNumber, onPageChange }: { 
  file: any, 
  viewMode: 'continuous' | 'single', 
  onExplainSelected: (context: string) => void, 
  onAskSelected: (context: string) => void,
  pageNumber: number,
  onPageChange: (page: number) => void
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const token = localStorage.getItem('authToken');
  const pdfUrl = `${buildApiUrl(API_ENDPOINTS.FILES.PREVIEW(file.id))}?token=${token}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const continuousContainerRef = useRef<HTMLDivElement>(null);
  const [showAskInput, setShowAskInput] = useState(false);
  const [askInputValue, setAskInputValue] = useState('');
  const [askAnchor, setAskAnchor] = useState<{top: number, left: number} | null>(null);

  // Set workerSrc for pdfjs
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

  // Update container width when container size changes
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setContainerWidth(Math.max(300, width - 48)); // Minimum width of 300px
      }
    };

    // Initial width
    updateWidth();

    // Create resize observer
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Scroll to specific page in continuous mode
  useEffect(() => {
    if (viewMode === 'continuous' && continuousContainerRef.current && numPages && pageNumber > 0) {
      console.log('🔄 [Scroll Effect Triggered]', { viewMode, pageNumber, numPages });
      
      // Wait a bit for the pages to render, then scroll
      setTimeout(() => {
        if (continuousContainerRef.current) {
          console.log('🔍 [Looking for page elements]');
          
          // Try to find the specific page element by its data attribute
          const pageElements = continuousContainerRef.current.querySelectorAll('[data-page-number]');
          console.log('📄 [Found page elements]', pageElements.length);
          
          const targetPageElement = Array.from(pageElements).find(el => 
            el.getAttribute('data-page-number') === pageNumber.toString()
          );
          
          console.log('🎯 [Target page element]', targetPageElement);
          
          if (targetPageElement) {
            // Scroll to the specific page element
            console.log('📜 [Scrolling to target element]');
            targetPageElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          } else {
            // Fallback: calculate approximate position
            console.log('📜 [Using fallback scroll calculation]');
            const pageHeight = 1100; // Approximate height of a page including margins
            const scrollPosition = (pageNumber - 1) * pageHeight;
            
            continuousContainerRef.current.scrollTo({
              top: scrollPosition,
              behavior: 'smooth'
            });
          }
        }
      }, 100); // Small delay to ensure pages are rendered
    }
  }, [pageNumber, viewMode, numPages]);

  const goToPreviousPage = () => {
    onPageChange(Math.max(1, pageNumber - 1));
  };

  const goToNextPage = () => {
    onPageChange(Math.min(numPages || 1, pageNumber + 1));
  };

  // Detect text selection and bounding box
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range && range.toString().trim() && containerRef.current && containerRef.current.contains(range.commonAncestorContainer)) {
          const rect = range.getBoundingClientRect();
          setSelectionRect(rect);
        } else {
          setSelectionRect(null);
        }
      } else {
        setSelectionRect(null);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  useEffect(() => {
    if (selectionRect) {
      setAskAnchor({ top: selectionRect.bottom + window.scrollY + 4, left: selectionRect.right + window.scrollX + 8 });
    } else {
      setShowAskInput(false);
      setAskInputValue('');
      setAskAnchor(null);
    }
  }, [selectionRect]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {viewMode === 'single' && (
        <div className="flex flex-col h-full">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between p-4 bg-surface border-b border-border">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={pageNumber <= 1}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pageNumber} of {numPages || '...'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={pageNumber >= (numPages || 1)}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={numPages || 1}
                value={pageNumber}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= (numPages || 1)) {
                    onPageChange(value);
                  }
                }}
                className="w-16 px-2 py-1 text-sm border border-border rounded"
              />
              <span className="text-sm text-muted-foreground">/ {numPages || '...'}</span>
            </div>
          </div>
          
          {/* PDF Content */}
          <div className="flex-1 overflow-auto bg-muted p-4">
            <div className="flex justify-center">
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="flex items-center justify-center h-64">Loading PDF...</div>}
                error={<div className="flex items-center justify-center h-64 text-red-500">Failed to load PDF</div>}
                className="bg-white rounded-lg shadow-lg"
              >
                {numPages && (
                  <Page
                    pageNumber={pageNumber}
                    width={Math.min(800, containerWidth)}
                    renderTextLayer
                    renderAnnotationLayer={false}
                  />
                )}
              </Document>
            </div>
          </div>
        </div>
      )}
      
      {viewMode === 'continuous' && (
        <div ref={continuousContainerRef} className="w-full h-full overflow-auto bg-muted rounded-lg">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="flex items-center justify-center h-full">Loading PDF...</div>}
            error={<div className="flex items-center justify-center h-full text-red-500">Failed to load PDF</div>}
            className="w-full h-full"
          >
            {numPages && (
              Array.from(new Array(numPages), (el, index) => (
                <div key={`page_${index + 1}`} data-page-number={index + 1}>
                  <Page
                    pageNumber={index + 1}
                    width={Math.min(800, containerWidth)}
                    renderTextLayer
                    renderAnnotationLayer={false}
                  />
                </div>
              ))
            )}
          </Document>
        </div>
      )}
      {/* Floating Toolbar */}
      {selectionRect && (
        <div
          style={{
            position: 'fixed',
            top: selectionRect.bottom + window.scrollY + 4,
            left: selectionRect.right + window.scrollX + 8,
            zIndex: 1000,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            padding: '4px 8px',
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <button
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 14,
            }}
            onClick={() => onAskSelected(window.getSelection()?.toString() || '')}
          >
            Ask
          </button>
          <button
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 14,
            }}
            onClick={() => onExplainSelected(window.getSelection()?.toString() || '')}
          >
            Explain
          </button>
        </div>
      )}
    </div>
  );
};

const FilePreviewPage = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  
  const [file, setFile] = useState<FileItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [textMessages, setTextMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hi! I'm your AI assistant. I can help you understand this content, answer questions about it, and provide insights. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [voiceMessages, setVoiceMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hi! I'm your AI assistant. I can help you understand this content through voice conversation. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('single');
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [pendingContext, setPendingContext] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [activeMode, setActiveMode] = useState<'chat' | 'call' | 'generate'>('chat');
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
  const [selectedChatMode, setSelectedChatMode] = useState<ChatMode>("regular");
  const [contextOnly, setContextOnly] = useState<boolean>(false);
  

  const { isCollapsed, toggleCollapse } = useSidebar();

  // Load the most recent session when component mounts
  useEffect(() => {
    if (file && activeMode === 'chat') {
      loadMostRecentSession();
    }
  }, [file, activeMode]);

  
  // Generate content state
  const [selectedGenerationType, setSelectedGenerationType] = useState<string>('exam');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<FileItem[]>([]);
  const [isLoadingGeneratedFiles, setIsLoadingGeneratedFiles] = useState(false);
  
  // Quiz configuration state
  const [showQuizConfigDialog, setShowQuizConfigDialog] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizConfig>({
    numQuestions: 10,
    questionType: 'both'
  });
  
  // Exam configuration state
  const [showExamConfigDialog, setShowExamConfigDialog] = useState(false);
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    numMultipleChoice: 5,
    numShortAnswer: 3,
    numEssay: 2,
    totalPoints: 100
  });
  
  const generationTypes = [
    {
      value: "exam",
      label: "Exam Questions",
      description: "Create comprehensive exam questions",
      icon: FileText,
    },
    {
      value: "quiz",
      label: "Quiz",
      description: "Quick quiz questions for review",
      icon: CheckCircle,
    },
    {
      value: "flashcards",
      label: "Flashcards",
      description: "Create study flashcards",
      icon: BookOpen,
    },
    {
      value: "cheat_sheet",
      label: "Cheat Sheet",
      description: "Generate a concise reference guide",
      icon: Lightbulb,
    },
    {
      value: "study_guide",
      label: "Study Guide",
      description: "Comprehensive study material",
      icon: BookOpen,
    },
    {
      value: "notes",
      label: "Notes",
      description: "Organized study notes",
      icon: FileText,
    },
  ];
  

  




  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Voice recording state

  const recordingStartTimeRef = useRef<number>(0);
  
  // Text-to-speech state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isModeSwitching, setIsModeSwitching] = useState(false);

  // Separate session management for chat and call
  const [textSessionId, setTextSessionId] = useState<string | null>(null);
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  
  // Helper functions to get current messages and session ID based on active mode
  const getCurrentMessages = () => {
    return activeMode === 'call' ? voiceMessages : textMessages;
  };

  const getCurrentSetMessages = () => {
    return activeMode === 'call' ? setVoiceMessages : setTextMessages;
  };

  const getCurrentSessionId = () => {
    return activeMode === 'call' ? voiceSessionId : textSessionId;
  };

  const getCurrentSetSessionId = () => {
    return activeMode === 'call' ? setVoiceSessionId : setTextSessionId;
  };

  // Stop audio when leaving voice chat mode
  const stopCurrentAudio = () => {
    if (currentAudio) {
      console.log('🔇 [TTS] Stopping audio - leaving voice chat mode');
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Don't scroll if we're switching modes
    if (isModeSwitching) {
      return;
    }

    const scrollToBottom = () => {
      if (chatScrollRef.current) {
        const viewport = chatScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };

    // Scroll immediately
    scrollToBottom();
    
    // Also scroll after a small delay to ensure DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [getCurrentMessages(), isModeSwitching]);

  // Handle layout recalculation when file loads or content changes
  useEffect(() => {
    if (file && activeMode === 'chat') {
      // Force a layout recalculation after a short delay
      const timer = setTimeout(() => {
        // Trigger a resize event to force layout recalculation
        window.dispatchEvent(new Event('resize'));
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [file, activeMode]);

  // Stop audio when leaving voice chat mode
  useEffect(() => {
    if (activeMode !== 'call') {
      stopCurrentAudio();
    }
  }, [activeMode]);

  // Stop audio when leaving the page
  useEffect(() => {
    return () => {
      // Cleanup function that runs when component unmounts
      if (currentAudio) {
        console.log('🔇 [TTS] Stopping audio - leaving page');
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
    };
  }, [currentAudio]);

  // Helper function to handle mode switching
  const handleModeSwitch = (newMode: 'chat' | 'call' | 'generate') => {
    // If switching away from call mode, ensure proper cleanup
    if (activeMode === 'call' && newMode !== 'call') {
      console.log('📞 [MODE-SWITCH] Switching away from call mode - ensuring cleanup');
      // The FileVoiceCallPanel will handle its own cleanup when unmounted
    }
    
    // Stop any currently playing audio immediately
    if (currentAudio) {
      console.log('🔇 [TTS] Stopping audio - switching modes');
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    setIsModeSwitching(true);
    setActiveMode(newMode);
    // Reset the flag after a longer delay to ensure all state updates are complete
    setTimeout(() => {
      setIsModeSwitching(false);
    }, 200);
  };

  // Fetch workspaces from backend on mount
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.LIST), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setWorkspaces(data.data.map((ws: any) => ({
            id: ws.id.toString(),
            name: ws.name,
            description: ws.description || null,
            isActive: false,
          })));
        } else {
          toast({
            title: "Error fetching workspaces",
            description: data.message || "Failed to load workspaces",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error fetching workspaces",
          description: "Network error occurred",
          variant: "destructive",
        });
      }
    };
    fetchWorkspaces();
  }, [toast]);

  useEffect(() => {
    if (fileId) {
      fetchFileDetails();
    }
  }, [fileId]);

  // Handle sessionId from URL parameters
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('sessionId');
    if (sessionIdFromUrl && !getCurrentSessionId()) {
      loadSession(sessionIdFromUrl);
    }
  }, [searchParams, getCurrentSessionId()]);

  // Load chat sessions when file is loaded or mode changes
  useEffect(() => {
    if (file && fileId) {
      fetchChatSessions();
    }
  }, [file, fileId, activeMode]);

  // Load generated files when file is loaded
  useEffect(() => {
    if (file && fileId) {
      fetchGeneratedFiles();
    }
  }, [file, fileId]);

  // Create a new chat session when starting fresh
  useEffect(() => {
    if (file && fileId && !getCurrentSessionId() && getCurrentMessages().length === 1) {
      createNewSession();
    }
  }, [file, fileId, getCurrentSessionId(), getCurrentMessages().length]);

  const fetchChatSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (file?.workspaceId) params.append('workspaceId', file.workspaceId.toString());
      if (fileId) params.append('fileId', fileId);
      // Add mode parameter to separate chat and call sessions
      params.append('mode', activeMode);

      const response = await fetch(buildApiUrl(`/chat-sessions/sessions?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setChatSessions(data.data);
        return data.data; // Return the sessions for immediate use
      } else {
        toast({
          title: "Error loading chat history",
          description: data.message || "Failed to load chat sessions",
          variant: "destructive",
        });
        return [];
      }
    } catch (error) {
      toast({
        title: "Error loading chat history",
        description: "Network error occurred",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadMostRecentSession = async () => {
    try {
      // Fetch sessions and get the result
      const sessions = await fetchChatSessions();
      
      // If there are existing sessions, load the most recent one
      if (sessions.length > 0) {
        const mostRecentSession = sessions[0]; // Sessions are ordered by most recent first
        console.log(`💬 [FilePreviewPage] Loading most recent session: ${mostRecentSession.id}`);
        await loadSession(mostRecentSession.id);
      } else {
        // No existing sessions, create a new one
        console.log(`💬 [FilePreviewPage] No existing sessions, creating new session`);
        createNewSession();
      }
    } catch (error) {
      console.error('❌ [FilePreviewPage] Error loading most recent session:', error);
      createNewSession();
    }
  };

  const createNewSession = async () => {
    try {
      // Create a new session immediately
      const token = localStorage.getItem('authToken');
      const createResponse = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${activeMode === 'call' ? 'Voice Call' : 'Chat'} about ${file?.originalName || 'document'}`,
          workspaceId: file?.workspaceId,
          fileId: fileId,
          mode: activeMode
        }),
      });

      const createData = await createResponse.json();
      if (createResponse.ok && createData.success) {
        const sessionId = createData.data.id;
        console.log(`✅ [FilePreviewPage] Created new session: ${sessionId}`);
        getCurrentSetSessionId()(sessionId);
        
        // Add welcome message
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          content: activeMode === 'call' 
            ? "Hi! I'm your AI assistant. I can help you understand this content through voice conversation. What would you like to know?"
            : "Hi! I'm your AI assistant. I can help you understand this content, answer questions about it, and provide insights. What would you like to know?",
          isUser: false,
          timestamp: new Date(),
        };
        
        getCurrentSetMessages()([welcomeMessage]);
        
        // Save the welcome message to the session
        await updateSession(sessionId, [welcomeMessage]);
        
        // Refresh the sessions list
        await fetchChatSessions();
      } else {
        console.error('❌ [FilePreviewPage] Failed to create new session:', createData);
        toast({
          title: "Error",
          description: "Failed to create new chat session",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [FilePreviewPage] Error creating new session:', error);
      toast({
        title: "Error",
        description: "Failed to create new chat session",
        variant: "destructive",
      });
    }
  };

  const createSessionAndSaveMessages = async (messages: Message[]) => {
    try {
      console.log(`🆕 [FilePreviewPage] Creating new session with ${messages.length} messages`);
      const token = localStorage.getItem('authToken');
      
      // Create the session
      const createResponse = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${activeMode === 'call' ? 'Speech' : 'Chat'} about ${file?.originalName || 'document'}`,
          workspaceId: file?.workspaceId,
          fileId: fileId,
          mode: activeMode
        }),
      });

      const createData = await createResponse.json();
      if (createResponse.ok && createData.success) {
        const sessionId = createData.data.id;
        console.log(`✅ [FilePreviewPage] Created new session: ${sessionId}`);
        getCurrentSetSessionId()(sessionId);
        
        // Save all messages to the new session
        await updateSession(sessionId, messages);
        
        // Refresh sessions list
        fetchChatSessions();
      } else {
        console.error('❌ [FilePreviewPage] Failed to create session:', createData.message);
        toast({
          title: "Error creating session",
          description: createData.message || "Failed to create new session",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [FilePreviewPage] Error creating session:', error);
      toast({
        title: "Error creating session",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSION(sessionId)), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const session = data.data;
        getCurrentSetSessionId()(session.id);
        
        // Convert backend messages to frontend format
        const sessionMessages: Message[] = session.messages.map((msg: any) => ({
          id: msg.id.toString(),
          content: msg.content,
          isUser: msg.isUser,
          timestamp: new Date(msg.createdAt),
          sourceCitations: msg.sourceCitations || msg.source_citations || []
        }));
        
        getCurrentSetMessages()(sessionMessages);
        setShowHistoryDialog(false);
      } else {
        toast({
          title: "Error loading chat session",
          description: data.message || "Failed to load session",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error loading chat session",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };



  const deleteSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(`/chat-sessions/${sessionId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setChatSessions(prev => prev.filter(session => session.id !== sessionId));
        
        // If we're deleting the current session, clear the messages and create a new session
        if (getCurrentSessionId() === sessionId) {
          getCurrentSetSessionId()(null);
          getCurrentSetMessages()([]);
          createNewSession();
        }
        toast({
          title: "Session Deleted",
          description: "Chat session has been deleted",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete session",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive",
      });
    }
  };



  const updateSession = async (sessionId: string, updatedMessages: Message[]) => {
    try {
      console.log(`💾 [FilePreviewPage] Updating session ${sessionId} with ${updatedMessages.length} messages`);
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.MESSAGES(sessionId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(msg => ({
            content: msg.content,
            isUser: msg.isUser,
            timestamp: msg.timestamp.toISOString(),
            sourceCitations: msg.sourceCitations || null
          }))
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        console.log(`✅ [FilePreviewPage] Session ${sessionId} updated successfully`);
      } else {
        console.error(`❌ [FilePreviewPage] Failed to update session ${sessionId}:`, data.message);
      }
    } catch (error) {
      console.error(`❌ [FilePreviewPage] Error updating session ${sessionId}:`, error);
    }
  };

  // Update workspace active state when activeWorkspaceId changes
  useEffect(() => {
    if (workspaces.length > 0) {
      setWorkspaces(prev => prev.map(ws => ({ 
        ...ws, 
        isActive: ws.id === activeWorkspaceId 
      })));
    }
  }, [activeWorkspaceId, workspaces.length]);

  const handleWorkspaceSelect = (id: string) => {
    setActiveWorkspaceId(id);
    setWorkspaces(prev => prev.map(ws => ({ ...ws, isActive: ws.id === id })));
    // Navigate to the workspace page
    navigate('/', { state: { workspaceId: id } });
  };

  const handleCreateWorkspace = async (name: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.LIST), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        const newWorkspace = {
          id: data.data.id.toString(),
          name: data.data.name,
          isActive: false,
        };
        setWorkspaces(prev => [...prev, newWorkspace]);
        // Set the new workspace as active
        setActiveWorkspaceId(newWorkspace.id);
        setWorkspaces(prev => prev.map(ws => ({ 
          ...ws, 
          isActive: ws.id === newWorkspace.id 
        })));
        toast({
          title: "Workspace created",
          description: `${name} has been created successfully`,
        });
      } else {
        toast({
          title: "Error creating workspace",
          description: data.message || "Failed to create workspace",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error creating workspace",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleHomeSelect = () => {
    navigate('/');
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    // Implementation for workspace deletion
    console.log('Delete workspace:', workspaceId);
  };

  const handleRenameWorkspace = async (workspaceId: string, newName: string) => {
    // Implementation for workspace renaming
    console.log('Rename workspace:', workspaceId, 'to', newName);
  };

  const fetchFileDetails = async () => {
    if (!fileId) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(`/files/${fileId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setFile(data.data);
        // Set the active workspace based on the file's workspace
        setActiveWorkspaceId(data.data.workspaceId.toString());
        setWorkspaces(prev => prev.map(ws => ({ 
          ...ws, 
          isActive: ws.id === data.data.workspaceId.toString() 
        })));
      } else {
        toast({
          title: "Error fetching file",
          description: data.message || "Failed to load file details",
          variant: "destructive",
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: "Error fetching file",
        description: "Network error occurred",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageContent?: string) => {
    const contentToSend = messageContent || inputValue;
    if (!contentToSend.trim() || isSending || !fileId) return;
    
    let finalMessageContent = contentToSend;
    if (pendingContext) {
      finalMessageContent = `Question: ${contentToSend}\nContext: ${pendingContext}`;
      setPendingContext(null);
    }
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content: finalMessageContent,
      isUser: true,
      timestamp: new Date(),
    };
    
    getCurrentSetMessages()(prev => [...prev, newMessage]);
    setInputValue("");
    setIsSending(true);

    try {
      const token = localStorage.getItem('authToken');
      
      // Convert frontend message format to OpenAI format for RAG API
      const openaiMessages = [...getCurrentMessages(), newMessage].map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      }));
      
      // Use RAG API instead of regular chat API
      const response = await fetch(buildApiUrl(API_ENDPOINTS.RAG.MESSAGE), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: openaiMessages,
          workspaceId: file?.workspaceId || 1,
          fileId: parseInt(fileId),
          modelName: selectedModel,
          chatMode: selectedChatMode,
          contextOnly: contextOnly
        }),
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('📨 [handleSendMessage] Received response:', data);
        console.log('📄 [handleSendMessage] Source citations received:', data.context?.sourceCitations);
        
        // Replace [source x] citations with timestamps for YouTube videos
        let filteredContent = data.message;
        if (file?.metadata?.type === 'youtube' && data.context?.sourceCitations) {
          // Replace [SOURCE X] patterns with timestamps from metadata
          filteredContent = filteredContent.replace(/\[SOURCE\s+(\d+)(?:,\s*(\d+))*\]/gi, (match, ...args) => {
            const sourceNumbers = args.filter(Boolean).map(Number);
            const timestamps = sourceNumbers.map(num => {
              // Find the corresponding citation (num - 1 because AI uses 1-based indexing)
              const citation = data.context.sourceCitations[num - 1];
              if (citation?.metadata?.timestamp) {
                const timestamp = citation.metadata.timestamp;
                const minutes = Math.floor(timestamp / 60);
                const seconds = Math.floor(timestamp % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
              }
              return '';
            }).filter(Boolean);
            
            return timestamps.length > 0 ? timestamps.join(', ') : '';
          });
          
          // Also handle lowercase and title case variations
          filteredContent = filteredContent.replace(/\[source\s+(\d+)(?:,\s*(\d+))*\]/gi, (match, ...args) => {
            const sourceNumbers = args.filter(Boolean).map(Number);
            const timestamps = sourceNumbers.map(num => {
              const citation = data.context.sourceCitations[num - 1];
              if (citation?.metadata?.timestamp) {
                const timestamp = citation.metadata.timestamp;
                const minutes = Math.floor(timestamp / 60);
                const seconds = Math.floor(timestamp % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
              }
              return '';
            }).filter(Boolean);
            
            return timestamps.length > 0 ? timestamps.join(', ') : '';
          });
          
          filteredContent = filteredContent.replace(/\[Source\s+(\d+)(?:,\s*(\d+))*\]/gi, (match, ...args) => {
            const sourceNumbers = args.filter(Boolean).map(Number);
            const timestamps = sourceNumbers.map(num => {
              const citation = data.context.sourceCitations[num - 1];
              if (citation?.metadata?.timestamp) {
                const timestamp = citation.metadata.timestamp;
                const minutes = Math.floor(timestamp / 60);
                const seconds = Math.floor(timestamp % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
              }
              return '';
            }).filter(Boolean);
            
            return timestamps.length > 0 ? timestamps.join(', ') : '';
          });
          
          // Clean up any extra spaces that might be left
          filteredContent = filteredContent.replace(/\s+/g, ' ').trim();
        }

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: filteredContent,
          isUser: false,
          timestamp: new Date(),
          sourceCitations: data.context?.sourceCitations || []
        };
        
        console.log('💬 [handleSendMessage] Created AI response with citations:', aiResponse.sourceCitations);
        
        // Update messages state and save to session
        getCurrentSetMessages()(prev => {
          const updatedMessages = [...prev, aiResponse];
          
          // Save to current session (should always exist now)
          if (getCurrentSessionId()) {
            console.log(`💾 [FilePreviewPage] Updating session ${getCurrentSessionId()} with ${updatedMessages.length} messages`);
            updateSession(getCurrentSessionId()!, updatedMessages).catch(error => {
              console.error('❌ [FilePreviewPage] Error saving session:', error);
            });
          } else {
            console.error('❌ [FilePreviewPage] No current session ID found');
          }
          
          return updatedMessages;
        });

        // Remove the TTS call here since FileVoiceCallPanel handles its own TTS
        // speakText(filteredContent); // REMOVED - causes duplicate audio
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message || "Sorry, I encountered an error. Please try again.",
          isUser: false,
          timestamp: new Date(),
        };
        getCurrentSetMessages()(prev => [...prev, errorMessage]);
        toast({
          title: "Chat Error",
          description: data.message || "Failed to get AI response",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      getCurrentSetMessages()(prev => [...prev, errorMessage]);
      toast({
        title: "Connection Error",
        description: "Failed to connect to AI service",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const speakText = async (text: string) => {
    if (!ttsEnabled || isModeSwitching) {
      console.log('🔇 [TTS] Text-to-speech is disabled or mode switching');
      return;
    }
    
    // Additional safety check - don't play if we're not in call mode
    if (activeMode !== 'call') {
      console.log('🔇 [TTS] Not in call mode, skipping TTS');
      return;
    }
    

    
    try {
      console.log('🔊 [TTS] Converting text to speech:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      // Stop any currently playing audio
      if (currentAudio) {
        console.log('🔇 [TTS] Stopping previous audio');
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TTS.TTS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'alloy' // You can make this configurable
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Store the current audio element
        setCurrentAudio(audio);
        
        console.log('🔊 [TTS] Playing audio response');
        await audio.play();
        
        // Clean up the URL after playing
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
        };
      } else {
        console.error('❌ [TTS] Failed to get audio:', response.status);
      }
    } catch (error) {
      console.error('❌ [TTS] Error playing audio:', error);
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DOWNLOAD(file.id)), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.downloadUrl) {
          // Open the file in a new tab
          window.open(data.data.downloadUrl, '_blank');
          
          toast({
            title: "File opened",
            description: "Your file has been opened in a new tab",
          });
        } else {
          toast({
            title: "Download failed",
            description: "Unable to get download URL",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Download failed",
          description: "Unable to download the file",
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

  const handleExplainSelected = async (context: string) => {
    if (!context.trim() || !fileId) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: `Explain this: ${context}`,
      isUser: true,
      timestamp: new Date(),
    };
    getCurrentSetMessages()(prev => [...prev, newMessage]);
    setIsSending(true);

    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.RAG.MESSAGE), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...getCurrentMessages(), newMessage],
          workspaceId: file?.workspaceId || 1,
          fileId: parseInt(fileId)
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          sourceCitations: data.context?.sourceCitations || []
        };
        getCurrentSetMessages()(prev => [...prev, aiResponse]);
        
        // Update session with new messages to save them
        if (getCurrentSessionId()) {
          await updateSession(getCurrentSessionId()!, [...getCurrentMessages(), newMessage, aiResponse]);
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message || "Sorry, I encountered an error. Please try again.",
          isUser: false,
          timestamp: new Date(),
        };
        getCurrentSetMessages()(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      getCurrentSetMessages()(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleAskSelected = (context: string) => {
    if (!context.trim()) return;
    setPendingContext(context);
    setInputValue('');
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);
  };





  // Generate content functions
  const fetchGeneratedFiles = async () => {
    if (!fileId || !file?.workspaceId) return;
    
    try {
      setIsLoadingGeneratedFiles(true);
      const token = localStorage.getItem('authToken');
      // Fetch all files from the workspace without category filter
      const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.FILES(file.workspaceId.toString())), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        console.log('🔍 [GENERATE] All files from workspace:', data.data);
        console.log('🔍 [GENERATE] Looking for files with sourceFileId:', fileId);
        
        // Filter files that were generated from this specific file
        const filesFromThisFile = data.data.filter((f: FileItem) => {
          const isGenerated = f.metadata?.type === 'generated';
          const sourceFileId = f.metadata?.sourceFileId;
          const currentFileId = parseInt(fileId);
          
          // Check if sourceFileId matches either as string or number
          const matchesSource = sourceFileId === currentFileId || 
                               (typeof sourceFileId === 'string' && sourceFileId === fileId);
          
          console.log('🔍 [GENERATE] File:', f.originalName, 'isGenerated:', isGenerated, 'sourceFileId:', sourceFileId, 'currentFileId:', currentFileId, 'matchesSource:', matchesSource);
          
          return isGenerated && matchesSource;
        });
        
        console.log('🔍 [GENERATE] Found files from this file:', filesFromThisFile);
        setGeneratedFiles(filesFromThisFile);
      } else {
        toast({
          title: "Error fetching generated files",
          description: data.message || "Failed to load generated files",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error fetching generated files",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGeneratedFiles(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!fileId || !selectedGenerationType) return;
    
    // For quizzes and exams, show configuration dialog after clicking generate
    if (selectedGenerationType === 'quiz') {
      setShowQuizConfigDialog(true);
      return;
    }
    
    if (selectedGenerationType === 'exam') {
      setShowExamConfigDialog(true);
      return;
    }
    
    await performGeneration();
  };

  const performGeneration = async (config?: QuizConfig | ExamConfig) => {
    if (!fileId || !selectedGenerationType) return;
    
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('authToken');
      
      // Prepare request body with quiz configuration if applicable
      const requestBody: any = {
        type: selectedGenerationType
      };
      
      // Add quiz configuration if this is a quiz generation
      if (selectedGenerationType === 'quiz') {
        // Use the passed config if available, otherwise fall back to state
        const quizConfigToUse = config as QuizConfig || quizConfig;
        requestBody.numQuestions = quizConfigToUse.numQuestions;
        requestBody.questionType = quizConfigToUse.questionType;
      }
      
      // Add exam configuration if this is an exam generation
      if (selectedGenerationType === 'exam') {
        const examConfigToUse = config as ExamConfig || examConfig;
        requestBody.numMultipleChoice = examConfigToUse.numMultipleChoice;
        requestBody.numShortAnswer = examConfigToUse.numShortAnswer;
        requestBody.numEssay = examConfigToUse.numEssay;
        requestBody.totalPoints = examConfigToUse.totalPoints;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.GENERATE.FILE(fileId)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        console.log('✅ [GENERATE] Content generated successfully:', data.data);
        toast({
          title: "Content Generated!",
          description: "Your content has been created successfully",
        });
        
        // Refresh generated files list
        fetchGeneratedFiles();
      } else {
        toast({
          title: "Generation Failed",
          description: data.message || "Failed to generate content",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle quiz configuration confirmation
  const handleQuizConfigConfirm = async (config: QuizConfig) => {
    setQuizConfig(config);
    setShowQuizConfigDialog(false);
    // Pass the config directly to avoid state update timing issues
    await performGeneration(config);
  };

  // Handle exam configuration confirmation
  const handleExamConfigConfirm = async (config: ExamConfig) => {
    setExamConfig(config);
    setShowExamConfigDialog(false);
    // Pass the config directly to avoid state update timing issues
    await performGeneration(config);
  };

  const handleOpenGeneratedFile = async (generatedFile: FileItem) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DOWNLOAD(generatedFile.id)), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.downloadUrl) {
          window.open(data.data.downloadUrl, '_blank');
        } else {
          toast({
            title: "Error opening file",
            description: "Unable to open the generated file",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error opening file",
          description: "Unable to open the generated file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error opening file",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGeneratedFile = async (generatedFile: FileItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the file open action
    
    if (!confirm(`Are you sure you want to delete "${generatedFile.originalName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DELETE(generatedFile.id)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: "File deleted",
          description: "Generated file has been deleted successfully",
        });
        
        // Refresh the generated files list
        fetchGeneratedFiles();
      } else {
        const data = await response.json();
        toast({
          title: "Error deleting file",
          description: data.message || "Failed to delete the file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting file",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };



  // Add state for category filter
  const [selectedGeneratedCategory, setSelectedGeneratedCategory] = useState<string>('All');

  // Get unique categories from generated files
  const getGeneratedCategories = () => {
    const categories = new Set<string>();
    generatedFiles.forEach(file => {
      const category = file.metadata?.generationType || 'Unknown';
      categories.add(category);
    });
    return ['All', ...Array.from(categories).sort()];
  };

  // Filter generated files based on selected category
  const filteredGeneratedFiles = selectedGeneratedCategory === 'All' 
    ? generatedFiles 
    : generatedFiles.filter(file => file.metadata?.generationType === selectedGeneratedCategory);

  // Get display name for generation type
  const getGenerationTypeDisplayName = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'practice_questions': 'Practice Questions',
      'exam': 'Exam',
      'quiz': 'Quiz',
      'flashcards': 'Flashcards',
      'cheat_sheet': 'Cheat Sheet',
      'study_guide': 'Study Guide',
      'notes': 'Notes'
    };
    return typeMap[type] || type;
  };

  // Handle source citation clicks from chat
  const handleSourceCitationClick = (citation: any) => {
    console.log('🎯 [Source Citation Clicked]', citation);
    console.log('📄 [Current View Mode]', viewMode);
    console.log('📄 [Current Page Number]', pageNumber);
    
    if (citation.fileId === parseInt(fileId || '0')) {
      // Check if this is a YouTube video and we have timestamp information
      if (file?.metadata?.type === 'youtube' && citation.metadata?.timestamp) {
        const timestamp = citation.metadata.timestamp;
        console.log('🎬 [YouTube Timestamp]', timestamp);
        
        // Update the YouTube iframe to the specific timestamp
        const iframe = document.querySelector('iframe[src*="youtube.com/embed"]') as HTMLIFrameElement;
        if (iframe && file.metadata.videoId) {
          const newUrl = `https://www.youtube.com/embed/${file.metadata.videoId}?start=${Math.floor(timestamp)}`;
          iframe.src = newUrl;
          
          toast({
            title: "Video timestamp found",
            description: `Navigated to ${citation.fileName} at ${Math.floor(timestamp / 60)}:${(timestamp % 60).toString().padStart(2, '0')}`,
          });
        }
      } else if (citation.pageNumber) {
        // Handle PDF page navigation
        console.log('🔄 [Setting Page Number]', citation.pageNumber);
        setPageNumber(citation.pageNumber);
        
        toast({
          title: "Source found",
          description: `Navigated to ${citation.fileName}, page ${citation.pageNumber}`,
        });
      }
      
      // Store citation info for highlighting
      setSelectedCitation(citation);
    } else {
      // Navigate to different file
              navigate(`/file/${citation.fileId}?sessionId=${getCurrentSessionId()}&citation=${encodeURIComponent(JSON.stringify(citation))}`);
    }
  };

  // Handle citation from URL parameters
  useEffect(() => {
    const citationParam = searchParams.get('citation');
    const pageParam = searchParams.get('page');
    const timestampParam = searchParams.get('timestamp');
    
    if (citationParam) {
      try {
        const citation = JSON.parse(decodeURIComponent(citationParam));
        setSelectedCitation(citation);
        if (citation.pageNumber) {
          setPageNumber(citation.pageNumber);
        }
      } catch (error) {
        console.error('Failed to parse citation parameter:', error);
      }
    }
    
    // Handle direct page parameter
    if (pageParam) {
      const pageNum = parseInt(pageParam);
      if (pageNum > 0) {
        setPageNumber(pageNum);
      }
    }
    
    // Handle timestamp parameter for YouTube videos
    if (timestampParam && file?.metadata?.type === 'youtube') {
      const timestamp = parseFloat(timestampParam);
      if (!isNaN(timestamp) && file.metadata.videoId) {
        // Update the YouTube iframe to the specific timestamp
        const iframe = document.querySelector('iframe[src*="youtube.com/embed"]') as HTMLIFrameElement;
        if (iframe) {
          const newUrl = `https://www.youtube.com/embed/${file.metadata.videoId}?start=${Math.floor(timestamp)}`;
          iframe.src = newUrl;
          
          const minutes = Math.floor(timestamp / 60);
          const seconds = Math.floor(timestamp % 60);
          const timestampText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          
          toast({
            title: "Video timestamp found",
            description: `Navigated to ${file.metadata.title} at ${timestampText}`,
          });
        }
      }
    }
  }, [searchParams, file]);



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading file...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">File not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        workspaces={workspaces}
        onWorkspaceSelect={handleWorkspaceSelect}
        onDeleteWorkspace={handleDeleteWorkspace}
        onRenameWorkspace={handleRenameWorkspace}
        onHomeSelect={handleHomeSelect}
        isHomeActive={false}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="border-b border-border bg-surface/50 backdrop-blur-sm flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/workspace/${file.workspaceId}`)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {file.metadata?.type === 'youtube' ? (
                    <Youtube className="w-5 h-5 text-red-500" />
                  ) : file.metadata?.type === 'website' ? (
                    <Globe className="w-5 h-5 text-blue-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-primary" />
                  )}
                  <div>
                    <h1 className="text-lg font-medium text-foreground">{file.originalName}</h1>
                    <p className="text-sm text-muted-foreground">
                      {file.metadata?.type === 'youtube' ? 'YouTube Video' : 
                       file.metadata?.type === 'website' ? 'Website' : 
                       `${(file.fileSize / 1024 / 1024).toFixed(2)} MB`} • {new Date(file.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Only show view mode toggle for PDF files */}
                {!file.metadata || (file.metadata.type !== 'youtube' && file.metadata.type !== 'website') ? (
                  <>
                    <span className="text-xs text-muted-foreground">View:</span>
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                      <Button
                        variant={viewMode === 'continuous' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('continuous')}
                        className="h-8 px-3"
                        title="Continuous scroll view"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'single' ? 'default' : 'ghost'} 
                        size="sm"
                        onClick={() => setViewMode('single')}
                        className="h-8 px-3"
                        title="Single page view"
                      >
                        <Grid className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : null}

                {/* Download Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          {/* Content Preview */}
          <ResizablePanel defaultSize={70} minSize={30}>
            <div className="flex flex-col min-h-0 h-full">
              <div className="flex-1 p-6 overflow-auto">
                <div className={`bg-card border border-border rounded-lg min-h-full ${viewMode === 'single' ? 'single-page-view' : ''}`} style={{ position: 'relative' }}>
                  {/* Render appropriate viewer based on file type */}
                  {file.metadata && (file.metadata.type === 'youtube' || file.metadata.type === 'website') ? (
                    <URLContentViewer file={file} />
                  ) : (
                    <PDFViewer
                      file={file}
                      viewMode={viewMode}
                      onExplainSelected={handleExplainSelected}
                      onAskSelected={handleAskSelected}
                      pageNumber={pageNumber}
                      onPageChange={setPageNumber}
                    />
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          {/* Resizable Handle */}
          <ResizableHandle withHandle />

          {/* Chat Interface */}
          <ResizablePanel defaultSize={45} minSize={30} maxSize={65}>
            <div className="bg-background border-l border-border flex flex-col flex-shrink-0 h-full min-w-0 overflow-hidden">
              {/* Chat Header */}
              <div className="p-3 border-b border-border flex-shrink-0">
                {/* Scrollable Mode Toggle */}
                <div className="mb-2">
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
                    <Button
                      variant={activeMode === 'chat' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleModeSwitch('chat')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0 text-xs"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeMode === 'chat' ? 'bg-green-500' : 'bg-transparent'}`} />
                      <MessageCircle className="w-3 h-3" />
                      Chat
                    </Button>

                    <Button
                      variant={activeMode === 'call' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleModeSwitch('call')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0 text-xs"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeMode === 'call' ? 'bg-green-500' : 'bg-transparent'}`} />
                      <Phone className="w-3 h-3" />
                      Call
                    </Button>

                    <Button
                      variant={activeMode === 'generate' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleModeSwitch('generate')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0 text-xs"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeMode === 'generate' ? 'bg-green-500' : 'bg-transparent'}`} />
                      <Brain className="w-3 h-3" />
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      {activeMode === 'chat' ? (
                        <MessageCircle className="w-3.5 h-3.5 text-primary-foreground" />
                      ) : activeMode === 'call' ? (
                        <Phone className="w-3.5 h-3.5 text-primary-foreground" />
                      ) : (
                        <Brain className="w-3.5 h-3.5 text-primary-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-sm truncate">
                        {activeMode === 'chat' ? 'Ask Sparqy' : 
                         activeMode === 'call' ? 'Speech' : 
                         'Generate Content'}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {activeMode === 'chat' ? 'Ask questions about this document' :
                         activeMode === 'call' ? 'Voice chat with AI assistant' :
                         'Generate content from this document'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* New Chat button - only show in chat mode */}
                    {activeMode === 'chat' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          getCurrentSetMessages()([]);
                          getCurrentSetSessionId()(null);
                          createNewSession();
                        }}
                        className="h-7 px-2 text-xs"
                        title="Start a new chat"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        New Chat
                      </Button>
                    )}
                    
                    {/* History button - only show in chat and call modes */}
                    {(activeMode === 'chat' || activeMode === 'call') && (
                      <div className="relative group">
                        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Chat History</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {isLoadingSessions ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                              </div>
                            ) : chatSessions.length === 0 ? (
                              <p className="text-center text-muted-foreground py-8">No saved chat sessions</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {chatSessions.map((session) => (
                                  <div
                                    key={session.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 w-full max-w-full ${
                                      getCurrentSessionId() === session.id ? 'bg-primary/10 border-primary' : 'border-border'
                                    }`}
                                    onClick={() => loadSession(session.id)}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm truncate">
                                          {session.summary && session.summary !== 'null' 
                                            ? (session.summary.length > 30 ? session.summary.substring(0, 30) + '...' : session.summary)
                                            : session.name || 'Unnamed Session'}
                                        </p>
                                        {session.mode && (
                                          <span className={`text-xs px-2 py-1 rounded-full ${
                                            session.mode === 'call' 
                                              ? 'bg-blue-100 text-blue-700' 
                                              : 'bg-green-100 text-green-700'
                                          }`}>
                                            {session.mode === 'call' ? 'Speech' : 'Chat'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-muted-foreground truncate">
                                          {new Date(session.updatedAt).toLocaleDateString()}
                                        </p>
                                        {!session.isStarred && (
                                          <span className="text-xs text-orange-500 truncate">
                                            • Auto-delete in 24h
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteSession(session.id);
                                        }}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button
                              onClick={() => {
                                setShowHistoryDialog(false);
                                createNewSession();
                              }}
                              className="w-full"
                              disabled={isCreatingSession}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              {isCreatingSession ? "Creating..." : "New Chat"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      {/* Custom tooltip */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                        View chat history and manage sessions
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Mode Selector */}
              {activeMode === 'chat' && (
                <div className="px-3 py-2 border-b border-border flex-shrink-0">
                  <ChatModeSelector
                    selectedMode={selectedChatMode}
                    onModeChange={setSelectedChatMode}
                  />
                </div>
              )}

              {/* Content Area - Different content based on active mode */}
              {activeMode === 'chat' && (
                <>
                  {/* Messages - Scrollable container */}
                  <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full" ref={chatScrollRef}>
                      <div className="p-4 space-y-4">
                        {getCurrentMessages().map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] p-3 rounded-lg ${
                                message.isUser
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {message.isUser ? (
                                <p className="text-sm">{message.content}</p>
                              ) : (
                                <MessageWithSources 
                                  message={message} 
                                  onSourceClick={handleSourceCitationClick}
                                />
                              )}
                              <p className="text-xs opacity-70 mt-1">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                        {isSending && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] p-3 rounded-lg bg-muted text-foreground">
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                <p className="text-sm">AI is thinking...</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-border flex-shrink-0">
                    {/* Model Selector and Context Toggle */}
                    <div className="mb-3 flex justify-end items-center gap-2">
                      <div className="relative group">
                        <Button
                          variant={contextOnly ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContextOnly(!contextOnly)}
                          className="flex items-center gap-1.5 h-8 px-2"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span className="text-xs">Context</span>
                        </Button>
                        {/* Custom tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                          {contextOnly ? "Context only mode enabled - AI will only respond based on your workspace documents" : "Context only mode disabled - AI can use general knowledge"}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <ModelSelector
                        selectedModel={selectedModel}
                        onModelChange={setSelectedModel}
                      />
                    </div>
                    <div className="space-y-2">
                      {/* Context Display (when pendingContext exists) */}
                      {pendingContext && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
                          <span className="text-xs font-medium text-muted-foreground">Context:</span>
                          <input
                            type="text"
                            value={pendingContext}
                            onChange={(e) => setPendingContext(e.target.value)}
                            className="flex-1 text-xs bg-transparent border-none outline-none resize-none"
                            placeholder="Edit context..."
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingContext(null)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <textarea
                          ref={chatInputRef}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder={pendingContext ? "Ask about the selected context..." : "Ask about this document..."}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSending}
                          rows={1}
                          style={{
                            height: 'auto',
                            overflow: 'hidden'
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                          }}
                        />
                        <Button 
                          onClick={() => handleSendMessage()} 
                          size="sm" 
                          className="px-4 h-[44px] rounded-lg transition-all duration-200"
                          disabled={isSending || !inputValue.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Call Content - Voice Chat */}
              {activeMode === 'call' && (
                <FileVoiceCallPanel
                  isOpen={true}
                  onClose={() => setActiveMode('chat')}
                  fileId={fileId}
                  fileName={file?.originalName || 'document'}
                  workspaceId={file?.workspaceId?.toString() || ''}
                />
              )}




              {activeMode === 'generate' && (
                <div className="flex-1 flex flex-col p-4 space-y-4">
                  {/* Generation Controls */}
                  <div className="space-y-4">
                    {/* Generation Type Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Content Type</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>
                              {generationTypes.find(t => t.value === selectedGenerationType)?.label || 'Select type'}
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full">
                          {generationTypes.map((type) => {
                            const IconComponent = type.icon;
                            return (
                              <DropdownMenuItem
                                key={type.value}
                                onClick={() => setSelectedGenerationType(type.value)}
                                className="flex items-center gap-2"
                              >
                                <IconComponent className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">{type.label}</div>
                                  <div className="text-xs text-muted-foreground">{type.description}</div>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Generate Button */}
                    <Button
                      onClick={handleGenerateContent}
                      disabled={isGenerating}
                      className="w-full"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          {selectedGenerationType === 'quiz' || selectedGenerationType === 'exam' ? 'Next' : 'Generate Content'}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Generated Content Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Generated Content</h4>
                      {isLoadingGeneratedFiles && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      )}
                    </div>
                    
                    {generatedFiles.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No content generated yet. Select a type above and click "Generate Content" to get started.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Category Filter */}
                        <div className="flex items-center gap-2">
                          <label htmlFor="generated-category-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                            Filter by:
                          </label>
                          <Select 
                            value={selectedGeneratedCategory} 
                            onValueChange={setSelectedGeneratedCategory}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getGeneratedCategories().map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category === 'All' ? 'All Types' : getGenerationTypeDisplayName(category)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Generated Files List */}
                        <div className="space-y-2">
                          {filteredGeneratedFiles.length === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-xs text-muted-foreground">
                                No {selectedGeneratedCategory === 'All' ? '' : getGenerationTypeDisplayName(selectedGeneratedCategory).toLowerCase()} content found.
                              </p>
                            </div>
                          ) : (
                            filteredGeneratedFiles.map((generatedFile) => (
                              <div
                                key={generatedFile.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                                onClick={() => handleOpenGeneratedFile(generatedFile)}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {generatedFile.originalName}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{getGenerationTypeDisplayName(generatedFile.metadata?.generationType || 'Unknown')}</span>
                                      <span>•</span>
                                      <span>Generated {new Date(generatedFile.createdAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="flex-shrink-0 h-8 w-8 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenGeneratedFile(generatedFile);
                                          }}
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Open generated content</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="flex-shrink-0 h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteGeneratedFile(generatedFile, e);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Delete generated content</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Quiz Configuration Dialog */}
      <QuizConfigDialog
        isOpen={showQuizConfigDialog}
        onClose={() => setShowQuizConfigDialog(false)}
        onConfirm={handleQuizConfigConfirm}
        isGenerating={isGenerating}
      />

      {/* Exam Configuration Dialog */}
      <ExamConfigDialog
        isOpen={showExamConfigDialog}
        onClose={() => setShowExamConfigDialog(false)}
        onConfirm={handleExamConfigConfirm}
        isGenerating={isGenerating}
      />

    </div>
  );
};

// Component to render source citations
function SourceCitationBadge({ citation, onSourceClick }: { citation: SourceCitation; onSourceClick: (citation: SourceCitation) => void }) {
  // Check if this is a YouTube video with timestamp
  const isYouTubeWithTimestamp = citation.metadata?.type === 'youtube' && citation.metadata?.timestamp;
  
  if (isYouTubeWithTimestamp) {
    const timestamp = citation.metadata.timestamp;
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const timestampText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    return (
      <Badge 
        variant="secondary" 
        className="cursor-pointer hover:bg-blue-100 transition-colors"
        onClick={() => onSourceClick(citation)}
      >
        <FileText className="w-3 h-3 mr-1" />
        {timestampText}
        <span className="ml-1 text-xs opacity-70">({(citation.similarity * 100).toFixed(0)}%)</span>
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="secondary" 
      className="cursor-pointer hover:bg-blue-100 transition-colors"
      onClick={() => onSourceClick(citation)}
    >
      <FileText className="w-3 h-3 mr-1" />
      {citation.fileName}
      {citation.pageNumber && ` - Page ${citation.pageNumber}`}
      <span className="ml-1 text-xs opacity-70">({(citation.similarity * 100).toFixed(0)}%)</span>
    </Badge>
  );
}

// Component to render message with source citations
const MessageWithSources = React.memo(({ message, onSourceClick }: { message: Message; onSourceClick: (citation: SourceCitation) => void }) => {

  // Multiple patterns to catch different citation formats
  const sourcePatterns = [
    /\[SOURCE (\d+)(?:, (\d+))*\]/g,
    /\[Source (\d+)(?:, (\d+))*\]/g,
    /\[source (\d+)(?:, (\d+))*\]/g,
    /SOURCE (\d+)(?:, (\d+))*\b/g,
    /Source (\d+)(?:, (\d+))*\b/g,
    /\(SOURCE (\d+)(?:, (\d+))*\)/g,
    /\(Source (\d+)(?:, (\d+))*\)/g,
    /"SOURCE (\d+)(?:, (\d+))*"/g,
    /"Source (\d+)(?:, (\d+))*"/g,
    /• \[SOURCE (\d+)(?:, (\d+))*\]/g,
    /• \[Source (\d+)(?:, (\d+))*\]/g,
  ];

  let matchFound = false;
  let parts: Array<{ type: 'text' | 'citation'; content: string; sourceNumbers: number[]; fullMatch: string }> = [];
  let lastIndex = 0;



  // Try each pattern
  for (const pattern of sourcePatterns) {
    const matches = [...message.content.matchAll(pattern)];
    
    if (matches.length > 0) {
      matchFound = true;
      
      matches.forEach((match) => {
        if (match.index! > lastIndex) {
          parts.push({
            type: 'text',
            content: message.content.slice(lastIndex, match.index),
            sourceNumbers: [],
            fullMatch: ''
          });
        }
        
        const sourceNumbers = match.slice(1).filter(Boolean).map(Number);
        
        parts.push({
          type: 'citation',
          content: match[0],
          sourceNumbers,
          fullMatch: match[0]
        });
        
        lastIndex = match.index! + match[0].length;
      });
      
      break; // Use the first pattern that finds matches
    }
  }

  // Add remaining text
  if (lastIndex < message.content.length) {
    parts.push({
      type: 'text',
      content: message.content.slice(lastIndex),
      sourceNumbers: [],
      fullMatch: ''
    });
  }

  // If no citations found, just render the text normally with markdown
  if (!matchFound) {
    
    // Fallback: Look for any text in brackets that might be a citation
    const fallbackPattern = /\[([^\]]+)\]/g;
    const fallbackMatches = [...message.content.matchAll(fallbackPattern)];
    
    if (fallbackMatches.length > 0) {
      
      // Render with fallback citations
      const fallbackParts = [];
      let fallbackLastIndex = 0;
      
      fallbackMatches.forEach((match, index) => {
        if (match.index! > fallbackLastIndex) {
          fallbackParts.push({
            type: 'text',
            content: message.content.slice(fallbackLastIndex, match.index)
          });
        }
        
        fallbackParts.push({
          type: 'fallback_citation',
          content: match[0],
          citationText: match[1]
        });
        
        fallbackLastIndex = match.index! + match[0].length;
      });
      
      if (fallbackLastIndex < message.content.length) {
        fallbackParts.push({
          type: 'text',
          content: message.content.slice(fallbackLastIndex)
        });
      }
      
      return (
        <div className="prose prose-sm max-w-none space-y-4">
          {fallbackParts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <span key={index}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.content}
                  </ReactMarkdown>
                </span>
              );
            } else {
              // Check if this is a YouTube video citation
              const matchingCitation = message.sourceCitations?.[0];
              if (matchingCitation?.metadata?.type === 'youtube' && matchingCitation.metadata?.timestamp) {
                // For YouTube videos, show the timestamp as plain text (not clickable)
                const timestamp = matchingCitation.metadata.timestamp;
                const minutes = Math.floor(timestamp / 60);
                const seconds = Math.floor(timestamp % 60);
                return (
                  <span key={index} className="inline-flex items-center gap-1">
                    <span className="text-foreground text-sm">
                      {`${minutes}:${seconds.toString().padStart(2, '0')}`}
                    </span>
                  </span>
                );
              }
              
              return (
                <span key={index} className="inline-flex items-center gap-1">
                  <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                        onClick={() => {
                          console.log('Fallback citation clicked:', part.citationText);
                          // Try to find a matching citation
                          if (matchingCitation) {
                            onSourceClick(matchingCitation);
                          }
                        }}>
                    {part.content}
                  </span>
                </span>
              );
            }
          })}
        </div>
      );
    }
    
    // No citations at all, just render with markdown
    return (
      <div className="prose prose-sm max-w-none space-y-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render with inline citations
  return (
    <div className="prose prose-sm max-w-none space-y-4">
      <div className="inline">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <span key={index} className="inline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {part.content}
                </ReactMarkdown>
              </span>
            );
          } else {
            // Find the corresponding source citations
            const citations = part.sourceNumbers.map(num => {
              // Try to find citation by chunkIndex first (num - 1 because AI uses 1-based indexing)
              let citation = message.sourceCitations?.find(c => c.chunkIndex === num - 1);
              
              // If not found, try to find by array index
              if (!citation && message.sourceCitations && message.sourceCitations.length >= num) {
                citation = message.sourceCitations[num - 1];
              }
              
              // If still not found, use the first available citation
              if (!citation && message.sourceCitations && message.sourceCitations.length > 0) {
                citation = message.sourceCitations[0];
              }
              
              console.log(`🔍 Looking for citation ${num}:`);
              console.log(`   - By chunkIndex ${num - 1}:`, message.sourceCitations?.find(c => c.chunkIndex === num - 1));
              console.log(`   - By array index ${num - 1}:`, message.sourceCitations?.[num - 1]);
              console.log(`   - Final result:`, citation);
              console.log(`📋 Available citations:`, message.sourceCitations?.map(c => ({ chunkIndex: c.chunkIndex, fileName: c.fileName })));
              
              return citation;
            }).filter(Boolean) as SourceCitation[];
            
            console.log(`✅ Citations found for part ${index}:`, citations);
            
            return (
              <span key={index} className="inline">
                                  {(() => {
                    // Check if this is a YouTube video with timestamp
                    const citation = citations[0];
                    if (citation?.metadata?.type === 'youtube' && citation.metadata?.timestamp) {
                      // For YouTube videos, show the timestamp as plain text (not clickable)
                      const timestamp = citation.metadata.timestamp;
                      const minutes = Math.floor(timestamp / 60);
                      const seconds = Math.floor(timestamp % 60);
                      return (
                        <span className="text-foreground text-sm">
                          {`${minutes}:${seconds.toString().padStart(2, '0')}`}
                        </span>
                      );
                    }
                    // For non-YouTube files, show the original clickable [source x] format
                    return (
                      <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                            onClick={() => {
                              console.log('🎯 Citation clicked:', part.fullMatch);
                              console.log('📄 Citation data:', citations[0]);
                              citations[0] && onSourceClick(citations[0]);
                            }}>
                        {part.fullMatch}
                      </span>
                    );
                  })()}
              </span>
            );
          }
        })}
      </div>
    </div>
  );
});

export default FilePreviewPage;