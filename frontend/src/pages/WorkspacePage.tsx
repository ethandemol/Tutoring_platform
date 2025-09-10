import { useState, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MainContent } from "@/components/MainContent";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/SidebarContext";
import { ChatPanel } from "@/components/ChatPanel";
import { SimplifiedVoiceCallPanel } from "@/components/SimplifiedVoiceCallPanel";
import { ThemeProvider } from "@/components/ThemeProvider";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  settings?: {
    themeId?: string;
  };
}

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isHomeActive, setIsHomeActive] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState('navy');
  const { toast } = useToast();
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
          const workspacesData = data.data.map((ws: any) => ({
            id: ws.id.toString(),
            name: ws.name,
            description: ws.description || null,
            isActive: ws.id.toString() === workspaceId,
            settings: ws.settings || {},
          }));
          setWorkspaces(workspacesData);
          
          // Find the current workspace
          const current = workspacesData.find(ws => ws.id === workspaceId);
          if (current) {
            setCurrentWorkspace(current);
            // Set the theme from workspace settings
            const themeId = current.settings?.themeId || 'navy';
            setCurrentThemeId(themeId);
          } else {
            // Workspace not found, redirect to home
            navigate('/');
            toast({
              title: "Workspace not found",
              description: "The requested workspace could not be found",
              variant: "destructive",
            });
          }
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
  }, [workspaceId, navigate, toast]);

  // Handle chat parameter and sessionId from URL
  useEffect(() => {
    const shouldOpenChat = searchParams.get('chat') === 'true';
    const sessionId = searchParams.get('sessionId');
    
    console.log(`🏢 [WORKSPACE-PAGE-DEBUG] URL parameters:`, {
      shouldOpenChat,
      sessionId,
      workspaceId,
      searchParams: Object.fromEntries(searchParams.entries())
    });
    
    if (shouldOpenChat && workspaceId) {
      // Open chat panel within workspace page
      console.log(`🏢 [WORKSPACE-PAGE-DEBUG] Opening chat panel within workspace`);
      setIsChatOpen(true);
      if (sessionId) {
        console.log(`🏢 [WORKSPACE-PAGE-DEBUG] Setting sessionId: ${sessionId}`);
        setCurrentSessionId(sessionId);
      }
    }
  }, [searchParams, workspaceId]);

  const handleWorkspaceSelect = (id: string) => {
    navigate(`/workspace/${id}`);
  };

  const handleHomeSelect = () => {
    navigate('/');
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
          description: data.data.description || null,
          isActive: false,
        };
        setWorkspaces([...workspaces, newWorkspace]);
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

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.UPDATE(workspaceId)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWorkspaces(workspaces.filter(ws => ws.id !== workspaceId));
        if (currentWorkspace?.id === workspaceId) {
          navigate('/');
        }
        toast({
          title: "Workspace deleted",
          description: "Workspace has been deleted successfully",
        });
      } else {
        toast({
          title: "Error deleting workspace",
          description: data.message || "Failed to delete workspace",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting workspace",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleRenameWorkspace = async (workspaceId: string, newName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.UPDATE(workspaceId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setWorkspaces(workspaces.map(ws => 
          ws.id === workspaceId ? { ...ws, name: newName } : ws
        ));
        if (currentWorkspace?.id === workspaceId) {
          setCurrentWorkspace({ ...currentWorkspace, name: newName });
        }
        toast({
          title: "Workspace renamed",
          description: "Workspace has been renamed successfully",
        });
      } else {
        toast({
          title: "Error renaming workspace",
          description: data.message || "Failed to rename workspace",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error renaming workspace",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDescriptionUpdate = (description: string) => {
    if (currentWorkspace) {
      setCurrentWorkspace({ ...currentWorkspace, description });
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }



  return (
    <ThemeProvider 
      themeId={currentThemeId} 
      onThemeChange={setCurrentThemeId}
    >
      <div className="flex flex-1 h-screen">
        <AppSidebar
          workspaces={workspaces}
          onWorkspaceSelect={handleWorkspaceSelect}
          onCreateWorkspace={handleCreateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          onRenameWorkspace={handleRenameWorkspace}
          onHomeSelect={handleHomeSelect}
          isHomeActive={isHomeActive}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
        
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Main Content Panel */}
          <ResizablePanel defaultSize={(isChatOpen || isCallOpen) ? 70 : 100} minSize={30}>
            <MainContent
              activeWorkspace={workspaceId || null}
              workspaceName={currentWorkspace.name}
              workspaceDescription={currentWorkspace.description}
              onDescriptionUpdate={handleDescriptionUpdate}
              onChatClick={() => {
                setIsCallOpen(false);
                setIsChatOpen(!isChatOpen);
              }}
              isChatOpen={isChatOpen}
              onCallClick={() => {
                setIsChatOpen(false);
                setIsCallOpen(!isCallOpen);
              }}
              isCallOpen={isCallOpen}
              isGenerating={isGenerating}
              onGeneratingChange={setIsGenerating}
              currentThemeId={currentWorkspace.settings?.themeId || 'navy'}
            />
          </ResizablePanel>

          {/* Chat Panel */}
          {isChatOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={45} minSize={30} maxSize={65}>
                <ChatPanel
                  isOpen={isChatOpen}
                  onClose={() => {
                    setIsChatOpen(false);
                    setCurrentSessionId(null);
                  }}
                  workspaceName={currentWorkspace.name}
                  workspaceId={workspaceId || null}
                  fileId={null}
                  initialSessionId={currentSessionId}
                />
              </ResizablePanel>
            </>
          )}

          {/* Voice Call Panel */}
          {isCallOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={45} minSize={30} maxSize={65}>
                <SimplifiedVoiceCallPanel
                  isOpen={isCallOpen}
                  onClose={() => {
                    setIsCallOpen(false);
                  }}
                  workspaceId={workspaceId || null}
                  workspaceName={currentWorkspace.name}
                />
              </ResizablePanel>
            </>
          )}

        </ResizablePanelGroup>
      </div>
    </ThemeProvider>
  );
};

export default WorkspacePage; 