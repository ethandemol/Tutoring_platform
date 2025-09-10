import { useState, useEffect, useRef } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { X, Send, MessageCircle, FileQuestion, Brain, Mic, Search, Clock, Zap, History, Plus, Edit3, Trash2, ExternalLink, FileText, Shield } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ModelSelector } from "./ModelSelector";
import { ChatModeSelector, ChatMode } from "./ChatModeSelector";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  workspaceId?: string;
  fileId?: string;
  initialSessionId?: string;
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
  isStarred?: boolean;
  summary?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  fileName?: string;
}

function SourceCitationBadge({ citation, onSourceClick }: { citation: SourceCitation; onSourceClick: (citation: SourceCitation) => void }) {
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
function MessageWithSources({ message, onSourceClick, showFileNames = false }: { message: Message; onSourceClick: (citation: SourceCitation) => void; showFileNames?: boolean }) {
  // Parse source citations from message content - multiple patterns
  const sourcePatterns = [
    /\[SOURCE (\d+)(?:, (\d+))*\]/g,  // [SOURCE 1] or [SOURCE 1, 2]
    /\[Source (\d+)(?:, (\d+))*\]/g,   // [Source 1] (capitalized)
    /\[source (\d+)(?:, (\d+))*\]/g,   // [source 1] (lowercase)
    /SOURCE (\d+)(?:, (\d+))*\b/g,     // SOURCE 1 (without brackets)
    /Source (\d+)(?:, (\d+))*\b/g,     // Source 1 (without brackets)
    /\(SOURCE (\d+)(?:, (\d+))*\)/g,   // (SOURCE 1) with parentheses
    /\(Source (\d+)(?:, (\d+))*\)/g,   // (Source 1) with parentheses
    /"SOURCE (\d+)(?:, (\d+))*"/g,     // "SOURCE 1" with quotes
    /"Source (\d+)(?:, (\d+))*"/g,     // "Source 1" with quotes
  ];
  
  const parts = [];
  let lastIndex = 0;
  let matchFound = false;

  console.log('Parsing message for sources:', message.content);
  console.log('Available source citations:', message.sourceCitations);
  console.log('Message content length:', message.content.length);
  console.log('First 200 characters:', message.content.substring(0, 200));
  
  // Test regex patterns with sample string
  const testString = "This is a test with [SOURCE 1] and [SOURCE 2, 3] citations";
  console.log('Testing regex patterns with:', testString);
  sourcePatterns.forEach((pattern, index) => {
    const testMatches = [...testString.matchAll(pattern)];
    console.log(`Pattern ${index + 1} test matches:`, testMatches);
  });

  // Try each pattern
  for (const pattern of sourcePatterns) {
    const matches = [...message.content.matchAll(pattern)];
    if (matches.length > 0) {
      console.log('✅ Found matches with pattern:', pattern, matches);
      matchFound = true;
      
      for (const match of matches) {
        // Add text before the citation
        if (match.index! > lastIndex) {
          parts.push({
            type: 'text',
            content: message.content.slice(lastIndex, match.index)
          });
        }

        // Add the citation
        const sourceNumbers = [parseInt(match[1])];
        if (match[2]) sourceNumbers.push(parseInt(match[2]));
        
        console.log('📄 Found source citation:', match[0], 'with numbers:', sourceNumbers);
        
        parts.push({
          type: 'citation',
          sourceNumbers,
          fullMatch: match[0]
        });

        lastIndex = match.index! + match[0].length;
      }
      break; // Use the first pattern that finds matches
    } else {
      console.log('❌ No matches found with pattern:', pattern);
    }
  }

  // Add remaining text
  if (lastIndex < message.content.length) {
    parts.push({
      type: 'text',
      content: message.content.slice(lastIndex)
    });
  }

  // If no citations found, just render the text normally
  if (!matchFound) {
    console.log('No source citations found in message');
    
    // Fallback: Look for any text in brackets that might be a citation
    const fallbackPattern = /\[([^\]]+)\]/g;
    const fallbackMatches = [...message.content.matchAll(fallbackPattern)];
    
    if (fallbackMatches.length > 0) {
      console.log('🔍 Found potential citations with fallback pattern:', fallbackMatches);
      
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
                <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                  {part.content}
                </ReactMarkdown>
              );
            } else {
              return (
                <span key={index} className="inline-flex items-center gap-1">
                  <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                        onClick={() => {
                          console.log('Fallback citation clicked:', part.citationText);
                          // Try to find a matching citation
                          const matchingCitation = message.sourceCitations?.[0];
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
    
    return (
      <div className="prose prose-sm max-w-none space-y-4 break-words whitespace-normal">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render with inline citations
  return (
    <div className="prose prose-sm max-w-none space-y-4 break-words whitespace-normal">
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
                <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                      onClick={() => {
                        console.log('🎯 Citation clicked:', part.fullMatch);
                        console.log('📄 Citation data:', citations[0]);
                        citations[0] && onSourceClick(citations[0]);
                      }}>
                  {part.fullMatch}
                  {showFileNames && citations[0]?.fileName && (
                    <span className="ml-1 text-xs text-muted-foreground">({citations[0].fileName})</span>
                  )}
                </span>
              </span>
            );
          }
        })}
      </div>
    </div>
  );
}

export function ChatPanel({ isOpen, onClose, workspaceName, workspaceId, fileId, initialSessionId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
  const [selectedChatMode, setSelectedChatMode] = useState<ChatMode>("regular");
  const [contextOnly, setContextOnly] = useState<boolean>(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle source citation clicks
  const handleSourceClick = (citation: SourceCitation) => {
    console.log('🚀 [handleSourceClick] Citation clicked:', citation);
    console.log('📄 [handleSourceClick] Current fileId:', fileId);
    console.log('📄 [handleSourceClick] Citation fileId:', citation.fileId);
    
    try {
      // Check if this is a YouTube video with timestamp
      const isYouTubeWithTimestamp = citation.metadata?.type === 'youtube' && citation.metadata?.timestamp;
      
      if (citation.fileId === parseInt(fileId || '0')) {
        // Same file - navigate to specific page or timestamp
        let url = `/file/${citation.fileId}`;
        let description = `Navigated to ${citation.fileName}`;
        
        if (isYouTubeWithTimestamp) {
          const timestamp = citation.metadata.timestamp;
          const minutes = Math.floor(timestamp / 60);
          const seconds = Math.floor(timestamp % 60);
          const timestampText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          url += `?timestamp=${timestamp}`;
          description += ` at ${timestampText}`;
        } else if (citation.pageNumber) {
          url += `?page=${citation.pageNumber}`;
          description += `, page ${citation.pageNumber}`;
        }
        
        console.log('📍 [handleSourceClick] Navigating to same file:', url);
        navigate(url);
        toast({
          title: "Source found",
          description: description,
        });
      } else {
        // Different file - navigate to that file
        let url = `/file/${citation.fileId}`;
        let description = `Navigated to ${citation.fileName}`;
        
        if (isYouTubeWithTimestamp) {
          const timestamp = citation.metadata.timestamp;
          const minutes = Math.floor(timestamp / 60);
          const seconds = Math.floor(timestamp % 60);
          const timestampText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          url += `?timestamp=${timestamp}&citation=${encodeURIComponent(JSON.stringify(citation))}`;
          description += ` at ${timestampText}`;
        } else {
          url += `?citation=${encodeURIComponent(JSON.stringify(citation))}`;
          if (citation.pageNumber) {
            description += `, page ${citation.pageNumber}`;
          }
        }
        
        console.log('📍 [handleSourceClick] Navigating to different file:', url);
        navigate(url);
        toast({
          title: "Source found",
          description: description,
        });
      }
    } catch (error) {
      console.error('❌ [handleSourceClick] Error navigating to source:', error);
      toast({
        title: "Navigation failed",
        description: "Could not navigate to the source document",
        variant: "destructive",
      });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat sessions when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchChatSessions();
    }
  }, [isOpen, workspaceId, fileId]);

  // Load initial session or create a new chat session when starting fresh
  useEffect(() => {
    if (isOpen && !currentSessionId && messages.length === 0) {
      if (initialSessionId) {
        console.log(`💬 [CHAT-PANEL-DEBUG] Loading initial session: ${initialSessionId}`);
        loadSession(initialSessionId);
      } else {
        // Try to load the most recent session, or create a new one
        loadMostRecentSession();
      }
    }
  }, [isOpen, currentSessionId, initialSessionId]);

  const fetchChatSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);
      if (fileId) params.append('fileId', fileId);

      const response = await fetch(buildApiUrl(`/chat-sessions/sessions?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Add file names to sessions
        const sessionsWithFileNames = data.data.map((session: any) => ({
          ...session,
          fileName: session.file?.originalName || undefined
        }));
        setChatSessions(sessionsWithFileNames);
        return sessionsWithFileNames; // Return the sessions for immediate use
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
        console.log(`💬 [ChatPanel] Loading most recent session: ${mostRecentSession.id}`);
        await loadSession(mostRecentSession.id);
      } else {
        // No existing sessions, create a new one
        console.log(`💬 [ChatPanel] No existing sessions, creating new session`);
        createNewSession();
      }
    } catch (error) {
      console.error('❌ [ChatPanel] Error loading most recent session:', error);
      createNewSession();
    }
  };

  const createNewSession = async () => {
    // Don't create a session immediately - just show the welcome message
    // Session will be created when user sends their first message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: fileId 
        ? `Hi! I'm your AI assistant for this document. I can help you understand the content, answer questions about it, and provide insights. What would you like to know about this document?`
        : `Hi! I'm your AI assistant for the ${workspaceName} workspace. I can help you with questions about your documents, create study plans, and assist with your learning journey. I'll search through all your uploaded documents to find relevant information. What would you like to learn today?`,
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    setCurrentSessionId(null); // No session ID until user sends first message
  };

  const createSessionAndSaveMessages = async (messages: Message[]) => {
    try {
      console.log(`🆕 [ChatPanel] Creating new session with ${messages.length} messages`);
      const token = localStorage.getItem('authToken');
      
      // Create the session
      const createResponse = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Chat',
          workspaceId,
          fileId
        }),
      });

      const createData = await createResponse.json();
      if (createResponse.ok && createData.success) {
        const sessionId = createData.data.id;
        console.log(`✅ [ChatPanel] Created new session: ${sessionId}`);
        setCurrentSessionId(sessionId);
        
        // Save all messages to the new session
        await updateSession(sessionId, messages);
        
        // Refresh sessions list
        fetchChatSessions();
      } else {
        console.error('❌ [ChatPanel] Failed to create session:', createData.message);
        toast({
          title: "Error creating session",
          description: createData.message || "Failed to create new session",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [ChatPanel] Error creating session:', error);
      toast({
        title: "Error creating session",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      console.log(`💬 [CHAT-PANEL-DEBUG] Loading session: ${sessionId}`);
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSION(sessionId)), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const session = data.data;
        console.log(`💬 [CHAT-PANEL-DEBUG] Session loaded successfully:`, session);
        console.log(`💬 [CHAT-PANEL-DEBUG] Session has ${session.messages?.length || 0} messages`);
        if (session.messages && session.messages.length > 0) {
          session.messages.forEach((msg, index) => {
            console.log(`💬 [CHAT-PANEL-DEBUG] Message ${index + 1}:`, {
              id: msg.id,
              content: msg.content?.substring(0, 50) + '...',
              isUser: msg.isUser,
              sourceCitations: msg.sourceCitations || msg.source_citations
            });
          });
        }
        setCurrentSessionId(session.id);
        
        // Convert backend messages to frontend format
        const sessionMessages: Message[] = session.messages.map((msg: any) => {
          // Parse source citations if they exist
          let sourceCitations = [];
          if (msg.sourceCitations || msg.source_citations) {
            try {
              const citationsData = msg.sourceCitations || msg.source_citations;
              sourceCitations = typeof citationsData === 'string' 
                ? JSON.parse(citationsData) 
                : citationsData;
            } catch (error) {
              console.error('Error parsing source citations:', error);
              sourceCitations = [];
            }
          }
          
          return {
            id: msg.id.toString(),
            content: msg.content,
            isUser: msg.isUser,
            timestamp: new Date(msg.createdAt),
            sourceCitations
          };
        });
        
        setMessages(sessionMessages);
        setShowHistoryDialog(false);
        
        // Refresh sessions list to update last activity
        fetchChatSessions();
      } else {
        console.error(`💬 [CHAT-PANEL-DEBUG] Failed to load session:`, data.message);
        toast({
          title: "Error loading chat session",
          description: data.message || "Failed to load session",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`💬 [CHAT-PANEL-DEBUG] Error loading session:`, error);
      toast({
        title: "Error loading chat session",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const updateSession = async (sessionId: string, updatedMessages: Message[]) => {
    try {
      console.log(`💾 [ChatPanel] Updating session ${sessionId} with ${updatedMessages.length} messages`);
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
        console.log(`✅ [ChatPanel] Session ${sessionId} updated successfully`);
      } else {
        console.error(`❌ [ChatPanel] Failed to update session ${sessionId}:`, data.message);
      }
    } catch (error) {
      console.error(`❌ [ChatPanel] Error updating session ${sessionId}:`, error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSION(sessionId)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setChatSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
          createNewSession();
        }
        toast({
          title: "Session deleted",
          description: "Chat session deleted successfully",
        });
      } else {
        toast({
          title: "Error deleting session",
          description: data.message || "Failed to delete session",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting session",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };



  const sendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    console.log(`💬 [ChatPanel] Sending message. Current session ID: ${currentSessionId}`);
    console.log(`💬 [ChatPanel] Current messages count: ${messages.length}`);

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
    setIsSending(true);

    try {
      const token = localStorage.getItem('authToken');
      // Always use RAG for workspace chat - either file-specific or workspace-wide
      const endpoint = buildApiUrl(API_ENDPOINTS.RAG.MESSAGE);

      const requestBody = {
        messages: [...messages, newMessage],
        workspaceId,
        fileId: fileId || null,
        modelName: selectedModel,
        chatMode: selectedChatMode,
        contextOnly: contextOnly
      };

      console.log('🎯 [ChatPanel] Sending request with chat mode:', selectedChatMode);
      console.log('🎯 [ChatPanel] Request body:', requestBody);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('✅ [ChatPanel] RAG response received:', data);
        console.log('📄 [ChatPanel] Source citations:', data.context?.sourceCitations);
        console.log('🤖 [ChatPanel] AI message content:', data.message);
        console.log('🔍 [ChatPanel] Looking for citation patterns in:', data.message);
        
        // Check if the AI response contains any citation patterns
        const citationPatterns = [
          /\[SOURCE \d+\]/g,
          /\[Source \d+\]/g,
          /SOURCE \d+/g,
          /Source \d+/g
        ];
        
        citationPatterns.forEach((pattern, index) => {
          const matches = data.message.match(pattern);
          console.log(`Pattern ${index + 1} matches:`, matches);
        });
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          sourceCitations: data.context?.sourceCitations || []
        };
        
        console.log('🤖 [ChatPanel] AI message with citations:', aiMessage);
        
        // Update messages state and save to session
        setMessages(prev => {
          const updatedMessages = [...prev, aiMessage];
          
          // If this is the first user message (no session ID yet), create a new session
          if (!currentSessionId) {
            console.log(`🆕 [ChatPanel] First user message - creating new session`);
            createSessionAndSaveMessages(updatedMessages).catch(error => {
              console.error('❌ [ChatPanel] Error creating session:', error);
            });
          } else {
            // Save to existing session
            console.log(`💾 [ChatPanel] Updating session ${currentSessionId} with ${updatedMessages.length} messages`);
            updateSession(currentSessionId, updatedMessages).catch(error => {
              console.error('❌ [ChatPanel] Error saving session:', error);
            });
          }
          
          return updatedMessages;
        });
      } else {
        console.error('❌ [ChatPanel] RAG response error:', data);
        toast({
          title: "Error",
          description: data.message || "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-background border-l border-border shadow-lg flex flex-col h-screen min-w-0">
      {/* Header */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground text-sm truncate">
                {fileId ? 'Document Chat' : 'Workspace Chat'}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {fileId ? 'Ask about this document' : `${workspaceName} • Search all documents`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* New Chat button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                setCurrentSessionId(null);
                createNewSession();
              }}
              className="h-7 px-2 text-xs"
              title="Start a new chat"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Chat
            </Button>
            

            <div className="relative group">
              <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0"
                  >
                    <History className="w-3.5 h-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
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
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                              currentSessionId === session.id ? 'bg-primary/10 border-primary' : 'border-border'
                            }`}
                            onClick={() => loadSession(session.id)}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                  {session.summary && session.summary !== 'null' 
                                    ? (session.summary.length > 30 ? session.summary.substring(0, 30) + '...' : session.summary)
                                    : session.name || 'Unnamed Session'}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground truncate">
                                    {new Date(session.updatedAt).toLocaleDateString()}
                                  </p>
                                  {!session.isStarred && (
                                    <span className="text-xs text-orange-500 truncate">
                                      • Auto-delete in 24h
                                    </span>
                                  )}
                                </div>
                                {session.fileName && (
                                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 w-fit">
                                    {session.fileName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
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
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Mode Selector */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <ChatModeSelector
          selectedMode={selectedChatMode}
          onModeChange={setSelectedChatMode}
        />
      </div>

      {/* Messages - Fixed height container */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full p-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-2.5 rounded-lg ${
                    message.isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.isUser ? (
                    <p className="text-sm text-primary-foreground break-words">{message.content}</p>
                  ) : (
                    <MessageWithSources 
                      message={message} 
                      onSourceClick={handleSourceClick}
                      showFileNames={!fileId} // Show file names only for workspace chat
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
                <div className="max-w-[85%] p-2.5 rounded-lg bg-muted text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <p className="text-sm">
                      {fileId ? 'Analyzing document...' : 'Searching documents...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex-shrink-0">
        {/* Model Selector and Context Toggle */}
        <div className="mb-2 flex justify-end items-center gap-2">
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
        <div className="flex gap-2 min-w-0">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about this workspace..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1 min-h-[40px] max-h-[100px] resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-w-0"
            disabled={isSending}
            rows={1}
            style={{
              height: 'auto',
              overflow: 'hidden'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 100) + 'px';
            }}
          />
          <Button 
            onClick={sendMessage} 
            size="sm" 
            className="px-3 h-[40px] rounded-lg transition-all duration-200 flex-shrink-0"
            disabled={isSending || !inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}