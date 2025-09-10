import { useState } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Plus, BookOpen, History, HelpCircle, Star, Send, Upload, Link2, LogOut, User, Trash2, MoreVertical, Edit3, MessageCircle, Video, Brain, ChevronDown, PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getWorkspaceEmoji } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackDialog } from "./FeedbackDialog";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface AppSidebarProps {
  workspaces: Workspace[];
  onWorkspaceSelect: (id: string) => void;
  onCreateWorkspace?: (name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, newName: string) => void;
  onHomeSelect: () => void;
  isHomeActive: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({ 
  workspaces, 
  onWorkspaceSelect, 
  onCreateWorkspace, 
  onDeleteWorkspace, 
  onRenameWorkspace, 
  onHomeSelect, 
  isHomeActive, 
  isCollapsed = false,
  onToggleCollapse
}: AppSidebarProps) {
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
  const [newWorkspaceNameForRename, setNewWorkspaceNameForRename] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isWorkspacesExpanded, setIsWorkspacesExpanded] = useState(true);
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleCreateWorkspace = () => {
    if (newWorkspaceName.trim() && onCreateWorkspace) {
      onCreateWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName("");
      setIsCreateDialogOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    try {
      setIsDeleting(true);
      await onDeleteWorkspace(workspace.id);
      setWorkspaceToDelete(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete workspace",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameWorkspace = async (workspace: Workspace) => {
    try {
      setIsRenaming(true);
      await onRenameWorkspace(workspace.id, newWorkspaceNameForRename.trim());
      setWorkspaceToRename(null);
      setNewWorkspaceNameForRename("");
    } catch (error) {
      toast({
        title: "Rename failed",
        description: "Failed to rename workspace",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const TooltipWrapper = ({ children, content }: { children: React.ReactNode; content: string }) => {
    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {children}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              {content}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <>{children}</>;
  };

  return (
    <div 
      className={`h-screen bg-surface border-r border-border flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-60'}`}
      style={{ width: isCollapsed ? '4rem' : '15rem', minWidth: isCollapsed ? '4rem' : '15rem', maxWidth: isCollapsed ? '4rem' : '15rem' }}
    >
      {/* Header */}
      <div className="p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          {isCollapsed ? (
            <div className="flex flex-col items-center justify-center w-full space-y-4">
              <button
                onClick={onHomeSelect}
                className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <Star className="w-4 h-4 text-primary-foreground" />
              </button>
              <button
                onClick={onToggleCollapse}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-foreground" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onHomeSelect}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <Star className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-semibold text-foreground">Sparqit</h1>
              </button>
              {onToggleCollapse && (
                <TooltipWrapper content="Collapse sidebar">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleCollapse}
                    className="h-8 w-8 p-0 hover:bg-surface-hover"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </Button>
                </TooltipWrapper>
              )}
            </>
          )}
        </div>
      </div>



      {/* Scrollable Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Workspaces Section */}
        <div className="p-4 min-w-0">
          <div className="space-y-1 min-w-0">
            {!isCollapsed && (
              <div className="flex items-center justify-between mb-2 min-w-0">
                <button
                  onClick={() => setIsWorkspacesExpanded(!isWorkspacesExpanded)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0"
                >
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform flex-shrink-0 ${isWorkspacesExpanded ? 'rotate-0' : '-rotate-90'}`} 
                  />
                  <span className="truncate">Workspaces</span>
                </button>
                {onCreateWorkspace && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="h-6 w-6 p-0 hover:bg-surface-hover"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            {isWorkspacesExpanded && (
              <div className="space-y-1">
                {workspaces.map((workspace) => (
                  <TooltipWrapper key={workspace.id} content={workspace.name}>
                    <div
                      className={`w-full px-3 py-2 rounded-lg transition-quick group ${
                        workspace.isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onWorkspaceSelect(workspace.id)}
                          className="flex items-center gap-2 flex-1 text-left overflow-hidden"
                        >
                          <span className="text-lg flex-shrink-0">{getWorkspaceEmoji(workspace)}</span>
                          {!isCollapsed && <span className="text-sm font-medium truncate overflow-hidden">{workspace.name}</span>}
                        </button>
                        {!isCollapsed && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setWorkspaceToRename(workspace)}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setWorkspaceToDelete(workspace)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </TooltipWrapper>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-border space-y-1 flex-shrink-0 min-w-0">
        <FeedbackDialog isCollapsed={isCollapsed} />
        <TooltipWrapper content="Help & Tools">
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground min-w-0">
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Help & Tools</span>}
          </Button>
        </TooltipWrapper>
        
        {/* User Profile Section */}
        <div className="pt-4 border-t border-border mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                              <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-2 text-foreground hover:text-foreground min-w-0"
                >
                <Avatar className="w-6 h-6 flex-shrink-0">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && <span className="text-sm font-medium truncate">{user?.name || 'User'}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || 'Unknown User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email || 'No email'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!workspaceToDelete} onOpenChange={() => setWorkspaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workspaceToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => workspaceToDelete && handleDeleteWorkspace(workspaceToDelete)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Workspace Dialog */}
      <Dialog open={!!workspaceToRename} onOpenChange={() => setWorkspaceToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rename-workspace-name">Workspace Name</Label>
              <Input
                id="rename-workspace-name"
                value={newWorkspaceNameForRename}
                onChange={(e) => setNewWorkspaceNameForRename(e.target.value)}
                placeholder="Enter new workspace name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    workspaceToRename && handleRenameWorkspace(workspaceToRename);
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWorkspaceToRename(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => workspaceToRename && handleRenameWorkspace(workspaceToRename)} 
                disabled={!newWorkspaceNameForRename.trim() || isRenaming}
              >
                {isRenaming ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}