import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Palette, Check } from 'lucide-react';
import { workspaceThemes, WorkspaceTheme, getThemeById } from '@/lib/themes';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl, API_ENDPOINTS } from '@/api/config';

interface ThemeSelectorProps {
  workspaceId: string;
  currentThemeId: string;
  onThemeChange: (themeId: string) => void;
  trigger?: React.ReactNode;
}

export function ThemeSelector({ workspaceId, currentThemeId, onThemeChange, trigger }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const currentTheme = getThemeById(currentThemeId);

  const handleThemeSelect = (themeId: string) => {
    setSelectedThemeId(themeId);
  };

  const handleSaveTheme = async () => {
    if (selectedThemeId === currentThemeId) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.WORKSPACES.UPDATE(workspaceId) + '/theme'), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ themeId: selectedThemeId }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onThemeChange(selectedThemeId);
        toast({
          title: 'Theme updated',
          description: 'Your workspace theme has been updated successfully.',
        });
        setIsOpen(false);
      } else {
        toast({
          title: 'Error updating theme',
          description: data.message || 'Failed to update theme',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error updating theme',
        description: 'Network error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const ThemePreview = ({ theme }: { theme: WorkspaceTheme }) => {
    const isSelected = selectedThemeId === theme.id;
    
    // Helper function to get text color with proper contrast
    const getTextColor = (isMuted = false) => {
      if (isMuted) {
        return theme.colors.muted;
      }
      return theme.colors.text;
    };
    
    return (
      <div
        className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
          isSelected 
            ? 'border-primary shadow-lg' 
            : 'border-border hover:border-primary/50'
        }`}
        onClick={() => handleThemeSelect(theme.id)}
        style={{
          backgroundColor: theme.colors.card,
          borderColor: isSelected ? theme.colors.primary : theme.colors.cardBorder,
        }}
      >
        {isSelected && (
          <div 
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: theme.colors.primary }}
          >
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
        
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 
              className="font-semibold text-sm"
              style={{ color: getTextColor() }}
            >
              {theme.name}
            </h4>
            <Badge 
              variant="secondary" 
              className="text-xs"
              style={{ 
                backgroundColor: theme.colors.surface,
                color: getTextColor(),
                borderColor: theme.colors.border,
              }}
            >
              {theme.id}
            </Badge>
          </div>
          
          {/* Description */}
          <p 
            className="text-xs"
            style={{ color: getTextColor(true) }}
          >
            {theme.description}
          </p>
          
          {/* Color preview */}
          <div className="flex gap-2">
            <div 
              className="w-6 h-6 rounded-full border border-border"
              style={{ backgroundColor: theme.colors.primary }}
            />
            <div 
              className="w-6 h-6 rounded-full border border-border"
              style={{ backgroundColor: theme.colors.secondary }}
            />
            <div 
              className="w-6 h-6 rounded-full border border-border"
              style={{ backgroundColor: theme.colors.accent }}
            />
            <div 
              className="w-6 h-6 rounded-full border border-border"
              style={{ backgroundColor: theme.colors.surface }}
            />
          </div>
          
          {/* Gradient preview */}
          <div 
            className="h-8 rounded-md"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.gradient.from}, ${theme.colors.gradient.to})`,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Palette className="w-4 h-4" />
            Theme
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Choose Workspace Theme
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current theme info */}
          <div 
            className="p-4 rounded-lg border"
            style={{ 
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border
            }}
          >
            <h3 
              className="font-semibold mb-2"
              style={{ color: currentTheme.colors.text }}
            >
              Current Theme: {currentTheme.name}
            </h3>
            <p 
              className="text-sm"
              style={{ color: currentTheme.colors.muted }}
            >
              {currentTheme.description}
            </p>
          </div>
          
          {/* Theme grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaceThemes.map((theme) => (
              <ThemePreview key={theme.id} theme={theme} />
            ))}
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTheme}
              disabled={isUpdating || selectedThemeId === currentThemeId}
            >
              {isUpdating ? 'Updating...' : 'Apply Theme'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 