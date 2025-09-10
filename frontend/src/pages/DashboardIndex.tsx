import { useState, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { AppSidebar } from "@/components/AppSidebar";
import { TodoList } from "@/components/TodoList";
import { Planner } from "@/components/Planner";
import { Star, Send, Upload, Link2, Zap, BookOpen, Brain, MessageCircle, FolderOpen, X, Plus, PenTool, Video, ClipboardList, Activity, Calendar, CheckSquare, Square, Pencil, Edit3, FileText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getWorkspaceEmoji } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  workspaceId: string;
  workspaceName: string;
}

interface FileItem {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  s3Url: string;
  workspaceId: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  workspaceName: string;
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



const DashboardIndex = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [allTodos, setAllTodos] = useState<TodoItem[]>([]);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [recentChatSessions, setRecentChatSessions] = useState<ChatSession[]>([]);


  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [scheduledItems, setScheduledItems] = useState<any[]>([]);
  const { toast } = useToast();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const { user } = useAuth();

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

  // Fetch all todos across workspaces
  useEffect(() => {
    const fetchAllTodos = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const allTodosData: TodoItem[] = [];
        
        for (const workspace of workspaces) {
          const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.LIST(workspace.id)), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (response.ok && data.success) {
            const todosWithWorkspace = data.data.map((todo: any) => ({
              ...todo,
              workspaceId: workspace.id,
              workspaceName: workspace.name,
            }));
            allTodosData.push(...todosWithWorkspace);
          }
        }
        
        setAllTodos(allTodosData);
      } catch (error) {
        console.error('Error fetching todos:', error);
      }
    };

    if (workspaces.length > 0) {
      fetchAllTodos();
    }
  }, [workspaces]);

  // Fetch all files across workspaces
  useEffect(() => {
    const fetchAllFiles = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const allFilesData: FileItem[] = [];
        
        for (const workspace of workspaces) {
          const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.FILES(workspace.id)), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (response.ok && data.success) {
            // Filter out file-specific generated files from the dashboard view (keep workspace-generated files)
            const nonGeneratedFiles = data.data.filter((file: any) => 
              file.metadata?.type !== 'generated' || !file.metadata?.sourceFileId
            );
            const filesWithWorkspace = nonGeneratedFiles.map((file: any) => ({
              ...file,
              workspaceName: workspace.name,
            }));
            allFilesData.push(...filesWithWorkspace);
          }
        }
        
        setAllFiles(allFilesData);
      } catch (error) {
        console.error('Error fetching files:', error);
      }
    };

    if (workspaces.length > 0) {
      fetchAllFiles();
    }
  }, [workspaces]);

  // Fetch recent chat sessions from all workspaces
  useEffect(() => {
    const fetchRecentChatSessions = async () => {
      console.log(`🔍 [DASHBOARD-DEBUG] Fetching recent chat sessions`);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.RECENT_SESSIONS + '?limit=10'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok && data.success) {
          console.log(`✅ [DASHBOARD-DEBUG] Received ${data.data.length} chat sessions:`, data.data);
          setRecentChatSessions(data.data);
        } else {
          console.error('Error fetching recent chat sessions:', data.message);
        }
      } catch (error) {
        console.error('Error fetching recent chat sessions:', error);
      }
    };

                

            fetchRecentChatSessions();
            
          }, []);

  const handleWorkspaceSelect = (id: string) => {
    navigate(`/workspace/${id}`);
  };

  const handleHomeSelect = () => {
    // Already on dashboard
  };

  const handleScheduleItem = (item: any) => {
    setScheduledItems(prev => [...prev, item]);
    toast({
      title: "Item scheduled",
      description: `${item.title} has been scheduled for ${item.timeSlot} on ${item.date}`,
    });
  };

  const handleRemoveScheduledItem = (itemId: string) => {
    setScheduledItems(prev => prev.filter(item => item.id !== itemId));
    toast({
      title: "Item removed",
      description: "Item has been removed from the schedule",
    });
  };

  // Create workspace via backend
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
          description: data.data.description || null,
          isActive: false,
        };
        setWorkspaces([...workspaces, newWorkspace]);
        setNewWorkspaceName("");
        setShowAddWorkspace(false);
        toast({
          title: "Workspace created",
          description: `Workspace "${name}" has been created successfully!`,
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

  const handleAddTodo = async (todo: { text: string; dueDate?: string; workspaceId?: string }) => {
    if (!todo.workspaceId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.CREATE(todo.workspaceId)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: todo.text,
          dueDate: todo.dueDate || null,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const newTodo: TodoItem = {
          ...data.data,
          workspaceId: todo.workspaceId,
          workspaceName: workspaces.find(w => w.id === todo.workspaceId)?.name || '',
        };
        setAllTodos([newTodo, ...allTodos]);
        toast({
          title: "Todo added",
          description: "Todo has been added successfully!",
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
      const todo = allTodos.find(t => t.id === todoId);
      if (!todo) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.TOGGLE(todo.workspaceId, todoId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAllTodos(allTodos.map(t => 
          t.id === todoId ? { ...t, completed: !t.completed } : t
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

  const handleDeleteTodo = async (todoId: string) => {
    try {
      const todo = allTodos.find(t => t.id === todoId);
      if (!todo) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.DELETE(todo.workspaceId, todoId)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAllTodos(allTodos.filter(t => t.id !== todoId));
        toast({
          title: "Todo deleted",
          description: "Todo has been deleted successfully!",
        });
      } else {
        toast({
          title: "Error deleting todo",
          description: data.message || "Failed to delete todo",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting todo",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTodo = async (todoId: string, updates: { text?: string; dueDate?: string }) => {
    try {
      const todo = allTodos.find(t => t.id === todoId);
      if (!todo) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TODOS.UPDATE(todo.workspaceId, todoId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAllTodos(allTodos.map(t => 
          t.id === todoId ? { ...t, ...updates } : t
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

  const getDueDateText = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `overdue by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return "due today";
    } else if (diffDays === 1) {
      return "due tomorrow";
    } else {
      return `due in ${diffDays} days`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFileIcon = (file: FileItem) => {
    const fileName = file.originalName.toLowerCase();
    if (fileName.includes('.pdf')) {
      return <FileText className="w-4 h-4 text-red-500" />;
    } else if (fileName.includes('.doc') || fileName.includes('.docx')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    } else if (fileName.includes('.txt')) {
      return <FileText className="w-4 h-4 text-gray-500" />;
    } else if (fileName.includes('.jpg') || fileName.includes('.jpeg') || fileName.includes('.png')) {
      return <FileText className="w-4 h-4 text-green-500" />;
    } else {
      return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const incompleteTodos = allTodos.filter(t => !t.completed);
  const completedTodos = allTodos.filter(t => t.completed);
  const recentFiles = allFiles
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);



  return (
    <div className="flex flex-1 h-screen">
      <AppSidebar
        workspaces={workspaces}
        onWorkspaceSelect={handleWorkspaceSelect}
        onCreateWorkspace={handleCreateWorkspace}
        onDeleteWorkspace={() => {}}
        onRenameWorkspace={() => {}}
        onHomeSelect={handleHomeSelect}
        isHomeActive={true}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <div className="flex flex-col bg-background transition-all duration-300 flex-1">
        {/* Header */}
        <div className="bg-surface/50 backdrop-blur-sm">
          <div className="px-8 pt-12 pb-8 pl-12">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-4xl font-display text-foreground text-balance">
                Welcome to Sparqit{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </h1>
              <div className="text-4xl animate-pulse">✨</div>
            </div>
            <p className="text-lg text-muted-foreground text-pretty">
              Study less. Learn more. Enjoy the ride.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 space-y-6 overflow-y-auto">
          {/* Top Row - Todo List and Workspaces */}
          <div className="flex flex-col lg:flex-row gap-6 -mt-6">
            {/* Todo List Section */}
            <div className="w-full lg:w-1/2 bg-card border border-border rounded-lg p-6">
              <TodoList
                todos={allTodos}
                onToggleTodo={handleToggleTodo}
                onDeleteTodo={handleDeleteTodo}
                onUpdateTodo={handleUpdateTodo}
                onAddTodo={handleAddTodo}
                showWorkspaceInfo={true}
                workspaces={workspaces}
                isDashboard={true}
              />
            </div>
            
            {/* Workspaces Section */}
            <div className="w-full lg:w-1/2 bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-display text-foreground flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Your Workspaces
              </h3>
                <Button
                  onClick={() => setShowAddWorkspace(true)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Workspace
                </Button>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workspaces.map((workspace) => {
                    const handleDragStart = (e: React.DragEvent) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'workspace',
                        item: workspace
                      }));
                      e.dataTransfer.effectAllowed = 'move';
                    };

                    return (
                      <div
                        key={workspace.id}
                        className="border border-border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleWorkspaceSelect(workspace.id)}
                        draggable
                        onDragStart={handleDragStart}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-2xl">{getWorkspaceEmoji(workspace)}</div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display font-semibold text-foreground truncate">
                              {workspace.name}
                            </h4>
                            {workspace.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {workspace.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {allTodos.filter(t => t.workspaceId === workspace.id && !t.completed).length} active todos
                          </span>
                          <span>
                            {allFiles.filter(f => f.workspaceId.toString() === workspace.id).length} files
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Planner */}
          <div className="bg-card border border-border rounded-lg p-6">
            <Planner
              todos={allTodos}
              workspaces={workspaces}
              onScheduleItem={handleScheduleItem}
              onRemoveScheduledItem={handleRemoveScheduledItem}
              userId={user?.id}
            />
          </div>
        </div>



        {/* Add Workspace Dialog */}
        <Dialog open={showAddWorkspace} onOpenChange={setShowAddWorkspace}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newWorkspaceName.trim()) {
                      handleCreateWorkspace(newWorkspaceName.trim());
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddWorkspace(false);
                    setNewWorkspaceName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCreateWorkspace(newWorkspaceName.trim())}
                  disabled={!newWorkspaceName.trim() || isCreatingWorkspace}
                >
                  {isCreatingWorkspace ? "Creating..." : "Create Workspace"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DashboardIndex; 