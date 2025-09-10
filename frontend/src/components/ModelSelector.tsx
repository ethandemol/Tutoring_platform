import { useState, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { ChevronDown, Zap, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Model {
  provider: string;
  model: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}

export function ModelSelector({ selectedModel, onModelChange, className = "" }: ModelSelectorProps) {
  const [models, setModels] = useState<Record<string, Model>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [defaultModel, setDefaultModel] = useState<string>("gpt-4o-mini");

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.MODELS), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
        setDefaultModel(data.defaultModel);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModelIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return <Sparkles className="w-4 h-4" />;
      case 'gemini':
        return <Brain className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getModelBadge = (modelName: string) => {
    const model = models[modelName];
    if (!model) return null;

    return (
      <Badge 
        variant="secondary" 
        className="text-xs font-medium"
      >
        {getModelIcon(model.provider)}
        <span className="ml-1">{modelName}</span>
      </Badge>
    );
  };

  const getModelDescription = (modelName: string) => {
    const model = models[modelName];
    return model?.description || "Model description not available";
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Badge variant="secondary" className="animate-pulse">
          Loading models...
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`flex items-center space-x-2 ${className}`}
        >
          {getModelBadge(selectedModel)}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-60 overflow-y-auto">
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Select AI Model
          </div>
          {Object.entries(models).map(([modelName, model]) => (
            <DropdownMenuItem
              key={modelName}
              onClick={() => onModelChange(modelName)}
              className={`flex items-start space-x-3 p-3 cursor-pointer ${
                selectedModel === modelName ? 'bg-accent' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getModelIcon(model.provider)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{modelName}</span>
                  {modelName === defaultModel && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {model.description}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 