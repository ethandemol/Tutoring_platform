import { clsx, type ClassValue } from "clsx"
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple fallback emoji mapping for immediate display
const FALLBACK_EMOJIS: { [key: string]: string } = {
  'math': '📊', 'calculus': '📊', 'algebra': '📊', 'geometry': '📊',
  'physics': '⚡', 'chemistry': '🧪', 'biology': '🧬',
  'computer': '💻', 'programming': '💻', 'coding': '💻',
  'history': '📜', 'english': '📖', 'literature': '📖',
  'art': '🎨', 'music': '🎵', 'business': '💰', 'economics': '💰',
  'engineering': '⚙️', 'medicine': '🏥', 'research': '🔬',
  'project': '📁', 'assignment': '📁', 'homework': '📁'
};

// Subject to emoji mapping for workspace icons
export function getSubjectEmoji(workspaceName: string): string {
  const name = workspaceName.toLowerCase().trim();
  
  // Handle edge cases
  if (!name || name.length === 0) return '📚';
  if (name.length === 1) return '📝';
  
  // Try simple keyword matching for immediate display
  return getFallbackEmoji(name);
}

// Function to get emoji from workspace data (preferred method)
export function getWorkspaceEmoji(workspace: { name: string; emoji?: string }): string {
  // If workspace has a stored emoji, use it
  if (workspace.emoji) {
    return workspace.emoji;
  }
  
  // Fallback to name-based classification
  return getSubjectEmoji(workspace.name);
}

// Simple fallback emoji function
function getFallbackEmoji(name: string): string {
  // Check for common keywords
  for (const [keyword, emoji] of Object.entries(FALLBACK_EMOJIS)) {
    if (name.includes(keyword)) {
      return emoji;
    }
  }
  
  // Default based on first letter
  const firstChar = name.charAt(0).toLowerCase();
  const letterEmojis: { [key: string]: string } = {
    'a': '🌟', 'b': '🎈', 'c': '🎪', 'd': '📁', 'e': '📚',
    'f': '🎭', 'g': '🎪', 'h': '📜', 'i': '💡', 'j': '🎪',
    'k': '🎪', 'l': '📖', 'm': '📊', 'n': '📝', 'o': '🎪',
    'p': '📁', 'q': '🎪', 'r': '🔬', 's': '📚', 't': '📝',
    'u': '🎪', 'v': '🎪', 'w': '📚', 'x': '🎪', 'y': '🎪', 'z': '🎪'
  };
  
  return letterEmojis[firstChar] || '📚';
}

// Function to generate workspace-specific background colors
export function getWorkspaceBackgroundColor(workspaceName: string): string {
  const name = workspaceName.toLowerCase().trim();
  
  // Define color schemes based on workspace type
  const colorSchemes: { [key: string]: string } = {
    'math': 'bg-gradient-to-r from-blue-50 to-indigo-50',
    'calculus': 'bg-gradient-to-r from-blue-50 to-indigo-50',
    'algebra': 'bg-gradient-to-r from-blue-50 to-indigo-50',
    'geometry': 'bg-gradient-to-r from-blue-50 to-indigo-50',
    'physics': 'bg-gradient-to-r from-purple-50 to-pink-50',
    'chemistry': 'bg-gradient-to-r from-green-50 to-emerald-50',
    'biology': 'bg-gradient-to-r from-green-50 to-teal-50',
    'computer': 'bg-gradient-to-r from-slate-50 to-gray-50',
    'programming': 'bg-gradient-to-r from-slate-50 to-gray-50',
    'coding': 'bg-gradient-to-r from-slate-50 to-gray-50',
    'history': 'bg-gradient-to-r from-amber-50 to-orange-50',
    'english': 'bg-gradient-to-r from-red-50 to-pink-50',
    'literature': 'bg-gradient-to-r from-red-50 to-pink-50',
    'art': 'bg-gradient-to-r from-pink-50 to-rose-50',
    'music': 'bg-gradient-to-r from-purple-50 to-violet-50',
    'business': 'bg-gradient-to-r from-emerald-50 to-green-50',
    'economics': 'bg-gradient-to-r from-emerald-50 to-green-50',
    'engineering': 'bg-gradient-to-r from-orange-50 to-amber-50',
    'medicine': 'bg-gradient-to-r from-red-50 to-rose-50',
    'research': 'bg-gradient-to-r from-indigo-50 to-purple-50',
    'project': 'bg-gradient-to-r from-cyan-50 to-blue-50',
    'assignment': 'bg-gradient-to-r from-cyan-50 to-blue-50',
    'homework': 'bg-gradient-to-r from-cyan-50 to-blue-50'
  };
  
  // Check for common keywords
  for (const [keyword, colorScheme] of Object.entries(colorSchemes)) {
    if (name.includes(keyword)) {
      return colorScheme;
    }
  }
  
  // Default based on first letter
  const firstChar = name.charAt(0).toLowerCase();
  const letterColors: { [key: string]: string } = {
    'a': 'bg-gradient-to-r from-blue-50 to-indigo-50',
    'b': 'bg-gradient-to-r from-green-50 to-emerald-50',
    'c': 'bg-gradient-to-r from-purple-50 to-pink-50',
    'd': 'bg-gradient-to-r from-orange-50 to-amber-50',
    'e': 'bg-gradient-to-r from-red-50 to-pink-50',
    'f': 'bg-gradient-to-r from-teal-50 to-cyan-50',
    'g': 'bg-gradient-to-r from-indigo-50 to-purple-50',
    'h': 'bg-gradient-to-r from-amber-50 to-orange-50',
    'i': 'bg-gradient-to-r from-pink-50 to-rose-50',
    'j': 'bg-gradient-to-r from-emerald-50 to-green-50',
    'k': 'bg-gradient-to-r from-violet-50 to-purple-50',
    'l': 'bg-gradient-to-r from-cyan-50 to-blue-50',
    'm': 'bg-gradient-to-r from-slate-50 to-gray-50',
    'n': 'bg-gradient-to-r from-blue-50 to-indigo-50',
    'o': 'bg-gradient-to-r from-green-50 to-emerald-50',
    'p': 'bg-gradient-to-r from-purple-50 to-pink-50',
    'q': 'bg-gradient-to-r from-orange-50 to-amber-50',
    'r': 'bg-gradient-to-r from-red-50 to-pink-50',
    's': 'bg-gradient-to-r from-teal-50 to-cyan-50',
    't': 'bg-gradient-to-r from-indigo-50 to-purple-50',
    'u': 'bg-gradient-to-r from-amber-50 to-orange-50',
    'v': 'bg-gradient-to-r from-pink-50 to-rose-50',
    'w': 'bg-gradient-to-r from-emerald-50 to-green-50',
    'x': 'bg-gradient-to-r from-violet-50 to-purple-50',
    'y': 'bg-gradient-to-r from-cyan-50 to-blue-50',
    'z': 'bg-gradient-to-r from-slate-50 to-gray-50'
  };
  
  return letterColors[firstChar] || 'bg-gradient-to-r from-slate-50 to-gray-50';
}


