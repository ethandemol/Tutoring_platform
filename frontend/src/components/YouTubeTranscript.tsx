import { useState, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Play, Clock, FileText, AlertCircle, Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

interface ProcessedSentence {
  id: number;
  text: string;
  startIndex: number;
  startTimestamp: number;
  formattedTimestamp: string;
}

interface ProcessedTranscript {
  originalSnippets: TranscriptSnippet[];
  sentences: ProcessedSentence[];
  totalDuration: number;
  combinedText: string;
}

interface YouTubeTranscriptProps {
  fileId: string;
  onTimestampClick?: (timestamp: number) => void;
  videoId?: string;
}

export function YouTubeTranscript({ fileId, onTimestampClick, videoId }: YouTubeTranscriptProps) {
  const [transcript, setTranscript] = useState<{
    snippets: TranscriptSnippet[];
    total_duration: number;
    snippet_count: number;
  } | null>(null);
  const [processedTranscript, setProcessedTranscript] = useState<ProcessedTranscript | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');

  // Fetch transcript data
  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(buildApiUrl(API_ENDPOINTS.TRANSCRIBE.TRANSCRIPT(fileId)), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transcript');
        }

        const data = await response.json();
        
        if (data.success) {
          setTranscript(data.data.transcript);
          setProcessedTranscript(data.data.processedTranscript);
          setSummary(data.data.summary);
        } else {
          setError(data.message || 'Transcript not available');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setIsLoading(false);
      }
    };

    if (fileId) {
      fetchTranscript();
    }
  }, [fileId]);

  // Format timestamp to MM:SS
  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Filter transcript snippets based on search query
  const filteredSnippets = transcript?.snippets.filter(snippet =>
    snippet.text.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Filter sentences based on search query
  const filteredSentences = processedTranscript?.sentences.filter(sentence =>
    sentence.text.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Generate YouTube URL with timestamp
  const generateYouTubeUrlWithTimestamp = (timestamp: number) => {
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?start=${Math.floor(timestamp)}`;
  };

  // Handle timestamp click
  const handleTimestampClick = (timestamp: number) => {
    if (onTimestampClick) {
      onTimestampClick(timestamp);
    }
    
    // If we have a videoId, also update the YouTube iframe
    if (videoId) {
      const newUrl = generateYouTubeUrlWithTimestamp(timestamp);
      if (newUrl) {
        // Find the YouTube iframe and update its src
        const iframe = document.querySelector('iframe[src*="youtube.com/embed"]') as HTMLIFrameElement;
        if (iframe) {
          iframe.src = newUrl;
        }
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading transcript...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !transcript) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>{error || 'No transcript available for this video'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        {/* Tab Navigation */}
        <div className="flex gap-1">
          {processedTranscript && (
            <Button
              variant={activeTab === 'transcript' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('transcript')}
            >
              Transcript
            </Button>
          )}
          {summary && (
            <Button
              variant={activeTab === 'summary' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('summary')}
            >
              AI Summary
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {activeTab === 'transcript' ? (
                      <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Transcript Content */}
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {filteredSentences.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'No matches found' : 'No transcript available'}
                    </div>
                  ) : (
                    filteredSentences.map((sentence, index) => (
                      <div
                        key={sentence.id}
                        className="flex gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-shrink-0 h-auto p-1 text-xs font-mono text-muted-foreground hover:text-primary"
                          onClick={() => handleTimestampClick(sentence.startTimestamp)}
                        >
                          {sentence.formattedTimestamp}
                        </Button>
                        <div className="flex-1">
                          <div className="text-sm leading-relaxed">
                            {sentence.text}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Search Results Info */}
              {searchQuery && filteredSentences.length > 0 && (
                <div className="text-xs text-muted-foreground text-center">
                  Found {filteredSentences.length} result{filteredSentences.length !== 1 ? 's' : ''} for "{searchQuery}"
                </div>
              )}
            </div>
        ) : (
          /* AI Summary Tab */
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <div className="text-sm leading-relaxed">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                  h2: ({ children }) => (
                    <h2 className="text-lg font-semibold text-foreground mt-6 mb-3 first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-foreground mt-4 mb-2">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-muted-foreground mb-3">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-sm text-muted-foreground mb-3 space-y-1">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm text-muted-foreground">
                      {children}
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-muted-foreground">
                      {children}
                    </em>
                  )
                }}
              >
                {summary || ''}
              </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 