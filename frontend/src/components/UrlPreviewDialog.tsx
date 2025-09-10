import { useState } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Youtube, Globe, ExternalLink, Play, FileText } from "lucide-react";
import { YouTubeTranscript } from "./YouTubeTranscript";

interface UrlPreviewDialogProps {
  file: {
    id: string;
    originalName: string;
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
  };
  trigger?: React.ReactNode;
}

export function UrlPreviewDialog({ file, trigger }: UrlPreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-1">
      <FileText className="w-4 h-4" />
      Preview
    </Button>
  );

  const handleOpenOriginal = () => {
    if (file.metadata?.originalUrl) {
      window.open(file.metadata.originalUrl, '_blank');
    }
  };

  const handlePlayVideo = () => {
    setIsPlaying(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {file.metadata?.type === 'youtube' ? (
              <Youtube className="w-5 h-5 text-red-500" />
            ) : (
              <Globe className="w-5 h-5 text-blue-500" />
            )}
            {file.metadata?.title || file.originalName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* URL Info */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Original URL:</span>
              <a 
                href={file.metadata?.originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm truncate max-w-xs"
              >
                {file.metadata?.originalUrl}
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenOriginal}
              className="flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </Button>
          </div>

          {/* YouTube Video */}
          {file.metadata?.type === 'youtube' && (
            <div className="space-y-4">
                              {file.metadata?.thumbnail && (
                  <div className="relative">
                    <img 
                      src={file.metadata.thumbnail} 
                      alt={file.metadata?.title || file.originalName}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  {!isPlaying && (
                    <Button
                      onClick={handlePlayVideo}
                      className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 hover:bg-black/70"
                    >
                      <Play className="w-8 h-8 text-white" />
                    </Button>
                  )}
                </div>
              )}
              
              {isPlaying && file.metadata?.embedUrl && (
                <div className="aspect-video">
                  <iframe
                    src={file.metadata.embedUrl}
                    title={file.metadata?.title || file.originalName}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              )}

              {file.metadata?.channel && (
                <div className="text-sm text-muted-foreground">
                  Channel: {file.metadata.channel}
                </div>
              )}

              {/* Transcript */}
              <YouTubeTranscript fileId={file.id} />
            </div>
          )}

          {/* Website Content */}
          {file.metadata?.type === 'website' && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <h3 className="text-lg font-semibold">Content Summary</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {file.metadata?.summary}
                </p>
              </div>
              
              {file.metadata?.content && (
                <div className="prose prose-sm max-w-none">
                  <h3 className="text-lg font-semibold">Full Content</h3>
                  <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {file.metadata?.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {file.metadata?.description && (
            <div className="prose prose-sm max-w-none">
              <h3 className="text-lg font-semibold">Description</h3>
              <p className="text-muted-foreground">
                {file.metadata.description}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 