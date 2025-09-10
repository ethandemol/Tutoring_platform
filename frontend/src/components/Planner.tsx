import { useState, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Calendar, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  workspaceId?: string;
  workspaceName?: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface ScheduledItem {
  id: string;
  type: 'todo' | 'workspace';
  itemId: string;
  title: string;
  workspaceName?: string;
  timeSlot: string;
  date: string;
  duration: number; // Duration in time slots (1 = 1 hour)
  startTimeIndex: number; // Index of the time slot
}

interface PlannerProps {
  todos: TodoItem[];
  workspaces: Workspace[];
  onScheduleItem: (item: ScheduledItem) => void;
  onRemoveScheduledItem: (itemId: string) => void;
  userId?: string;
}

export function Planner({ todos, workspaces, onScheduleItem, onRemoveScheduledItem, userId }: PlannerProps) {
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>(() => {
    // Load saved items from localStorage on component mount
    const storageKey = userId ? `planner-scheduled-items-${userId}` : 'planner-scheduled-items';
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return startOfWeek;
  });
  const [resizingItem, setResizingItem] = useState<string | null>(null);
  const [movingItem, setMovingItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const timeSlots = [
    '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
    '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
  ];

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, timeSlot: string, date: string) => {
    e.preventDefault();
    
    const draggedData = e.dataTransfer.getData('application/json');
    if (!draggedData) return;

    try {
      const draggedItem = JSON.parse(draggedData);
      const timeSlotIndex = timeSlots.indexOf(timeSlot);
      
      const newScheduledItem: ScheduledItem = {
        id: `${draggedItem.type}-${draggedItem.item.id}-${Date.now()}`,
        type: draggedItem.type,
        itemId: draggedItem.item.id,
        title: draggedItem.type === 'todo' ? draggedItem.item.text : draggedItem.item.name,
        workspaceName: draggedItem.type === 'todo' ? draggedItem.item.workspaceName : draggedItem.item.name,
        timeSlot,
        date,
        duration: 1, // Default to 1 hour
        startTimeIndex: timeSlotIndex
      };

          updateScheduledItems([...scheduledItems, newScheduledItem]);
    onScheduleItem(newScheduledItem);
    } catch (error) {
      console.error('Error parsing dragged data:', error);
    }
  };

  const handleRemoveScheduledItem = (itemId: string) => {
    updateScheduledItems(scheduledItems.filter(item => item.id !== itemId));
    onRemoveScheduledItem(itemId);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getScheduledItemsForSlot = (timeSlot: string, date: string) => {
    return scheduledItems.filter(item => item.timeSlot === timeSlot && item.date === date);
  };

  // Generate consistent colors for workspaces - same as todo tags
  const getWorkspaceColor = (workspaceId: string) => {
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-green-100 text-green-700 border-green-200',
      'bg-orange-100 text-orange-700 border-orange-200',
      'bg-pink-100 text-pink-700 border-pink-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-teal-100 text-teal-700 border-teal-200',
      'bg-red-100 text-red-700 border-red-200',
      'bg-yellow-100 text-yellow-700 border-yellow-200',
      'bg-cyan-100 text-cyan-700 border-cyan-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-sky-100 text-sky-700 border-sky-200',
      'bg-violet-100 text-violet-700 border-violet-200'
    ];
    
    // Create a mapping of workspace IDs to colors to ensure uniqueness
    const workspaceColorMap = new Map<string, string>();
    
    // Assign colors to workspaces in order, cycling through colors if needed
    workspaces.forEach((workspace, index) => {
      if (!workspaceColorMap.has(workspace.id)) {
        workspaceColorMap.set(workspace.id, colors[index % colors.length]);
      }
    });
    
    // Return the assigned color for this workspace, or generate one if not assigned
    if (workspaceColorMap.has(workspaceId)) {
      return workspaceColorMap.get(workspaceId)!;
    }
    
    // Fallback: use hash-based assignment for any workspace not in the list
    const hash = workspaceId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Get color for an item (workspace-based for workspace items, todo-based for todo items)
  const getItemColor = (item: ScheduledItem) => {
    if (item.type === 'workspace') {
      return getWorkspaceColor(item.itemId);
    } else {
      // For todo items, use the workspace color if available
      const todo = todos.find(t => t.id === item.itemId);
      if (todo && todo.workspaceId) {
        return getWorkspaceColor(todo.workspaceId);
      }
      // Fallback to default todo color
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  // Save scheduled items to localStorage
  const saveScheduledItems = (items: ScheduledItem[]) => {
    const storageKey = userId ? `planner-scheduled-items-${userId}` : 'planner-scheduled-items';
    localStorage.setItem(storageKey, JSON.stringify(items));
  };

  // Update scheduled items and save to localStorage
  const updateScheduledItems = (newItems: ScheduledItem[]) => {
    setScheduledItems(newItems);
    saveScheduledItems(newItems);
  };

  const handleResizeStart = (e: React.MouseEvent, itemId: string, resizeType: 'top' | 'bottom') => {
    e.stopPropagation();
    setResizingItem(itemId);
    e.currentTarget.setAttribute('data-resize-type', resizeType);
  };

  const handleResizeEnd = () => {
    setResizingItem(null);
  };

  // Add global mouse event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (resizingItem) {
        const item = scheduledItems.find(i => i.id === resizingItem);
        if (item) {
          const resizeType = document.querySelector(`[data-resize-type]`)?.getAttribute('data-resize-type');
          
          if (resizeType === 'top') {
            // Resize from top - adjust start time and duration
            const gridElement = document.querySelector('.planner-grid');
            if (gridElement) {
              const gridRect = gridElement.getBoundingClientRect();
              const relativeY = e.clientY - gridRect.top;
              const timeSlotHeight = 60;
              const newStartIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.floor(relativeY / timeSlotHeight)));
              const newDuration = Math.max(1, item.startTimeIndex + item.duration - newStartIndex);
              const newTimeSlot = timeSlots[newStartIndex];
              
              updateScheduledItems(scheduledItems.map(i => 
                i.id === resizingItem ? { 
                  ...i, 
                  startTimeIndex: newStartIndex,
                  timeSlot: newTimeSlot,
                  duration: newDuration
                } : i
              ));
            }
          } else {
            // Resize from bottom - adjust duration only
            const gridElement = document.querySelector('.planner-grid');
            if (gridElement) {
              const gridRect = gridElement.getBoundingClientRect();
              const relativeY = e.clientY - gridRect.top;
              const timeSlotHeight = 60;
              const newEndIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.floor(relativeY / timeSlotHeight)));
              const newDuration = Math.max(1, newEndIndex - item.startTimeIndex + 1);
              
              updateScheduledItems(scheduledItems.map(i => 
                i.id === resizingItem ? { ...i, duration: newDuration } : i
              ));
            }
          }
        }
      }
      if (movingItem) {
        const item = scheduledItems.find(i => i.id === movingItem);
        if (item) {
          const gridElement = document.querySelector('.planner-grid');
          if (gridElement) {
            const gridRect = gridElement.getBoundingClientRect();
            const relativeX = e.clientX - gridRect.left;
            const relativeY = e.clientY - gridRect.top;
            
            // Calculate day index (0-6 for Sunday-Saturday)
            const dayWidth = gridRect.width / 8; // 8 columns (time + 7 days)
            const dayIndex = Math.max(0, Math.min(6, Math.floor((relativeX - dayWidth) / dayWidth)));
            
            // Calculate time slot index
            const timeSlotHeight = 60;
            const newTimeSlotIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.floor(relativeY / timeSlotHeight)));
            const newTimeSlot = timeSlots[newTimeSlotIndex];
            const newDate = getWeekDates()[dayIndex].toISOString().split('T')[0];
            
            updateScheduledItems(scheduledItems.map(i => 
              i.id === movingItem ? { 
                ...i, 
                timeSlot: newTimeSlot, 
                startTimeIndex: newTimeSlotIndex,
                date: newDate
              } : i
            ));
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (resizingItem) setResizingItem(null);
      if (movingItem) setMovingItem(null);
    };

    if (resizingItem || movingItem) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [resizingItem, movingItem, scheduledItems, timeSlots]);

  const handleResize = (e: React.MouseEvent, itemId: string) => {
    if (!resizingItem || resizingItem !== itemId) return;
    
    const item = scheduledItems.find(i => i.id === itemId);
    if (!item) return;

    const resizeType = e.currentTarget.getAttribute('data-resize-type');
    
    if (resizeType === 'top') {
      // Resize from top - adjust start time and duration
      const gridElement = e.currentTarget.closest('.planner-grid');
      if (gridElement) {
        const gridRect = gridElement.getBoundingClientRect();
        const relativeY = e.clientY - gridRect.top;
        const timeSlotHeight = 60;
        const newStartIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.floor(relativeY / timeSlotHeight)));
        const newDuration = Math.max(1, item.startTimeIndex + item.duration - newStartIndex);
        const newTimeSlot = timeSlots[newStartIndex];
        
        updateScheduledItems(scheduledItems.map(i => 
          i.id === itemId ? { 
            ...i, 
            startTimeIndex: newStartIndex,
            timeSlot: newTimeSlot,
            duration: newDuration
          } : i
        ));
      }
    } else {
      // Resize from bottom - adjust duration only
      const gridElement = e.currentTarget.closest('.planner-grid');
      if (gridElement) {
        const gridRect = gridElement.getBoundingClientRect();
        const relativeY = e.clientY - gridRect.top;
        const timeSlotHeight = 60;
        const newEndIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.floor(relativeY / timeSlotHeight)));
        const newDuration = Math.max(1, newEndIndex - item.startTimeIndex + 1);
        
        updateScheduledItems(scheduledItems.map(i => 
          i.id === itemId ? { ...i, duration: newDuration } : i
        ));
      }
    }
  };

  const handleMoveStart = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setMovingItem(itemId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMoveEnd = () => {
    setMovingItem(null);
  };

  const handleMove = (e: React.MouseEvent, itemId: string) => {
    if (!movingItem || movingItem !== itemId) return;
    
    const item = scheduledItems.find(i => i.id === itemId);
    if (!item) return;

    // Calculate new position based on mouse position
    const gridElement = e.currentTarget.closest('.planner-grid');
    if (!gridElement) return;

    const gridRect = gridElement.getBoundingClientRect();
    const relativeX = e.clientX - gridRect.left;
    const relativeY = e.clientY - gridRect.top;
    
    // Calculate day index (0-6 for Sunday-Saturday)
    const dayWidth = gridRect.width / 8; // 8 columns (time + 7 days)
    const dayIndex = Math.max(0, Math.min(6, Math.floor((relativeX - dayWidth) / dayWidth)));
    
    // Calculate time slot index
    const timeSlotHeight = 60; // 60px per hour
    const newTimeSlotIndex = Math.max(0, Math.min(timeSlots.length - 1, Math.floor(relativeY / timeSlotHeight)));
    
    const newTimeSlot = timeSlots[newTimeSlotIndex];
    const newDate = getWeekDates()[dayIndex].toISOString().split('T')[0];
    
    updateScheduledItems(scheduledItems.map(i => 
      i.id === itemId ? { 
        ...i, 
        timeSlot: newTimeSlot, 
        startTimeIndex: newTimeSlotIndex,
        date: newDate
      } : i
    ));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Weekly Planner
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newWeek = new Date(currentWeek);
              newWeek.setDate(currentWeek.getDate() - 7);
              setCurrentWeek(newWeek);
            }}
          >
            ← Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newWeek = new Date(currentWeek);
              newWeek.setDate(currentWeek.getDate() + 7);
              setCurrentWeek(newWeek);
            }}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Planner Grid */}
      <div className="border border-border rounded-lg overflow-hidden planner-grid">
        <div className="grid grid-cols-8 gap-px bg-border">
          {/* Time column */}
          <div className="bg-background p-2">
            <div className="text-xs font-medium text-muted-foreground">Time</div>
          </div>
          
          {/* Day headers */}
          {getWeekDates().map((date) => (
            <div key={date.toISOString()} className="bg-background p-2">
              <div className="text-xs font-medium text-muted-foreground">
                {daysOfWeek[date.getDay()]}
              </div>
              <div className={`text-sm font-medium ${
                isToday(date) ? 'text-primary' : 'text-foreground'
              }`}>
                {formatDate(date)}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        {timeSlots.map((timeSlot, timeSlotIndex) => (
          <div key={timeSlot} className="grid grid-cols-8 gap-px bg-border">
            {/* Time label */}
            <div className="bg-background p-2 flex items-center">
              <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{timeSlot}</span>
            </div>
            
            {/* Day columns */}
            {getWeekDates().map((date) => {
              const dateStr = date.toISOString().split('T')[0];
              const itemsInSlot = scheduledItems.filter(item => 
                item.date === dateStr && 
                item.startTimeIndex === timeSlotIndex
              );
              
              return (
                <div
                  key={date.toISOString()}
                  className={`bg-background p-2 min-h-[60px] relative ${
                    isToday(date) ? 'bg-primary/5' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, timeSlot, dateStr)}
                  onMouseUp={() => {
                    if (resizingItem) handleResizeEnd();
                    if (movingItem) handleMoveEnd();
                  }}
                >
                  {itemsInSlot.map((item) => (
                    <div
                      key={item.id}
                      className={`absolute left-0 right-0 mx-1 rounded text-xs cursor-move border ${getItemColor(item)}`}
                      style={{
                        top: '2px',
                        height: `${item.duration * 60 - 4}px`,
                        zIndex: resizingItem === item.id || movingItem === item.id ? 10 : 1
                      }}
                      onMouseDown={(e) => handleMoveStart(e, item.id)}
                    >
                      {/* Top resize handle */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-current hover:opacity-20 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, item.id, 'top')}
                        title="Resize top"
                      />
                      {/* Bottom resize handle */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-current hover:opacity-20 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, item.id, 'bottom')}
                        title="Resize bottom"
                      />
                      <div className="flex items-center justify-between h-full p-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.title}</div>
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            {item.workspaceName && (
                              <span className="truncate">{item.workspaceName}</span>
                            )}
                            {item.duration > 1 && (
                              <>
                                {item.workspaceName && <span>•</span>}
                                <span>{item.duration}h</span>
                              </>
                            )}
                            {item.type === 'todo' && item.workspaceName && (
                              <>
                                <span>•</span>
                                <span className="text-xs opacity-60">todo</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveScheduledItem(item.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
} 