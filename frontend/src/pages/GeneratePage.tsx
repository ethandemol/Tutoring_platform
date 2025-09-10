import { useState, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, FileText, BookOpen, Lightbulb, Target, Calendar, Clock, Download, Plus, CheckCircle, Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSidebar } from "@/contexts/SidebarContext";
import { FileSelectionDialog } from "@/components/FileSelectionDialog";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface GeneratedContent {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
  workspaceId: string;
  workspaceName: string;
}

const GeneratePage = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [generationType, setGenerationType] = useState<string>("exam");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isFileSelectionOpen, setIsFileSelectionOpen] = useState(false);
  const { toast } = useToast();
  const { isCollapsed, toggleCollapse } = useSidebar();

  const generationTypes = [
    {
      value: "exam",
      label: "Exam Questions",
      description: "Create comprehensive exam questions",
      icon: FileText,
    },
    {
      value: "quiz",
      label: "Quiz",
      description: "Quick quiz questions for review",
      icon: CheckCircle,
    },
    {
      value: "flashcards",
      label: "Flashcards",
      description: "Create study flashcards",
      icon: BookOpen,
    },
    {
      value: "cheat_sheet",
      label: "Cheat Sheet",
      description: "Generate a concise reference guide",
      icon: Lightbulb,
    },
    {
      value: "study_guide",
      label: "Study Guide",
      description: "Comprehensive study material",
      icon: BookOpen,
    },
    {
      value: "notes",
      label: "Notes",
      description: "Organized study notes",
      icon: FileText,
    },
  ];

  useEffect(() => {
    fetchWorkspaces();
    fetchGeneratedContent();
  }, [selectedWorkspace]);

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

  const fetchGeneratedContent = async () => {
    if (!selectedWorkspace) return;
    
    setIsLoadingContent(true);
    try {
      const token = localStorage.getItem('authToken');
      // Fetch all files and filter for generated content
      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.WORKSPACE(selectedWorkspace)), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const generatedFiles = data.data.filter((file: any) => file.metadata?.type === 'generated');
        setGeneratedContent(generatedFiles.map((file: any) => ({
          id: file.id,
          title: file.originalName,
          type: file.metadata?.generationType || 'unknown',
          content: file.metadata?.content || '',
          createdAt: file.createdAt,
          workspaceId: file.workspaceId.toString(),
          workspaceName: file.workspaceName || 'Unknown Workspace',
        })));
      }
    } catch (error) {
      toast({
        title: "Error loading generated content",
        description: "Failed to load generated content",
        variant: "destructive",
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedWorkspace) {
      toast({
        title: "Missing information",
        description: "Please select a workspace",
        variant: "destructive",
      });
      return;
    }

    // Open file selection dialog
    setIsFileSelectionOpen(true);
  };

  // Handle file selection confirmation
  const handleFileSelectionConfirm = async (selectedFileIds: string[]) => {
    if (!selectedWorkspace) return;

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GENERATE.CONTENT), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: generationType,
          workspaceId: selectedWorkspace,
          fileIds: selectedFileIds,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({
          title: "Content generated successfully",
          description: "Your content has been created and saved to your workspace",
        });
        
        // Refresh generated content
        fetchGeneratedContent();
      } else {
        toast({
          title: "Generation failed",
          description: data.message || "Failed to generate content",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = generationTypes.find(t => t.value === type);
    return typeConfig?.icon || FileText;
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = generationTypes.find(t => t.value === type);
    return typeConfig?.label || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="flex flex-1 h-screen">
      <AppSidebar
        workspaces={workspaces}
        onWorkspaceSelect={(id) => setSelectedWorkspace(id)}
        onCreateWorkspace={() => {}}
        onDeleteWorkspace={() => {}}
        onRenameWorkspace={() => {}}
        onHomeSelect={() => navigate('/')}
        isHomeActive={false}
        recentItems={[]}
        starredItems={[]}
        starredChatSessions={[]}
        onRecentItemSelect={() => {}}
        onStarredItemSelect={() => {}}
        onStarredChatSessionSelect={() => {}}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <div className="flex flex-col bg-background transition-all duration-300 flex-1">
        {/* Header */}
        <div className="border-b border-border bg-surface/50 backdrop-blur-sm">
          <div className="px-8 py-6">
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
                  <Brain className="w-6 h-6" />
                  Generate Content
                </h1>
                <p className="text-muted-foreground">
                  Create educational content with AI assistance
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 space-y-8 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Generation Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Generate New Content
                  </CardTitle>
                  <CardDescription>
                    Choose a type to generate educational content based on your workspace files
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Workspace Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="workspace">Workspace</Label>
                    <Select value={selectedWorkspace || ""} onValueChange={setSelectedWorkspace}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Generation Type */}
                  <div className="space-y-2">
                    <Label htmlFor="type">Content Type</Label>
                    <Select value={generationType} onValueChange={setGenerationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {generationTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="w-4 h-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Generate Button */}
                  <Button
                    onClick={handleGenerate}
                    disabled={!selectedWorkspace || isGenerating}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4 mr-2" />
                        Generate Content
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Generated Content History */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Generated Content
                  </CardTitle>
                  <CardDescription>
                    Your previously generated content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingContent ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : generatedContent.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No generated content yet</p>
                      <p className="text-sm">Generate your first piece of content to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {generatedContent.map((content) => {
                        const IconComponent = getTypeIcon(content.type);
                        return (
                          <div
                            key={content.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate(`/file/${content.id}`)}
                          >
                            <div className="flex-shrink-0">
                              <IconComponent className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {content.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{getTypeLabel(content.type)}</span>
                                <span>•</span>
                                <span>{content.workspaceName}</span>
                                <span>•</span>
                                <span>{formatDate(content.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Generation Types Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Available Content Types</CardTitle>
              <CardDescription>
                Choose from various types of educational content you can generate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generationTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <div
                      key={type.value}
                      className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => setGenerationType(type.value)}
                    >
                      <div className="flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{type.label}</h4>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* File Selection Dialog */}
      <FileSelectionDialog
        isOpen={isFileSelectionOpen}
        onClose={() => setIsFileSelectionOpen(false)}
        workspaceId={selectedWorkspace || ''}
        generationType={generationType}
        onConfirm={handleFileSelectionConfirm}
      />
    </div>
  );
};

export default GeneratePage; 