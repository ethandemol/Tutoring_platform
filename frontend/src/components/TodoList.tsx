import { useState, useRef, useEffect } from "react";
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { CheckSquare, Square, Calendar, Plus, Eye, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { WorkspaceTheme } from "@/lib/themes";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  workspaceId?: string;
  workspaceName?: string;
}

interface TodoListProps {
  todos: TodoItem[];
  onToggleTodo: (todoId: string) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  onUpdateTodo: (todoId: string, updates: { text?: string; dueDate?: string }) => Promise<void>;
  onAddTodo: (todo: { text: string; dueDate?: string; workspaceId?: string }) => Promise<void>;
  workspaceId?: string;
  workspaceName?: string;
  showWorkspaceInfo?: boolean;
  workspaces?: Array<{ id: string; name: string }>;
  isDashboard?: boolean;
  theme?: WorkspaceTheme;
}

export function TodoList({
  todos,
  onToggleTodo,
  onDeleteTodo,
  onUpdateTodo,
  onAddTodo,
  workspaceId,
  workspaceName,
  showWorkspaceInfo = false,
  workspaces = [],
  isDashboard = false,
  theme
}: TodoListProps) {
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [selectedWorkspaceForTodo, setSelectedWorkspaceForTodo] = useState('');

  const [activeTab, setActiveTab] = useState<'todo' | 'completed'>('todo');
  const [swipeStates, setSwipeStates] = useState<{ [key: string]: number }>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [inlineEditing, setInlineEditing] = useState<string | null>(null);
  const [inlineText, setInlineText] = useState('');
  const [inlineDueDate, setInlineDueDate] = useState('');
  const { toast } = useToast();

  // Helper function to get text color with proper contrast for dark mode
  const getTextColor = (isMuted = false) => {
    if (!theme) return undefined;
    if (isMuted) {
      return theme.colors.muted;
    }
    return theme.colors.text;
  };

  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;
    
    // For dashboard, require workspace selection
    if (isDashboard && !selectedWorkspaceForTodo) {
      toast({
        title: "Select Workspace",
        description: "Please select a workspace to add a todo",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await onAddTodo({
        text: newTodoText.trim(),
        dueDate: newTodoDueDate || undefined,
        workspaceId: isDashboard ? selectedWorkspaceForTodo : undefined
      });
      setNewTodoText('');
      setNewTodoDueDate('');
      setSelectedWorkspaceForTodo('');
      setIsAddingTodo(false);
    } catch (error) {
      toast({
        title: "Error adding todo",
        description: "Failed to add todo",
        variant: "destructive",
      });
    }
  };

  const cancelAddTodo = () => {
    setIsAddingTodo(false);
    setNewTodoText('');
    setNewTodoDueDate('');
    setSelectedWorkspaceForTodo('');
  };

  const handleDeleteTodo = async (todoId: string) => {
    setIsDeleting(true);
    try {
      await onDeleteTodo(todoId);
      // Don't show toast for seamless deletion
    } catch (error) {
      toast({
        title: "Error deleting todo",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const startInlineEdit = (todo: TodoItem) => {
    setInlineEditing(todo.id);
    setInlineText(todo.text);
    setInlineDueDate(todo.dueDate || '');
    
    // Add a small delay to ensure the input is focused properly
    setTimeout(() => {
      const input = document.querySelector(`[data-todo-id="${todo.id}"] input`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select(); // Select all text for easy replacement
      }
    }, 10);
  };

  const startDateEdit = (todo: TodoItem) => {
    setInlineEditing(todo.id);
    setInlineText(todo.text);
    setInlineDueDate(todo.dueDate || '');
    
    // Focus on date input instead of text input
    setTimeout(() => {
      const dateInput = document.querySelector(`[data-todo-id="${todo.id}"] input[type="date"]`) as HTMLInputElement;
      if (dateInput) {
        dateInput.focus();
      }
    }, 10);
  };

  const saveInlineEdit = async () => {
    if (!inlineEditing) return;
    
    // Allow saving if text has content OR if we're editing a date
    const hasText = inlineText.trim();
    const hasDate = inlineDueDate;
    const originalTodo = todos.find(t => t.id === inlineEditing);
    
    if (!hasText && !hasDate) return;
    
    setIsUpdating(true);
    try {
      await onUpdateTodo(inlineEditing, {
        text: hasText ? inlineText.trim() : originalTodo?.text,
        dueDate: hasDate ? inlineDueDate : undefined
      });
      setInlineEditing(null);
      setInlineText('');
      setInlineDueDate('');
      // Don't show toast for inline edits to keep it seamless
    } catch (error) {
      toast({
        title: "Error updating todo",
        description: "Failed to update todo",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditing(null);
    setInlineText('');
    setInlineDueDate('');
  };

  const getDueDateText = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  const getDueDateColor = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'text-red-600'; // Red for overdue
    } else if (diffDays === 0) {
      return 'text-orange-600'; // Orange for due today
    } else if (diffDays === 1) {
      return 'text-yellow-600'; // Yellow for due tomorrow
    } else {
      return 'text-navy'; // Navy for upcoming
    }
  };

  // Generate consistent colors for workspace tags - same as planner
  const getWorkspaceTagColor = (workspaceId: string) => {
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

  // Swipe to delete functionality
  const handleTouchStart = (e: React.TouchEvent, todoId: string) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const currentX = touch.clientX;
      const diffX = startX - currentX;
      
      if (diffX > 0) { // Only allow left swipe
        setSwipeStates(prev => ({
          ...prev,
          [todoId]: Math.min(diffX, 100)
        }));
      }
    };
    
    const handleTouchEnd = () => {
      const swipeDistance = swipeStates[todoId] || 0;
      if (swipeDistance > 50) {
        handleDeleteTodo(todoId);
      }
      setSwipeStates(prev => ({ ...prev, [todoId]: 0 }));
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const TodoItemComponent = ({ todo, isCompleted = false }: { todo: TodoItem; isCompleted?: boolean }) => {
    const swipeDistance = swipeStates[todo.id] || 0;
    const isEditing = inlineEditing === todo.id;
    
    const handleDragStart = (e: React.DragEvent) => {
      if (isCompleted) return; // Don't allow dragging completed todos
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'todo',
        item: todo
      }));
      e.dataTransfer.effectAllowed = 'move';
    };
    
    return (
      <div
        className={`relative flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-all duration-200 ${
          isCompleted ? 'opacity-75' : ''
        }`}
        style={{
          transform: `translateX(-${swipeDistance}px)`,
        }}
        onTouchStart={(e) => handleTouchStart(e, todo.id)}
        draggable={!isCompleted}
        onDragStart={handleDragStart}
      >
        {/* Swipe delete indicator */}
        {swipeDistance > 0 && (
          <div className="absolute right-0 top-0 bottom-0 bg-red-500 text-white flex items-center justify-center px-4 rounded-r-md">
            <X className="w-4 h-4" />
          </div>
        )}
        
        <button
          onClick={() => onToggleTodo(todo.id)}
          className="flex-shrink-0"
        >
          {todo.completed ? (
            <CheckSquare className="w-5 h-5" style={{ color: theme?.colors.primary }} />
          ) : (
            <Square 
              className="w-5 h-5 hover:text-foreground" 
              style={{ color: getTextColor(true) }}
            />
          )}
        </button>
        
        <div className="flex-1 flex flex-col">
          {isEditing ? (
            // Inline editing mode - Google Doc style
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={inlineText}
                  onChange={(e) => setInlineText(e.target.value)}
                  placeholder="Todo text"
                  className="text-sm border-2 border-primary/50 focus:border-primary transition-colors"
                  data-todo-id={todo.id}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveInlineEdit();
                    } else if (e.key === 'Escape') {
                      cancelInlineEdit();
                    }
                  }}
                  onBlur={(e) => {
                    // Don't auto-save if clicking on date input or cancel button
                    if (e.relatedTarget && (
                      e.relatedTarget.tagName === 'INPUT' || 
                      e.relatedTarget.tagName === 'BUTTON' ||
                      e.relatedTarget.closest('button')
                    )) {
                      return;
                    }
                    
                    // Auto-save on blur if text has changed or date has changed
                    const textChanged = inlineText.trim() && inlineText !== todo.text;
                    const dateChanged = inlineDueDate !== todo.dueDate;
                    
                    if (textChanged || dateChanged) {
                      saveInlineEdit();
                    } else if (!inlineText.trim() && !inlineDueDate) {
                      cancelInlineEdit();
                    }
                  }}
                  autoFocus
                />
                {/* Subtle save indicator */}
                {isUpdating && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <Input
                    type="date"
                    value={inlineDueDate}
                    onChange={(e) => setInlineDueDate(e.target.value)}
                    className="text-xs border border-border focus:border-primary focus:ring-1 focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveInlineEdit();
                      } else if (e.key === 'Escape') {
                        cancelInlineEdit();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelInlineEdit}
                  disabled={isUpdating}
                  className="h-6 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // Display mode - Google Doc style inline editing
            <div className="space-y-1">
              <div 
                className="group relative"
                onClick={() => !isCompleted && startInlineEdit(todo)}
              >
                <span 
                  className="text-sm font-medium cursor-text hover:bg-muted/30 px-1 py-0.5 rounded transition-colors"
                  style={{ color: getTextColor() }}
                >
                  {todo.text}
                </span>
                {/* Subtle edit indicator on hover */}
                <div className="absolute inset-0 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity rounded pointer-events-none" />
                {/* Edit icon on hover */}
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                {/* Delete button on hover - only show when not editing */}
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-6 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTodo(todo.id);
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {showWorkspaceInfo && todo.workspaceName && (
                  <>
                    <span 
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getWorkspaceTagColor(todo.workspaceId || 'default')}`}
                      style={{ color: getTextColor() }}
                    >
                      {todo.workspaceName}
                    </span>
                    {todo.dueDate && <span style={{ color: getTextColor(true) }}>•</span>}
                  </>
                )}
                {todo.dueDate && (
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      startDateEdit(todo);
                    }}
                    title="Click to edit date"
                  >
                    <Calendar className="w-3 h-3" style={{ color: getDueDateColor(todo.dueDate) }} />
                    <span 
                      className="font-medium"
                      style={{ color: getDueDateColor(todo.dueDate) }}
                    >
                      {getDueDateText(todo.dueDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 
          className="text-xl font-display flex items-center gap-2"
          style={{ color: getTextColor() }}
        >
          <Calendar className="w-5 h-5" />
          To-Do List
        </h3>
        {!isAddingTodo && (
          <Button
            onClick={() => setIsAddingTodo(true)}
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div 
        className="flex border-b"
        style={{ borderColor: theme?.colors.border }}
      >
        <button
          onClick={() => setActiveTab('todo')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'todo'
              ? 'border-b-2'
              : 'hover:text-foreground'
          }`}
          style={{
            color: activeTab === 'todo' 
              ? theme?.colors.primary 
              : getTextColor(true),
            borderColor: activeTab === 'todo' ? theme?.colors.primary : 'transparent'
          }}
        >
          To Do ({incompleteTodos.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'completed'
              ? 'border-b-2'
              : 'hover:text-foreground'
          }`}
          style={{
            color: activeTab === 'completed' 
              ? theme?.colors.primary 
              : getTextColor(true),
            borderColor: activeTab === 'completed' ? theme?.colors.primary : 'transparent'
          }}
        >
          Completed ({completedTodos.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="h-48 overflow-y-auto">
        {activeTab === 'todo' ? (
          /* To Do Tab */
          <div className="space-y-2">
            {incompleteTodos.length === 0 && !isAddingTodo ? (
              <p 
                className="text-sm text-center py-4"
                style={{ color: getTextColor(true) }}
              >
                No active todos. Click the + button to add one!
              </p>
            ) : (
              <>
                {incompleteTodos
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((todo) => (
                    <TodoItemComponent key={todo.id} todo={todo} />
                  ))}
                
                {/* Inline Add Todo - positioned after existing todos */}
                {isAddingTodo && (
                  <div className="space-y-2 p-2 border border-border rounded-md bg-muted/20">
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          value={newTodoText}
                          onChange={(e) => setNewTodoText(e.target.value)}
                          placeholder="Enter your todo..."
                          className="text-sm border-2 border-primary/50 focus:border-primary transition-colors"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddTodo();
                            } else if (e.key === 'Escape') {
                              cancelAddTodo();
                            }
                          }}
                          onBlur={() => {
                            // Auto-save on blur if text has been entered
                            if (newTodoText.trim()) {
                              handleAddTodo();
                            } else {
                              cancelAddTodo();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {isDashboard && workspaces.length > 0 && (
                          <select
                            value={selectedWorkspaceForTodo}
                            onChange={(e) => setSelectedWorkspaceForTodo(e.target.value)}
                            className="text-xs border border-border rounded px-2 py-1 bg-background"
                          >
                            <option value="">Select workspace</option>
                            {workspaces.map((workspace) => (
                              <option key={workspace.id} value={workspace.id}>
                                {workspace.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <Input
                          type="date"
                          value={newTodoDueDate}
                          onChange={(e) => setNewTodoDueDate(e.target.value)}
                          className="text-xs border border-border"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddTodo();
                            } else if (e.key === 'Escape') {
                              cancelAddTodo();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelAddTodo}
                          className="h-6 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Completed Tab */
          <div className="space-y-2">
            {completedTodos.length === 0 ? (
              <p 
                className="text-sm text-center py-4"
                style={{ color: getTextColor(true) }}
              >
                No completed todos yet.
              </p>
            ) : (
              completedTodos
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map((todo) => (
                  <TodoItemComponent key={todo.id} todo={todo} isCompleted={true} />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
} 