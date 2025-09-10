import React, { useState } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface QuizConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: QuizConfig) => void;
  isGenerating?: boolean;
}

export interface QuizConfig {
  numQuestions: number;
  questionType: 'multiple_choice' | 'free_response' | 'both';
}

export const QuizConfigDialog: React.FC<QuizConfigDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isGenerating = false
}) => {
  console.log('🔍 [QUIZ DIALOG] Dialog rendered, isOpen:', isOpen);
  const [config, setConfig] = useState<QuizConfig>({
    numQuestions: 10,
    questionType: 'both'
  });
  console.log('🔍 [QUIZ DIALOG] Current config state:', config);

  const handleConfirm = () => {
    console.log('🔍 [QUIZ DIALOG] handleConfirm called');
    console.log('🔍 [QUIZ DIALOG] Config being sent to parent:', config);
    if (config.numQuestions >= 1 && config.numQuestions <= 50) {
      console.log('🔍 [QUIZ DIALOG] Config is valid, calling onConfirm');
      onConfirm(config);
    } else {
      console.log('🔍 [QUIZ DIALOG] Config is invalid, not calling onConfirm');
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
          <DialogTitle>Configure Quiz</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Number of Questions */}
          <div className="space-y-2">
            <Label htmlFor="num-questions" className="text-sm font-medium">
              Number of Questions <span className="text-red-500">*</span>
            </Label>
            <Input
              id="num-questions"
              type="number"
              min="1"
              max="50"
              value={config.numQuestions}
              onChange={(e) => {
                const newValue = parseInt(e.target.value) || 1;
                console.log('🔍 [QUIZ DIALOG] Number input changed');
                console.log('🔍 [QUIZ DIALOG] Raw input value:', e.target.value);
                console.log('🔍 [QUIZ DIALOG] Parsed value:', newValue);
                setConfig(prev => {
                  const newConfig = { ...prev, numQuestions: newValue };
                  console.log('🔍 [QUIZ DIALOG] Updated config:', newConfig);
                  return newConfig;
                });
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 10"
            />
            <p className="text-xs text-muted-foreground">
              Choose between 1 and 50 questions
            </p>
          </div>

          {/* Question Type */}
          <div className="space-y-2">
            <Label htmlFor="question-type" className="text-sm font-medium">
              Question Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={config.questionType}
              onValueChange={(value: 'multiple_choice' | 'free_response' | 'both') => {
                console.log('🔍 [QUIZ DIALOG] Question type changed to:', value);
                setConfig(prev => {
                  const newConfig = { ...prev, questionType: value };
                  console.log('🔍 [QUIZ DIALOG] Updated config after question type change:', newConfig);
                  return newConfig;
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select question type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="free_response">Free Response</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.questionType === 'multiple_choice' && 'Multiple choice questions with A, B, C, D options for quick assessment'}
              {config.questionType === 'free_response' && 'Open-ended questions requiring detailed written answers for deeper understanding'}
              {config.questionType === 'both' && 'Mix of multiple choice (60%) and free response (40%) questions for comprehensive testing'}
            </p>
          </div>

          {/* Action Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleConfirm}
              disabled={isGenerating || config.numQuestions < 1 || config.numQuestions > 50}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  Generate Quiz <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 