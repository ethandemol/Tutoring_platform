import React, { useState } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';

interface ExamConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ExamConfig) => void;
  isGenerating?: boolean;
}

export interface ExamConfig {
  numMultipleChoice: number;
  numShortAnswer: number;
  numEssay: number;
  totalPoints: number;
}

export const ExamConfigDialog: React.FC<ExamConfigDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isGenerating = false
}) => {
  const [config, setConfig] = useState<ExamConfig>({
    numMultipleChoice: 5,
    numShortAnswer: 3,
    numEssay: 2,
    totalPoints: 100
  });

  const handleConfirm = () => {
    if (config.numMultipleChoice >= 0 && config.numShortAnswer >= 0 && config.numEssay >= 0 && config.totalPoints > 0) {
      onConfirm(config);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Exam</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Multiple Choice Questions */}
          <div className="space-y-2">
            <Label htmlFor="num-multiple-choice" className="text-sm font-medium">
              Multiple Choice Questions <span className="text-red-500">*</span>
            </Label>
            <Input
              id="num-multiple-choice"
              type="number"
              min="0"
              max="20"
              value={config.numMultipleChoice}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                numMultipleChoice: parseInt(e.target.value) || 0 
              }))}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 5"
            />
            <p className="text-xs text-muted-foreground">
              Number of multiple choice questions (A, B, C, D options)
            </p>
          </div>

          {/* Short Answer Questions */}
          <div className="space-y-2">
            <Label htmlFor="num-short-answer" className="text-sm font-medium">
              Short Answer Questions <span className="text-red-500">*</span>
            </Label>
            <Input
              id="num-short-answer"
              type="number"
              min="0"
              max="10"
              value={config.numShortAnswer}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                numShortAnswer: parseInt(e.target.value) || 0 
              }))}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 3"
            />
            <p className="text-xs text-muted-foreground">
              Number of short answer questions (2-3 sentences expected)
            </p>
          </div>

          {/* Essay Questions */}
          <div className="space-y-2">
            <Label htmlFor="num-essay" className="text-sm font-medium">
              Essay Questions <span className="text-red-500">*</span>
            </Label>
            <Input
              id="num-essay"
              type="number"
              min="0"
              max="5"
              value={config.numEssay}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                numEssay: parseInt(e.target.value) || 0 
              }))}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 2"
            />
            <p className="text-xs text-muted-foreground">
              Number of essay questions (detailed responses expected)
            </p>
          </div>

          {/* Total Points */}
          <div className="space-y-2">
            <Label htmlFor="total-points" className="text-sm font-medium">
              Total Points <span className="text-red-500">*</span>
            </Label>
            <Input
              id="total-points"
              type="number"
              min="1"
              max="200"
              value={config.totalPoints}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                totalPoints: parseInt(e.target.value) || 100 
              }))}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 100"
            />
            <p className="text-xs text-muted-foreground">
              Total points for the exam (typically 100)
            </p>
          </div>

          {/* Action Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleConfirm}
              disabled={isGenerating || config.numMultipleChoice < 0 || config.numShortAnswer < 0 || config.numEssay < 0 || config.totalPoints <= 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  Generate Exam <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 