import { useState } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Globe, Youtube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UrlPasteDialogProps {
  workspaceId?: string;
  workspaceName?: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function UrlPasteDialog({ workspaceId, workspaceName, onSuccess, trigger }: UrlPasteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("url");
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [isProcessingText, setIsProcessingText] = useState(false);
  const [urlProcessingProgress, setUrlProcessingProgress] = useState(0);
  const [urlType, setUrlType] = useState<'youtube' | 'website' | null>(null);
  const { toast } = useToast();

  const handleUrlInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setPasteUrl(url);
    
    // Detect URL type
    if (url) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
      if (youtubeRegex.test(url)) {
        setUrlType('youtube');
      } else if (url.match(/^https?:\/\//)) {
        setUrlType('website');
      } else {
        setUrlType(null);
      }
    } else {
      setUrlType(null);
    }
  };

  const handleUrlPaste = async () => {
    if (!pasteUrl.trim() || !workspaceId) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL and ensure you're in a workspace.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    try {
      new URL(pasteUrl);
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL format (e.g., https://example.com)",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingUrl(true);
    setUrlProcessingProgress(0);

    try {
      const token = localStorage.getItem('authToken');
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUrlProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.URLS.PROCESS(workspaceId)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: pasteUrl.trim() }),
      });

      clearInterval(progressInterval);
      setUrlProcessingProgress(100);

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "URL processed successfully!",
          description: `${data.data.urlContent.title} has been added to ${workspaceName || 'your workspace'}`,
        });
        
        setPasteUrl("");
        setIsOpen(false);
        setUrlProcessingProgress(0);
        setUrlType(null);
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Processing failed",
          description: data.message || "An error occurred while processing the URL.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "Network error occurred while processing the URL.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingUrl(false);
      setUrlProcessingProgress(0);
    }
  };

  const handleTextPaste = async () => {
    if (!pasteText.trim() || !workspaceId) {
      toast({
        title: "Invalid text",
        description: "Please enter some text and ensure you're in a workspace.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingText(true);

    try {
      const token = localStorage.getItem('authToken');
      
      // Create a text file with the content
      const fileName = `${Date.now()}_pasted_text.txt`;
      const fileContent = pasteText;
      const buffer = Buffer.from(fileContent, 'utf8');
      
      // Create a FormData object for file upload
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: 'text/plain' }), fileName);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.FILES.UPLOAD(workspaceId)), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Text saved successfully!",
          description: `Your text has been saved to ${workspaceName || 'your workspace'}`,
        });
        
        setPasteText("");
        setIsOpen(false);
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Save failed",
          description: data.message || "An error occurred while saving the text.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Network error occurred while saving the text.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingText(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPasteUrl(text);
        // Trigger URL type detection
        handleUrlInput({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>);
      }
    } catch (error) {
      toast({
        title: "Clipboard access denied",
        description: "Please paste the URL manually.",
        variant: "destructive",
      });
    }
  };

  const handlePasteTextFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPasteText(text);
      }
    } catch (error) {
      toast({
        title: "Clipboard access denied",
        description: "Please paste the text manually.",
        variant: "destructive",
      });
    }
  };

  const defaultTrigger = (
    <div className="group cursor-pointer">
      <div className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
          <Link2 className="w-6 h-6 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">Paste</h3>
        <p className="text-sm text-muted-foreground">YouTube, website, text</p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paste URL or Content</DialogTitle>
          <DialogDescription>
            Paste a YouTube video URL, website URL, or plain text to save to your workspace
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
          </TabsList>
          
          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-input">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  value={pasteUrl}
                  onChange={handleUrlInput}
                  placeholder="https://youtube.com/watch?v=... or https://example.com"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasteFromClipboard}
                  disabled={isProcessingUrl}
                >
                  Paste
                </Button>
              </div>
              {urlType && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {urlType === 'youtube' ? (
                    <>
                      <Youtube className="w-4 h-4 text-red-500" />
                      YouTube Video
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 text-blue-500" />
                      Website
                    </>
                  )}
                </div>
              )}
            </div>
            
            {isProcessingUrl && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing {urlType === 'youtube' ? 'YouTube video' : 'website'}...</span>
                  <span>{urlProcessingProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${urlProcessingProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setPasteUrl("");
                  setUrlProcessingProgress(0);
                  setUrlType(null);
                }}
                disabled={isProcessingUrl}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUrlPaste}
                disabled={!pasteUrl.trim() || isProcessingUrl}
              >
                {isProcessingUrl ? "Processing..." : "Process URL"}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-input">Text Content</Label>
              <div className="flex gap-2">
                <Textarea
                  id="text-input"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste or type your text content here..."
                  className="flex-1 min-h-[120px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasteTextFromClipboard}
                  disabled={isProcessingText}
                >
                  Paste
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setPasteText("");
                }}
                disabled={isProcessingText}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTextPaste}
                disabled={!pasteText.trim() || isProcessingText}
              >
                {isProcessingText ? "Saving..." : "Save Text"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 