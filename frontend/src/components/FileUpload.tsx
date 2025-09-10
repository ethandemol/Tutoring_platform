import React, { useState, useRef } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Upload, FileText, Image, X, CheckCircle, AlertCircle, PenTool, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useFile } from '@/contexts/FileContext';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  workspaceId: number;
  onUploadComplete?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ workspaceId, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    file: globalThis.File;
    progress: number;
    status: 'uploading' | 'success' | 'error';
    error?: string;
  }>>([]);
  const [handwritingFiles, setHandwritingFiles] = useState<Array<{
    file: globalThis.File;
    progress: number;
    status: 'uploading' | 'success' | 'error';
    error?: string;
  }>>([]);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [isHandwritingUploading, setIsHandwritingUploading] = useState(false);
  const [handwritingProgress, setHandwritingProgress] = useState(0);

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handwritingFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useFile();
  const { toast } = useToast();

  // Direct PDF upload handlers
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select PDF files only",
        variant: "destructive",
      });
      return;
    }

    // Handle all PDF files
    pdfFiles.forEach(file => {
      const newUploadingFiles = [{
        file,
        progress: 0,
        status: 'uploading' as const,
      }];

      setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
      uploadFileWithProgress(file, uploadingFiles.length);
    });
  };

  const uploadFileWithProgress = async (file: globalThis.File, index: number) => {
    try {
      // Simulate progress (in real implementation, you'd track actual upload progress)
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => prev.map((f, i) => 
          i === index && f.status === 'uploading' 
            ? { ...f, progress: Math.min(f.progress + 10, 90) }
            : f
        ));
      }, 100);

      const result = await uploadFile(workspaceId, file);

      clearInterval(progressInterval);

      if (result.success) {
        setUploadingFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, progress: 100, status: 'success' } : f
        ));
        
        toast({
          title: "Success",
          description: `${file.name} uploaded successfully`,
        });
        
        onUploadComplete?.();
      } else {
        setUploadingFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'error', error: result.error } : f
        ));
        
        toast({
          title: "Error",
          description: result.error || "Failed to upload file",
          variant: "destructive",
        });
      }
    } catch (error) {
      setUploadingFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'error', error: 'Upload failed' } : f
      ));
      
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  // Handwriting upload handlers
  const handleHandwritingFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'application/pdf'
    ];
    
    const validFiles = Array.from(files).filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select image or PDF files only.",
          variant: "destructive",
        });
        return false;
      }
      
      if ((file.type === 'application/pdf' && file.size > 20 * 1024 * 1024) ||
          (file.type !== 'application/pdf' && file.size > 10 * 1024 * 1024)) {
        toast({
          title: "File too large",
          description: "Maximum size is 10MB for images and 20MB for PDFs.",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      const newHandwritingFiles = validFiles.map(file => ({
        file,
        progress: 0,
        status: 'uploading' as const,
      }));

      setHandwritingFiles(prev => [...prev, ...newHandwritingFiles]);
    }
  };

  const handleHandwritingUpload = async () => {
    if (handwritingFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to convert",
        variant: "destructive",
      });
      return;
    }

    setIsHandwritingUploading(true);
    setHandwritingProgress(0);

    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      
      handwritingFiles.forEach(file => formData.append('files', file.file));
      if (pdfFileName.trim()) {
        formData.append('pdfFileName', pdfFileName.trim());
      }
      
      // Add direct save parameter
      formData.append('directSave', 'true');


      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 50); // Upload is 50% of total progress
          setHandwritingProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              setHandwritingProgress(100);
              
              // Direct save - no preview dialog needed
              console.log('Handwriting conversion and save response:', response.data);
              
              toast({
                title: "Success",
                description: response.message || "Handwriting converted and saved successfully",
              });
              
              setHandwritingFiles([]);
              setPdfFileName('');
              
              // Trigger upload complete callback to refresh file list
              if (onUploadComplete) {
                onUploadComplete();
              }
            } else {
              toast({
                title: "Error",
                description: response.message || "Failed to convert handwriting",
                variant: "destructive",
              });
            }
          } catch (parseError) {
            toast({
              title: "Error",
              description: "Failed to parse response",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Error",
            description: "Failed to convert handwriting",
            variant: "destructive",
          });
        }
        setIsHandwritingUploading(false);
      });

      xhr.addEventListener('error', () => {
        toast({
          title: "Error",
          description: "Network error occurred",
          variant: "destructive",
        });
        setIsHandwritingUploading(false);
      });

      xhr.open('POST', buildApiUrl(API_ENDPOINTS.HANDWRITING.UPLOAD(workspaceId.toString())));
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
      setIsHandwritingUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeHandwritingFile = (index: number) => {
    setHandwritingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // This will be handled by the specific tab content
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSaveComplete = () => {
    onUploadComplete?.();
  };

  return (
    <>
      <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Files
        </CardTitle>
        <CardDescription>
          Choose between direct PDF upload or convert handwritten content to LaTeX PDF
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Direct Upload
            </TabsTrigger>
            <TabsTrigger value="handwriting" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Handwriting
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileSelect(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drop PDF files here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse files
              </p>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Select PDF Files
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />

            {uploadingFiles.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Uploading Files</h4>
                {uploadingFiles.map((file, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm">{file.file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(file.file.size)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'success' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {file.status === 'error' && file.error && (
                      <p className="text-xs text-red-500 mt-1">{file.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="handwriting" className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleHandwritingFileSelect(e.dataTransfer.files);
              }}
              onClick={() => handwritingFileInputRef.current?.click()}
            >
              <PenTool className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drop handwritten images here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse files (images or PDFs)
              </p>
              <Button variant="outline">
                <Image className="h-4 w-4 mr-2" />
                Select Images/PDFs
              </Button>
            </div>

            <input
              ref={handwritingFileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => handleHandwritingFileSelect(e.target.files)}
              className="hidden"
            />

            {handwritingFiles.length > 0 && (
              <div className="space-y-4">

                
                <div>
                  <label className="block text-sm font-medium">Output PDF Name (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Math_Notes"
                    value={pdfFileName}
                    onChange={(e) => setPdfFileName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <Button
                  onClick={handleHandwritingUpload}
                  disabled={isHandwritingUploading}
                  className="mt-6"
                >
                  {isHandwritingUploading ? 'Converting...' : 'Convert to PDF'}
                </Button>

                {isHandwritingUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>Converting handwriting to LaTeX PDF...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="font-medium">Selected Files</h4>
                  {handwritingFiles.map((file, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileImage className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-sm">{file.file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({formatFileSize(file.file.size)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'success' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {file.status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHandwritingFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {file.status === 'error' && file.error && (
                        <p className="text-xs text-red-500 mt-1">{file.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>


  </>
  );
}; 