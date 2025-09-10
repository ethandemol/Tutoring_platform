import React, { useState, useEffect } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Document, Page, pdfjs } from 'react-pdf';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useToast } from '@/hooks/use-toast';
import { Download, Eye, FileText, Image, Save, X } from 'lucide-react';


// Set workerSrc for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

interface HandwritingPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  convertedPdf: any;
  rawPdf: any;
  workspaceId: number;
  onSaveComplete: () => void;
}

interface PdfPreviewProps {
  pdfData: any;
  title: string;
  description: string;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ 
  pdfData, 
  title, 
  description, 
  isSelected, 
  onSelectionChange 
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully:', { numPages, title });
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    console.error('PDF data:', pdfData);
    setError('Failed to load PDF');
    setIsLoading(false);
  };

  const goToPreviousPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages || 1, prev + 1));
  };

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`select-${title.toLowerCase()}`}
            checked={isSelected}
            onCheckedChange={onSelectionChange}
          />
          <Label htmlFor={`select-${title.toLowerCase()}`} className="text-lg font-semibold">
            {title}
          </Label>
        </div>
        <div className="text-sm text-muted-foreground">
          {pdfData.fileSize ? `${(pdfData.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      
      <div className="border border-border rounded-lg overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p>Failed to load PDF</p>
            </div>
          </div>
        )}
        
        {!isLoading && !error && (
          <div className="bg-muted p-4">
            <Document
              file={`${buildApiUrl(API_ENDPOINTS.HANDWRITING.PREVIEW_PDF)}?token=${localStorage.getItem('authToken')}&s3Key=${pdfData.s3Key}`}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={Math.min(600, window.innerWidth - 100)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
            
            {numPages && numPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={pageNumber <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pageNumber} of {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const HandwritingPreviewDialog: React.FC<HandwritingPreviewDialogProps> = ({
  isOpen,
  onClose,
  convertedPdf,
  rawPdf,
  workspaceId,
  onSaveComplete
}) => {
  console.log('HandwritingPreviewDialog props:', { convertedPdf, rawPdf, workspaceId });
  const [selectedConverted, setSelectedConverted] = useState(true);
  const [selectedRaw, setSelectedRaw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!selectedConverted && !selectedRaw) {
      toast({
        title: "No files selected",
        description: "Please select at least one PDF to save",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.HANDWRITING.SAVE_PDFS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          convertedPdf: selectedConverted ? convertedPdf : null,
          rawPdf: selectedRaw ? rawPdf : null,
          workspaceId
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message || "PDFs saved successfully",
        });
        onSaveComplete();
        onClose();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to save PDFs",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return; // Prevent closing while saving
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview Handwriting Conversion
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Review your converted handwriting files. Select which version(s) you'd like to save to your workspace.
          </div>
          
          <Tabs defaultValue="converted" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="converted">Converted PDF</TabsTrigger>
              <TabsTrigger value="raw">Raw PDF</TabsTrigger>
            </TabsList>
            
            <TabsContent value="converted" className="mt-6">
              <PdfPreview
                pdfData={convertedPdf}
                title="Converted PDF"
                description="LaTeX-converted version with clean, searchable text"
                isSelected={selectedConverted}
                onSelectionChange={setSelectedConverted}
              />
            </TabsContent>
            
            <TabsContent value="raw" className="mt-6">
              <PdfPreview
                pdfData={rawPdf}
                title="Raw PDF"
                description="Original handwriting preserved as-is"
                isSelected={selectedRaw}
                onSelectionChange={setSelectedRaw}
              />
            </TabsContent>
          </Tabs>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedConverted && selectedRaw ? 'Both PDFs selected' :
               selectedConverted ? 'Converted PDF selected' :
               selectedRaw ? 'Raw PDF selected' : 'No PDFs selected'}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || (!selectedConverted && !selectedRaw)}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Selected
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>


    </Dialog>
  );
}; 