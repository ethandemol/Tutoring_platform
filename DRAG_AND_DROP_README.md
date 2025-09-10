# Drag and Drop File Management

This feature allows users to drag files into folders and move files between folders using an intuitive drag and drop interface.

## Features

### File to Folder Drag and Drop
- **Draggable Files**: Files can be dragged from the main file list or from within folders
- **Droppable Folders**: Folders act as drop zones that can receive files
- **Visual Feedback**: Folders highlight and scale when files are dragged over them
- **Move to Root**: Files can be dragged out of folders to the root level using a special drop zone

### Visual Indicators
- Files show "Drag to move to folder" text when draggable
- Folders show "Drop files here" text to indicate they can receive files
- Drop zones scale and change color when files are dragged over them
- Smooth transitions and animations for better UX

### API Endpoints

#### Move Files to Folder
```
PUT /api/folders/:id/move-files
```
Moves files to a specific folder by updating their `folderId`.

#### Update File Properties
```
PATCH /api/files/:id
```
Updates file properties including `folderId` for moving files out of folders.

## Usage

1. **Drag a file** from the file list
2. **Drop it on a folder** to move it into that folder
3. **Drag a file from within a folder** and drop it on the "Move to Root" zone to move it out of the folder
4. **Visual feedback** shows where files can be dropped

## Technical Implementation

### Frontend Components
- `FileCard`: Enhanced with drag functionality
- `MainContent`: Contains drop zones for folders and root level
- Visual feedback with CSS transitions and scaling

### Backend Routes
- `folders.js`: Handles moving files to folders
- `files.js`: Handles updating file properties (folderId)

### Database
- Files have a `folderId` field that references folders
- Folders have a `fileIds` array for easy access to contained files

## Error Handling
- API calls are wrapped in try-catch blocks
- User-friendly error messages via toast notifications
- Graceful fallback if drag and drop fails

## Browser Compatibility
- Uses standard HTML5 Drag and Drop API
- Works in all modern browsers
- Graceful degradation for older browsers 