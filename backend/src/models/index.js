import User from './User.js';
import Workspace from './Workspace.js';
import File from './File.js';
import Chunk from './Chunk.js';
import Todo from './Todo.js';
import ChatSession from './ChatSession.js';
import ChatMessage from './ChatMessage.js';
import Feedback from './Feedback.js';
import YouTubeTranscript from './YouTubeTranscript.js';
import Folder from './Folder.js';


// Associations
User.hasMany(Workspace, { foreignKey: 'userId', as: 'workspaces' });
Workspace.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(File, { foreignKey: 'userId', as: 'files' });
File.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Workspace.hasMany(File, { foreignKey: 'workspaceId', as: 'files' });
File.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

// Chunk associations
User.hasMany(Chunk, { foreignKey: 'userId', as: 'chunks' });
Chunk.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Workspace.hasMany(Chunk, { foreignKey: 'workspaceId', as: 'chunks' });
Chunk.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
File.hasMany(Chunk, { foreignKey: 'fileId', as: 'chunks' });
Chunk.belongsTo(File, { foreignKey: 'fileId', as: 'file' });

// Todo associations
User.hasMany(Todo, { foreignKey: 'userId', as: 'todos' });
Todo.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Workspace.hasMany(Todo, { foreignKey: 'workspaceId', as: 'todos' });
Todo.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

// Chat associations
User.hasMany(ChatSession, { foreignKey: 'userId', as: 'chatSessions' });
ChatSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Workspace.hasMany(ChatSession, { foreignKey: 'workspaceId', as: 'chatSessions' });
ChatSession.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
File.hasMany(ChatSession, { foreignKey: 'fileId', as: 'chatSessions' });
ChatSession.belongsTo(File, { foreignKey: 'fileId', as: 'file' });

ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId', as: 'session' });

// Feedback associations
User.hasMany(Feedback, { foreignKey: 'userId', as: 'feedback' });
Feedback.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// YouTube Transcript associations
User.hasMany(YouTubeTranscript, { foreignKey: 'userId', as: 'youtubeTranscripts' });
YouTubeTranscript.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Folder associations
User.hasMany(Folder, { foreignKey: 'userId', as: 'folders' });
Folder.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Workspace.hasMany(Folder, { foreignKey: 'workspaceId', as: 'folders' });
Folder.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

// File-Folder association
Folder.hasMany(File, { foreignKey: 'folderId', as: 'files' });
File.belongsTo(Folder, { foreignKey: 'folderId', as: 'folder' });

export { User, Workspace, File, Chunk, Todo, ChatSession, ChatMessage, Feedback, YouTubeTranscript, Folder }; 