import { useState } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitFeedback } from "@/api/feedback";

interface FeedbackDialogProps {
  isCollapsed?: boolean;
}

export function FeedbackDialog({ isCollapsed = false }: FeedbackDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast({
        title: "Feedback required",
        description: "Please provide your feedback before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!feedbackType) {
      toast({
        title: "Feedback type required",
        description: "Please select a feedback type before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Call the real API
      await submitFeedback({
        feedbackType,
        feedback: feedback.trim(),
      });
      
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We appreciate your input.",
      });
      
      setFeedback("");
      setFeedbackType("");
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground min-w-0"
        >
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="truncate">Feedback</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Share Your Feedback
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="feedback-type">What type of feedback is this?</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature Add On</SelectItem>
                <SelectItem value="layout">Layout Change</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="feedback">Your feedback</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think about Sparqit..."
              className="min-h-[120px] resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!feedback.trim() || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 