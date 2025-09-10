import React from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { MessageCircle, Brain, Mic } from 'lucide-react';

export type AvatarState = 'idle' | 'think' | 'talk';

interface AIAvatarProps {
  state: AvatarState;
  size?: 'sm' | 'md' | 'lg';
}

export const AIAvatar: React.FC<AIAvatarProps> = ({ state, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const getStateConfig = () => {
    switch (state) {
      case 'idle':
        return {
          icon: <MessageCircle className={iconSizes[size]} />,
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-600',
          label: 'AI Assistant'
        };
      case 'think':
        return {
          icon: <Brain className={iconSizes[size]} />,
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-600',
          label: 'Thinking...'
        };
      case 'talk':
        return {
          icon: <Mic className={iconSizes[size]} />,
          bgColor: 'bg-green-100',
          borderColor: 'border-green-200',
          textColor: 'text-green-600',
          label: 'Speaking...'
        };
    }
  };

  const config = getStateConfig();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${sizeClasses[size]} ${config.bgColor} ${config.borderColor} border-2 rounded-full flex items-center justify-center transition-all duration-300`}>
        <div className={config.textColor}>
          {config.icon}
        </div>
      </div>
      <span className={`text-sm font-medium ${config.textColor}`}>
        {config.label}
      </span>
    </div>
  );
}; 