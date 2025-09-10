import React, { useState } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { MoreVertical, Info, FileText, Youtube, Globe, Download, Edit3, Trash2, Eye, Target, FileQuestion, CheckSquare, BookOpen, Brain, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    generatedAt?: string;
  };
}

interface FileCardProps {
  file: FileItem;
  viewMode: 'grid' | 'list';
  onPreview: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  categories: string[];
  isGenerationMode?: boolean;
  isSelected?: boolean;
  onSelectionToggle?: (fileId: string) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, file: FileItem) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function FileCard({
  file,
  viewMode,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  categories,
  isGenerationMode = false,
  isSelected = false,
  onSelectionToggle,
  isDraggable = false,
  onDragStart,
  onDragEnd
}: FileCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const getFileIcon = (file: FileItem) => {
    if (file.metadata?.type === 'youtube') {
      return <Youtube className="w-8 h-8 text-red-500" />;
    } else if (file.metadata?.type === 'website') {
      return <Globe className="w-8 h-8 text-blue-500" />;
    } else if (file.metadata?.type === 'generated') {
      const type = file.metadata.generationType;
      if (type === 'practice_questions') return <Target className="w-8 h-8 text-green-500" />;
      if (type === 'exam') return <FileQuestion className="w-8 h-8 text-orange-500" />;
      if (type === 'quiz') return <CheckSquare className="w-8 h-8 text-purple-500" />;
      if (type === 'flashcards') return <BookOpen className="w-8 h-8 text-indigo-500" />;
      if (type === 'cheat_sheet') return <Brain className="w-8 h-8 text-pink-500" />;
      if (type === 'study_guide') return <FileText className="w-8 h-8 text-teal-500" />;
      if (type === 'notes') return <Edit3 className="w-8 h-8 text-cyan-500" />;
      return <FileText className="w-8 h-8 text-primary" />;
    } else {
      return <FileText className="w-8 h-8 text-primary" />;
    }
  };

  const getFileTypeLabel = (file: FileItem) => {
    if (file.metadata?.type === 'youtube') {
      return 'YouTube Video';
    } else if (file.metadata?.type === 'website') {
      return 'Website';
    } else if (file.metadata?.type === 'generated') {
      const type = file.metadata.generationType;
      if (type === 'practice_questions') return 'Practice Questions';
      if (type === 'exam') return 'Exam';
      if (type === 'quiz') return 'Quiz';
      if (type === 'flashcards') return 'Flashcards';
      if (type === 'cheat_sheet') return 'Cheat Sheet';
      if (type === 'study_guide') return 'Study Guide';
      if (type === 'notes') return 'Notes';
      return 'Generated Content';
    } else {
      // Check file extension for better labeling
      const extension = file.originalName.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') return 'PDF Document';
      if (extension === 'doc' || extension === 'docx') return 'Word Document';
      if (extension === 'xls' || extension === 'xlsx') return 'Excel Spreadsheet';
      if (extension === 'ppt' || extension === 'pptx') return 'PowerPoint Presentation';
      if (extension === 'txt') return 'Text Document';
      if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'gif') return 'Image';
      return 'Document';
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
    
    if (diffInHours < 24) {
      if (diffInHours < 1) return 'Just now';
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const generatePreviewImage = async () => {
    if (file.metadata?.type === 'youtube' && file.metadata.thumbnail) {
      setPreviewImage(file.metadata.thumbnail);
      return;
    }

    // For PDFs and other documents, try to generate a preview
    if (!file.metadata?.type || file.metadata.type === 'generated' || file.metadata.type === 'handwriting_pdf') {
      setIsLoadingPreview(true);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Preview generation timeout')), 10000); // 10 second timeout
      });
      
      try {
        const token = localStorage.getItem('authToken');
        const pdfUrl = `${buildApiUrl(API_ENDPOINTS.FILES.PREVIEW(file.id))}?token=${token}`;
        
        // Try to generate a preview using PDF.js with timeout
        const previewPromise = (async () => {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
          
          // Load PDF and render first page
          const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
          const page = await pdf.getPage(1);
          
          // Create canvas with reasonable size
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          const viewport = page.getViewport({ scale: 0.5 }); // Good quality for preview
          
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({
            canvasContext: context!,
            viewport: viewport
          }).promise;
          
          return canvas.toDataURL('image/png');
        })();
        
        const dataUrl = await Promise.race([previewPromise, timeoutPromise]);
        setPreviewImage(dataUrl as string);
      } catch (error) {
        console.error('Failed to generate PDF preview:', error);
        // Fall back to placeholder
        setPreviewImage(null);
      } finally {
        setIsLoadingPreview(false);
      }
      return;
    }

    // For websites, try to get a screenshot
    if (file.metadata?.type === 'website') {
      setIsLoadingPreview(true);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Website preview timeout')), 10000); // 10 second timeout
      });
      
      try {
        const token = localStorage.getItem('authToken');
        const previewUrl = `${buildApiUrl(API_ENDPOINTS.FILES.PREVIEW(file.id))}?token=${token}`;
        
        // Use the same pattern as PDF preview - fetch the file and render to canvas
        const previewPromise = (async () => {
          // Fetch the text file content
          const response = await fetch(previewUrl);
          const textContent = await response.text();
          
          // Create canvas to render the text content
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          // Set canvas size
          canvas.width = 1200;
          canvas.height = 800;
          
          // Fill background
          context!.fillStyle = '#ffffff';
          context!.fillRect(0, 0, canvas.width, canvas.height);
          
          // Helper function to wrap text
          const wrapText = (text: string, maxWidth: number) => {
            const words = text.split(' ');
            const lines: string[] = [];
            let currentLine = words[0] || '';
            
            for (let i = 1; i < words.length; i++) {
              const word = words[i];
              const width = context!.measureText(currentLine + ' ' + word).width;
              if (width < maxWidth) {
                currentLine += ' ' + word;
              } else {
                lines.push(currentLine);
                currentLine = word;
              }
            }
            lines.push(currentLine);
            return lines;
          };
          
          // Draw the actual file content from the top
          context!.font = '16px Arial, sans-serif';
          context!.fillStyle = '#000000';
          
          const lines = textContent.split('\n'); // Show all lines
          let yOffset = 40;
          
          lines.forEach((line) => {
            if (line.trim() && yOffset < 760) {
              const wrappedLines = wrapText(line, 1160);
              wrappedLines.forEach((wrappedLine) => {
                if (yOffset < 760) {
                  context!.fillText(wrappedLine, 20, yOffset);
                  yOffset += 24; // More spacing between lines
                }
              });
            }
          });
          
          // Convert to data URL (same as PDF preview)
          return canvas.toDataURL('image/png');
        })();
        
        const dataUrl = await Promise.race([previewPromise, timeoutPromise]);
        setPreviewImage(dataUrl as string);
      } catch (error) {
        console.error('Failed to generate website preview:', error);
        setPreviewImage(null);
      } finally {
        setIsLoadingPreview(false);
      }
      return;
    }

    // For all other file types, show a placeholder
    setPreviewImage(null);
  };

  React.useEffect(() => {
    generatePreviewImage();
  }, [file.id]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerationMode && onSelectionToggle) {
      onSelectionToggle(file.id);
    } else {
      onPreview(file);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isDraggable && onDragStart) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify(file));
      onDragStart(e, file);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (isDraggable && onDragEnd) {
      onDragEnd(e);
    }
  };

  const fileDetails = {
    'File Name': file.originalName,
    'Type': getFileTypeLabel(file),
    'Size': formatFileSize(file.fileSize),
    'Date Added': formatDate(file.createdAt),
    'Category': 'All', // Removed category from details
    'Status': file.processingStatus
  };

  return (
    <TooltipProvider>
      <div
        className={`bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all duration-300 hover:border-primary/20 cursor-pointer min-w-0 ${
          viewMode === 'list' ? 'flex items-center gap-4' : ''
        } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={handleCardClick}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Preview Image Section */}
        <div className={`${viewMode === 'list' ? 'flex-shrink-0' : 'mb-4'}`}>
          <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
            {/* Generation Mode Selection Overlay */}
            {isGenerationMode && (
              <div className="absolute top-2 left-2 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 rounded-full transition-all ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'bg-background/80 text-muted-foreground hover:bg-background'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectionToggle?.(file.id);
                  }}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : previewImage ? (
              <img
                src={previewImage}
                alt={file.originalName}
                className="w-full h-full object-cover"
                onError={() => setPreviewImage(null)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4">
                {file.metadata?.type === 'website' ? (
                  // Custom website preview
                  <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex flex-col items-center justify-center">
                    <div className="mb-3">
                      <Globe className="w-12 h-12 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-blue-900 mb-1">Website</p>
                      <p className="text-xs text-blue-700 mb-2">
                        {(() => {
                          // Try to get the best available text for the website
                          if (file.metadata?.originalUrl) {
                            try {
                              return new URL(file.metadata.originalUrl).hostname;
                            } catch {
                              return file.metadata.originalUrl.length > 20 ? 
                                file.metadata.originalUrl.substring(0, 20) + '...' : 
                                file.metadata.originalUrl;
                            }
                          } else if (file.metadata?.title) {
                            return file.metadata.title.length > 25 ? 
                              file.metadata.title.substring(0, 25) + '...' : 
                              file.metadata.title;
                          } else if (file.originalName && file.originalName !== file.fileName) {
                            return file.originalName.length > 25 ? 
                              file.originalName.substring(0, 25) + '...' : 
                              file.originalName;
                          } else {
                            return 'External Link';
                          }
                        })()}
                      </p>
                      <p className="text-xs text-blue-600">
                        {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Custom placeholders for different file types
                  <div className="w-full h-full rounded-lg flex flex-col items-center justify-center">
                    {file.metadata?.type === 'generated' ? (
                      // Generated content with custom styling
                      <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center ${
                        file.metadata.generationType === 'practice_questions' ? 'bg-gradient-to-br from-green-50 to-green-100' :
                        file.metadata.generationType === 'exam' ? 'bg-gradient-to-br from-orange-50 to-orange-100' :
                        file.metadata.generationType === 'quiz' ? 'bg-gradient-to-br from-purple-50 to-purple-100' :
                        file.metadata.generationType === 'flashcards' ? 'bg-gradient-to-br from-indigo-50 to-indigo-100' :
                        file.metadata.generationType === 'cheat_sheet' ? 'bg-gradient-to-br from-pink-50 to-pink-100' :
                        file.metadata.generationType === 'study_guide' ? 'bg-gradient-to-br from-teal-50 to-teal-100' :
                        file.metadata.generationType === 'notes' ? 'bg-gradient-to-br from-cyan-50 to-cyan-100' :
                        'bg-gradient-to-br from-gray-50 to-gray-100'
                      }`}>
                        <div className="mb-3">
                          {getFileIcon(file)}
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-medium mb-1 ${
                            file.metadata.generationType === 'practice_questions' ? 'text-green-900' :
                            file.metadata.generationType === 'exam' ? 'text-orange-900' :
                            file.metadata.generationType === 'quiz' ? 'text-purple-900' :
                            file.metadata.generationType === 'flashcards' ? 'text-indigo-900' :
                            file.metadata.generationType === 'cheat_sheet' ? 'text-pink-900' :
                            file.metadata.generationType === 'study_guide' ? 'text-teal-900' :
                            file.metadata.generationType === 'notes' ? 'text-cyan-900' :
                            'text-gray-900'
                          }`}>
                            {getFileTypeLabel(file)}
                          </p>
                          <p className={`text-xs ${
                            file.metadata.generationType === 'practice_questions' ? 'text-green-700' :
                            file.metadata.generationType === 'exam' ? 'text-orange-700' :
                            file.metadata.generationType === 'quiz' ? 'text-purple-700' :
                            file.metadata.generationType === 'flashcards' ? 'text-indigo-700' :
                            file.metadata.generationType === 'cheat_sheet' ? 'text-pink-700' :
                            file.metadata.generationType === 'study_guide' ? 'text-teal-700' :
                            file.metadata.generationType === 'notes' ? 'text-cyan-700' :
                            'text-gray-700'
                          }`}>
                            {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Generic placeholder for other files
                      <div className="w-full h-full bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg flex flex-col items-center justify-center">
                        <div className="mb-2">
                          {getFileIcon(file)}
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-foreground mb-1">
                            {getFileTypeLabel(file)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Info Icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 hover:bg-background"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="w-64">
                <div className="space-y-2">
                  {Object.entries(fileDetails).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium text-xs">{key}:</span>
                      <span className="text-xs text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content Section */}
        <div className={viewMode === 'list' ? 'flex-1' : ''}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground line-clamp-2 text-sm">
                {file.originalName}
              </h3>
              <p className="text-xs text-muted-foreground">{getFileTypeLabel(file)}</p>
              {isDraggable && (
                <p className="text-xs text-primary mt-1">Drag to move to folder</p>
              )}
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
                {file.metadata && (file.metadata.type === 'youtube' || file.metadata.type === 'website') ? (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(file); }}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(file); }}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(file); }}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(file); }}
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
    </TooltipProvider>
  );
} 