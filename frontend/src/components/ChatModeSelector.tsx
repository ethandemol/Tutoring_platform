import { useState, useRef } from "react";
import { GraduationCap, Sparkles, Brain, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMode = "focused" | "regular" | "socratic" | "deeper";

interface ChatModeSelectorProps {
  selectedMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

interface ModeOption {
  id: ChatMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const modeOptions: ModeOption[] = [
  {
    id: "focused",
    label: "Focused",
    icon: GraduationCap,
    description: "Quick, concise answers",
    color: "text-blue-600"
  },
  {
    id: "regular",
    label: "Regular",
    icon: Sparkles,
    description: "Natural conversation style",
    color: "text-red-500"
  },
  {
    id: "socratic",
    label: "Socratic",
    icon: Brain,
    description: "Guides you with questions",
    color: "text-purple-600"
  },
  {
    id: "deeper",
    label: "Deeper Dive",
    icon: Search,
    description: "Detailed explanations",
    color: "text-green-600"
  }
];

export function ChatModeSelector({ selectedMode, onModeChange }: ChatModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<ChatMode | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, width: 0 });
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (optionId: ChatMode, button: HTMLButtonElement) => {
    setHoveredMode(optionId);
    const rect = button.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (containerRect) {
      // Calculate position relative to container
      const relativeLeft = rect.left - containerRect.left + rect.width / 2;
      
      // Ensure tooltip doesn't go off-screen
      const tooltipWidth = Math.max(rect.width, 200); // Minimum width for tooltip
      let adjustedLeft = relativeLeft;
      
      // Check if tooltip would go off the right edge
      if (relativeLeft + tooltipWidth / 2 > containerRect.width) {
        adjustedLeft = containerRect.width - tooltipWidth / 2 - 10;
      }
      
      // Check if tooltip would go off the left edge
      if (adjustedLeft - tooltipWidth / 2 < 0) {
        adjustedLeft = tooltipWidth / 2 + 10;
      }
      
      setTooltipPosition({
        left: adjustedLeft,
        width: tooltipWidth
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredMode(null);
  };

  return (
    <div className="space-y-2">
      {/* Mode Selector Bar - Now scrollable */}
      <div ref={containerRef} className="bg-gray-100 rounded-lg p-1 relative">
        <div className="flex overflow-x-auto scrollbar-hide gap-1 min-w-0">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedMode === option.id;

            return (
              <button
                key={option.id}
                ref={(el) => buttonRefs.current[option.id] = el}
                onClick={() => onModeChange(option.id)}
                onMouseEnter={(e) => handleMouseEnter(option.id, e.currentTarget)}
                onMouseLeave={handleMouseLeave}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 relative flex-shrink-0 whitespace-nowrap",
                  isSelected
                    ? "bg-white shadow-sm text-gray-900 ring-2 ring-blue-500/20"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", option.color)} />
                {option.label}
              </button>
            );
          })}
        </div>
        
        {/* Hover Tooltip - Positioned above the specific button */}
        {hoveredMode && (
          <div 
            className="absolute bottom-full mb-2 px-3 py-2 bg-white text-gray-600 text-xs rounded-md whitespace-nowrap z-50 pointer-events-none transform -translate-x-1/2 border border-gray-200 shadow-md"
            style={{ 
              left: `${tooltipPosition.left}px`
            }}
          >
            {modeOptions.find(option => option.id === hoveredMode)?.description}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
          </div>
        )}
      </div>
    </div>
  );
} 