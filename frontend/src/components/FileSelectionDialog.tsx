import React, { useState, useEffect } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { FileText, Image, Video, Globe, File } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface FileItem {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  s3Url: string;
  workspaceId: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  mimeType?: string;
  metadata?: {
    type: 'youtube' | 'website' | 'generated';
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

interface FileSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  generationType: string;
  onConfirm: (selectedFileIds: string[]) => void;
}

export function FileSelectionDialog({
  isOpen,
  onClose,
  workspaceId,
  generationType,
  onConfirm
}: FileSelectionDialogProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && workspaceId) {
      fetchFiles();
    }
  }, [isOpen, workspaceId]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.WORKSPACE(workspaceId)), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Filter out generated files and only show processed files
        const processedFiles = data.data.filter((file: FileItem) => 
          file.processingStatus === 'completed' && 
          file.metadata?.type !== 'generated'
        );
        setFiles(processedFiles);
      } else {
        toast({
          title: "Error fetching files",
          description: data.message || "Failed to load files",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error fetching files",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileToggle = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(file => file.id));
    }
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to generate content from",
        variant: "destructive",
      });
      return;
    }
    onConfirm(selectedFiles);
    onClose();
  };

  const getFileIcon = (file: FileItem) => {
    if (file.metadata?.type === 'youtube') return <Video className="w-4 h-4" />;
    if (file.metadata?.type === 'website') return <Globe className="w-4 h-4" />;
    if (file.mimeType?.startsWith('image/')) return <Image className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getGenerationTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'exam': 'Exam',
      'quiz': 'Quiz',
      'practice': 'Practice Questions',
      'flashcards': 'Flashcards',
      'cheatsheet': 'Cheat Sheet',
      'studyguide': 'Study Guide',
      'notes': 'Notes'
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Select Files for {getGenerationTypeLabel(generationType)} Generation
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No processed files found in this workspace.</p>
              <p className="text-sm">Upload and process some files first to generate content.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-medium">
                  {selectedFiles.length} of {files.length} files selected
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <ScrollArea className="h-64 border rounded-md p-4">
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={file.id}
                        checked={selectedFiles.includes(file.id)}
                        onCheckedChange={() => handleFileToggle(file.id)}
                      />
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {getFileIcon(file)}
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={file.id}
                            className="text-sm font-medium truncate cursor-pointer"
                          >
                            {file.originalName}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={selectedFiles.length === 0 || isLoading}
          >
            Generate {getGenerationTypeLabel(generationType)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 