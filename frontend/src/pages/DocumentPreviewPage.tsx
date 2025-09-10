import { useState, useRef, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, MessageCircle, FileText, Download, Eye, Grid, List, BookOpen, ChevronLeft, ChevronRight, Youtube, Globe, ExternalLink, FileQuestion, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from "@/components/AppSidebar";
import { Document, Page, pdfjs } from 'react-pdf';
import 'pdfjs-dist/web/pdf_viewer.css';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useSidebar } from "@/contexts/SidebarContext";
import { YouTubeTranscript } from "@/components/YouTubeTranscript";

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
    type: 'youtube' | 'website';
    originalUrl: string;
    title: string;
    description: string;
    summary: string;
    videoId?: string;
    embedUrl?: string;
    channel?: string;
    thumbnail?: string;
    content?: string;
  };
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
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
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Channel</h3>
                  <p className="text-muted-foreground">{metadata.channel}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-muted-foreground">{metadata.description}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">AI Summary</h3>
                  <p className="text-muted-foreground">{metadata.summary}</p>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <YouTubeTranscript fileId={file.id} />
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

const PDFViewer = ({ file, viewMode }: { file: any, viewMode: 'continuous' | 'single' }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const token = localStorage.getItem('authToken');
  const pdfUrl = `${buildApiUrl(API_ENDPOINTS.FILES.PREVIEW(file.id))}?token=${token}`;
  const containerRef = useRef<HTMLDivElement>(null);
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

  const goToPreviousPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages || 1, prev + 1));
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
                    setPageNumber(value);
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
        <div className="w-full h-full overflow-auto bg-muted rounded-lg">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="flex items-center justify-center h-full">Loading PDF...</div>}
            error={<div className="flex items-center justify-center h-full text-red-500">Failed to load PDF</div>}
            className="w-full h-full"
          >
            {numPages && (
              Array.from(new Array(numPages), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  width={Math.min(800, containerWidth)}
                  renderTextLayer
                  renderAnnotationLayer={false}
                />
              ))
            )}
          </Document>
        </div>
      )}
      {/* Floating Toolbar */}

    </div>
  );
};

const DocumentPreviewPage = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  
  const [file, setFile] = useState<FileItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const { isCollapsed, toggleCollapse } = useSidebar();

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

  // Handle chat parameter and sessionId from URL
  useEffect(() => {
    const shouldOpenChat = searchParams.get('chat') === 'true';
    const sessionId = searchParams.get('sessionId');
    
    if (shouldOpenChat && fileId) {
      // Navigate to chat page with file context
      if (sessionId) {
        navigate(`/chat?sessionId=${sessionId}&fileId=${fileId}`);
      } else {
        navigate(`/chat?fileId=${fileId}`);
      }
    }
  }, [searchParams, fileId, navigate]);

  useEffect(() => {
    if (fileId) {
      fetchFileDetails();
    }
  }, [fileId]);

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
    setActiveWorkspaceId(null);
    setWorkspaces(prev => prev.map(ws => ({ ...ws, isActive: false })));
    navigate('/');
  };

  const fetchFileDetails = async () => {
    if (!fileId) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.DELETE(fileId)), {
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
        onDeleteWorkspace={() => {}} // Not implemented in this page
        onRenameWorkspace={() => {}} // Not implemented in this page
        onHomeSelect={handleHomeSelect}
        isHomeActive={activeWorkspaceId === null}
        recentItems={[]}
        starredItems={[]}
        starredChatSessions={[]}
        onRecentItemSelect={() => {}}
        onStarredItemSelect={() => {}}
        onStarredChatSessionSelect={() => {}}
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
                    <h1 className="font-semibold text-foreground">{file.originalName}</h1>
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
                    />
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Floating Ask Sparqy Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => navigate(`/file/${fileId}`)}
            className="w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground group relative"
            size="lg"
          >
            <MessageCircle className="w-6 h-6" />
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-foreground text-background text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              Ask Sparqy
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewPage;