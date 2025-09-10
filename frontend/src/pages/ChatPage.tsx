import { useState, useEffect, useRef } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, MessageCircle, Brain, History, Plus, Edit3, Trash2, Star } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSidebar } from "@/contexts/SidebarContext";
import { ChatModeSelector, ChatMode } from "@/components/ChatModeSelector";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
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
  workspaceName?: string;
  fileName?: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedChatMode, setSelectedChatMode] = useState<ChatMode>("regular");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isCollapsed, toggleCollapse } = useSidebar();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat sessions when component mounts
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Fetch chat sessions when component mounts and when workspaces are loaded
  useEffect(() => {
    fetchChatSessions();
  }, [workspaces]);

  // Handle sessionId, workspaceId, and fileId from URL parameters
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('sessionId');
    const workspaceIdFromUrl = searchParams.get('workspaceId');
    const fileIdFromUrl = searchParams.get('fileId');
    
    console.log(`💬 [CHAT-PAGE-DEBUG] URL parameters:`, {
      sessionIdFromUrl,
      workspaceIdFromUrl,
      fileIdFromUrl,
      currentSessionId,
      searchParams: Object.fromEntries(searchParams.entries())
    });
    
    if (sessionIdFromUrl && !currentSessionId) {
      console.log(`💬 [CHAT-PAGE-DEBUG] Loading session: ${sessionIdFromUrl}`);
      loadSession(sessionIdFromUrl);
    } else if (workspaceIdFromUrl && !currentSessionId) {
      // Set the selected workspace for workspace-specific chat
      console.log(`💬 [CHAT-PAGE-DEBUG] Setting workspace: ${workspaceIdFromUrl}`);
      setSelectedWorkspace(workspaceIdFromUrl);
    } else if (fileIdFromUrl && !currentSessionId) {
      // Set the file context for file-specific chat
      console.log(`💬 [CHAT-PAGE-DEBUG] Setting fileId: ${fileIdFromUrl}`);
      setSelectedFileId(fileIdFromUrl);
    }
  }, [searchParams, currentSessionId]);

  // Create a new chat session when starting fresh
  useEffect(() => {
    if (!currentSessionId && messages.length === 0 && !searchParams.get('sessionId')) {
      createNewSession();
    }
  }, [currentSessionId, searchParams]);

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
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const fetchChatSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const token = localStorage.getItem('authToken');

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Add workspace names and file names to sessions
        const sessionsWithWorkspaceNames = data.data.map((session: any) => {
          let workspaceName = 'General Chat';
          if (session.workspaceId) {
            const workspace = workspaces.find(ws => ws.id === session.workspaceId.toString());
            workspaceName = workspace ? workspace.name : 'General Chat';
          }
          return {
            ...session,
            workspaceName,
            fileName: session.file?.originalName || undefined
          };
        });
        setChatSessions(sessionsWithWorkspaceNames);
      } else {
        toast({
          title: "Error loading chat history",
          description: data.message || "Failed to load chat sessions",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error loading chat history",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const createNewSession = async () => {
    try {
      setIsCreatingSession(true);
      const token = localStorage.getItem('authToken');
      const sessionName = selectedWorkspace ? 
        workspaces.find(ws => ws.id === selectedWorkspace)?.name || 'New Chat' : 
        selectedFileId ? 'File Chat' : 'New Chat';
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName,
          workspaceId: selectedWorkspace || null,
          fileId: selectedFileId || null
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCurrentSessionId(data.data.id);
        
        // Add welcome message
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          content: `Hi! I'm your AI assistant. How can I help you today?`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
        
        // Refresh sessions list
        fetchChatSessions();
      } else {
        toast({
          title: "Error creating chat session",
          description: data.message || "Failed to create new session",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error creating chat session",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSession(false);
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
        setCurrentSessionId(session.id);
        
        // Convert backend messages to frontend format
        const sessionMessages: Message[] = session.messages.map((msg: any) => ({
          id: msg.id.toString(),
          content: msg.content,
          isUser: msg.isUser,
          timestamp: new Date(msg.createdAt)
        }));
        
        setMessages(sessionMessages);
        setShowHistoryDialog(false);
        
        // Refresh sessions list to update last activity
        fetchChatSessions();
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
        
        // Refresh sessions list
        fetchChatSessions();
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

  const updateSessionMessages = async (sessionId: string, messages: Message[]) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.MESSAGES(sessionId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        console.error('Failed to update session messages');
      }
    } catch (error) {
      console.error('Error updating session messages:', error);
    }
  };

  const toggleStarSession = async (sessionId: string, isStarred: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.STAR(sessionId)), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isStarred }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setChatSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, isStarred: isStarred } : s
        ));
        toast({
          title: isStarred ? "Session starred" : "Session unstarred",
          description: isStarred ? "Chat session saved permanently" : "Chat session will be auto-deleted after 24 hours of inactivity",
        });
        
        // Refresh sessions list to ensure consistency
        fetchChatSessions();
      } else {
        toast({
          title: "Error updating session",
          description: data.message || "Failed to update session",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error updating session",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isSending || !currentSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);

    try {
      const token = localStorage.getItem('authToken');
      
      // Use the regular chat sessions endpoint (backend will handle RAG)
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.MESSAGES(currentSessionId)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: inputValue.trim(),
          chatMode: selectedChatMode
        }),
      });

      console.log('🎯 [ChatPage] Sending request with chat mode:', selectedChatMode);

      const data = await response.json();
      
      if (response.ok && data.success) {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: data.data.assistantMessage.content,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiResponse]);
        
        // Refresh sessions list to update timestamps
        fetchChatSessions();
      } else {
        // Handle API error
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message || "Sorry, I encountered an error. Please try again.",
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        
        toast({
          title: "Chat Error",
          description: data.message || "Failed to get AI response",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection Error",
        description: "Failed to connect to AI service",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-1 h-screen">
      <AppSidebar
        workspaces={workspaces.map(ws => ({
          ...ws,
          isActive: selectedWorkspace === ws.id
        }))}
        onWorkspaceSelect={(id) => {
          setSelectedWorkspace(id);
          navigate(`/workspace/${id}`);
        }}
        onCreateWorkspace={async (name) => {
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
            if (response.ok) {
              fetchWorkspaces();
            }
          } catch (error) {
            console.error('Error creating workspace:', error);
          }
        }}
        onDeleteWorkspace={async (id) => {
          try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.UPDATE(id)), {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (response.ok) {
              fetchWorkspaces();
              if (selectedWorkspace === id) {
                setSelectedWorkspace(null);
              }
            }
          } catch (error) {
            console.error('Error deleting workspace:', error);
          }
        }}
        onRenameWorkspace={async (id, newName) => {
          try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.UPDATE(id)), {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ name: newName }),
            });
            if (response.ok) {
              fetchWorkspaces();
            }
          } catch (error) {
            console.error('Error renaming workspace:', error);
          }
        }}
        onHomeSelect={() => navigate('/')}
        isHomeActive={false}
        recentItems={[]}
        starredItems={[]}
        starredChatSessions={[]}
        onRecentItemSelect={(id, type) => {
          if (type === 'workspace') {
            setSelectedWorkspace(id);
            navigate(`/workspace/${id}`);
          }
        }}
        onStarredItemSelect={(id, type) => {
          if (type === 'workspace') {
            setSelectedWorkspace(id);
            navigate(`/workspace/${id}`);
          }
        }}
        onStarredChatSessionSelect={() => {}}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <div className="flex flex-col bg-background transition-all duration-300 flex-1">
        {/* Header */}
        <div className="border-b border-border bg-surface/50 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <MessageCircle className="w-6 h-6" />
                    AI Chat
                  </h1>
                  <p className="text-muted-foreground">
                    Have a conversation with your AI assistant
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentSessionId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const currentSession = chatSessions.find(s => s.id === currentSessionId);
                      if (currentSession) {
                        toggleStarSession(currentSessionId, !currentSession.isStarred);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Star className={`w-4 h-4 ${currentSessionId && chatSessions.find(s => s.id === currentSessionId)?.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                  </Button>
                )}
                <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <History className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Chat History</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {isLoadingSessions ? (
                        <div className="text-center py-4">Loading...</div>
                      ) : chatSessions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No chat history yet
                        </div>
                      ) : (
                        chatSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => loadSession(session.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate mb-1">
                                {session.summary || session.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {session.fileName && (
                                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                                    {session.fileName}
                                  </span>
                                )}
                                {session.workspaceName && session.workspaceName !== 'General Chat' && (
                                  <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                                    {session.workspaceName}
                                  </span>
                                )}
                                {(session.fileName || (session.workspaceName && session.workspaceName !== 'General Chat')) && (
                                  <span>•</span>
                                )}
                                <span>{new Date(session.lastActivityAt || session.updatedAt).toLocaleDateString()}</span>
                                {session.isStarred && (
                                  <>
                                    <span>•</span>
                                    <span className="text-yellow-600">Starred</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStarSession(session.id, !session.isStarred);
                                }}
                              >
                                <Star className={`w-4 h-4 ${session.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSession(session.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Mode Selector */}
        <div className="px-8 py-4 border-b border-border">
          <ChatModeSelector
            selectedMode={selectedChatMode}
            onModeChange={setSelectedChatMode}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-[calc(100vh-120px)]">
          {/* Messages */}
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-4 ${
                      message.isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border p-6 bg-background">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="h-12"
                    disabled={isSending}
                  />
                </div>
                                <Button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isSending}
                  className="h-12 px-6"
                >
                  {isSending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 