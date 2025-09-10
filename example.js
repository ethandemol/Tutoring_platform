import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { handwritingUpload, handleUploadError } from '../middleware/upload.js';
import { uploadToS3 } from '../config/s3.js';
import AWS from 'aws-sdk';
import File from '../models/File.js';
import Workspace from '../models/Workspace.js';
import OpenAI from 'openai';
import { generatePdf } from './backend/src/utils/renderPdf.js';
import latex from 'node-latex';

const router = express.Router();

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to convert LaTeX content to PDF with proper rendering
const convertLatexToPdf = async (latexContent) => {
  try {
    console.log('🔄 Converting LaTeX to PDF with proper rendering...');
    
    // Clean and sanitize LaTeX content
    const sanitizeLatex = (content) => {
      return content
        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
        .replace(/[\u0080-\u009F]/g, '') // Remove control characters
        .replace(/[^\x20-\x7E]/g, ' ') // Replace other problematic characters with space
        .trim();
    };
    
    const cleanedLatexContent = sanitizeLatex(latexContent);
    
    console.log('📄 LaTeX content to render:', cleanedLatexContent.substring(0, 200) + '...');
    
    // Create a complete LaTeX document
    const fullLatexDocument = `\\documentclass[12pt]{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{geometry}
\\geometry{margin=1in}
\\usepackage{mathtools}
\\usepackage{amsthm}
\\usepackage{amsfonts}
\\usepackage{parskip}
\\setlength{\\parskip}{0.5em}
\\begin{document}

${cleanedLatexContent}

\\end{document}`;

    // Convert LaTeX to PDF using node-latex with minimal configuration
    console.log('🔄 Starting LaTeX to PDF conversion...');
    return new Promise((resolve, reject) => {
      const pdfStream = latex(fullLatexDocument, {
        precompiled: false,
        passes: 1
      });
      
      const chunks = [];
      pdfStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      pdfStream.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log('✅ PDF created successfully with LaTeX rendering, size:', pdfBuffer.length, 'bytes');
        resolve(pdfBuffer);
      });
      
      pdfStream.on('error', (error) => {
        console.error('❌ LaTeX rendering error:', error);
        // Fallback to simple PDF creation if LaTeX rendering fails
        console.log('🔄 Falling back to simple PDF creation...');
        createSimplePdf(cleanedLatexContent).then(resolve).catch(reject);
      });
    });
  } catch (error) {
    console.error('❌ Error converting LaTeX to PDF:', error);
    // Fallback to simple PDF creation
    console.log('🔄 Falling back to simple PDF creation...');
    return createSimplePdf(latexContent);
  }
};

// Fallback function to create a simple PDF using template-based system
const createSimplePdf = async (latexContent) => {
  try {
    console.log('🔄 Creating simple PDF with template-based system...');
    
    // Clean and sanitize LaTeX content to avoid encoding issues
    const sanitizeText = (text) => {
      return text
        .replace(/[^\x20-\x7E]/g, ' ') // Keep printable ASCII characters
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim();
    };
    
    // Sanitize the content
    const cleanedContent = sanitizeText(latexContent);
    
    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: 'Handwritten Content Conversion',
      courseName: 'Converted Content',
      content: cleanedContent
    });
    
    console.log('✅ Simple PDF created successfully with template system, size:', pdfDoc.length, 'bytes');
    return pdfDoc;
  } catch (error) {
    console.error('❌ Error creating simple PDF:', error);
    throw new Error('Failed to create PDF');
  }
};

// Process handwriting upload
router.post('/upload/:workspaceId', authenticate, handwritingUpload.array('files', 10), async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    console.log('Handwriting upload request received:', {
      workspaceId,
      hasFiles: !!req.files,
      fileCount: req.files?.length,
      fileSizes: req.files?.map(f => f.size),
      fileNames: req.files?.map(f => f.originalname)
    });
    
    // Debug: Log the complete file object structure
    if (req.files && req.files.length > 0) {
      console.log('📁 Files object details:', req.files.map(file => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        hasBuffer: !!file.buffer,
        bufferType: typeof file.buffer,
        bufferLength: file.buffer?.length,
        bufferIsBuffer: Buffer.isBuffer(file.buffer),
        fieldname: file.fieldname,
        encoding: file.encoding
      })));
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Verify workspace exists and belongs to user
    const workspace = await Workspace.findOne({
      where: {
        id: workspaceId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!workspace) {
      console.log('Workspace not found:', { workspaceId, userId: req.user.id });
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    console.log('Workspace found:', workspace.name);

    // Process each handwriting image with OpenAI Vision API
    try {
      console.log(`Processing ${req.files.length} handwriting images with OpenAI Vision API...`);
      
      const allLatexContent = [];
      const processedFiles = [];
      
      // Process each file individually
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);
        
        // Convert file buffer to base64
        const base64Image = file.buffer.toString('base64');
        
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert at converting handwritten mathematical content to LaTeX format. 
              
              Instructions:
              1. Analyze the handwritten content in the image
              2. Convert all mathematical expressions, equations, and text to proper LaTeX format
              3. Preserve the structure and organization of the content
              4. Use appropriate LaTeX commands for mathematical symbols, fractions, integrals, etc.
              5. If there's explanatory text, format it properly
              6. Return only the LaTeX code, no explanations or markdown formatting
              
              Examples:
              - Fractions: Use \frac{numerator}{denominator}
              - Integrals: Use \int_{lower}^{upper} expression dx
              - Sums: Use \sum_{i=1}^{n} expression
              - Greek letters: Use \alpha, \beta, \gamma, etc.
              - Subscripts: Use x_1, x_2
              - Superscripts: Use x^2, x^n
              - Square roots: Use \sqrt{expression}
              - Multiple lines: Use align* environment
              
              Return clean, properly formatted LaTeX code.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Convert this handwritten content to LaTeX format. Return only the LaTeX code."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${file.mimetype};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });

        const latexContent = visionResponse.choices[0]?.message?.content;
        
        if (!latexContent) {
          console.log(`Warning: No LaTeX content generated for file ${file.originalname}`);
          continue;
        }

        // Clean and validate LaTeX content - preserve original formatting
        const cleanLatexContent = latexContent
          .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
          .replace(/[\u0080-\u009F]/g, '') // Remove control characters
          .replace(/[^\x20-\x7E]/g, ' ') // Replace other problematic characters with space
          .trim();
        
        if (!cleanLatexContent || cleanLatexContent.length < 10) {
          console.log(`Warning: Insufficient LaTeX content generated for file ${file.originalname}`);
          continue;
        }

        console.log(`Raw LaTeX content from OpenAI:`, latexContent.substring(0, 300) + '...');
        console.log(`Cleaned LaTeX content:`, cleanLatexContent.substring(0, 300) + '...');
        console.log(`Line breaks in raw content: ${(latexContent.match(/\n/g) || []).length} newlines`);
        console.log(`Line breaks in cleaned content: ${(cleanLatexContent.match(/\\\\/g) || []).length} LaTeX line breaks`);
        
        // Add page break between files (except for the first one)
        if (i > 0) {
          allLatexContent.push('\\newpage');
        }
        
        // Add the LaTeX content with proper spacing
        allLatexContent.push(cleanLatexContent);
        allLatexContent.push(''); // Add empty line for spacing
        
        processedFiles.push({
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          latexContent: cleanLatexContent
        });
      }
      
             if (allLatexContent.length === 0) {
         throw new Error('No valid LaTeX content was generated from any of the uploaded images. Please ensure the images contain clear, readable handwritten content.');
       }
      
             // Combine all LaTeX content with proper spacing
       const combinedLatexContent = allLatexContent.join('\n\n');
      console.log('Combined LaTeX content length:', combinedLatexContent.length);

      // Convert combined LaTeX to PDF
      const pdfBytes = await convertLatexToPdf(combinedLatexContent);

      // Get custom filename if provided
      const customFileName = req.body.pdfFileName;
      const defaultFileName = `Handwriting_Combined_${req.files.length}_pages.pdf`;
      const finalFileName = customFileName ? `${customFileName}.pdf` : defaultFileName;
      
      // Upload PDF to S3
      console.log('Uploading combined PDF to S3...');
      const pdfFileName = `handwriting_combined_${Date.now()}.pdf`;
      const pdfS3Result = await uploadToS3({
        originalname: pdfFileName,
        mimetype: 'application/pdf',
        size: pdfBytes.length,
        buffer: Buffer.from(pdfBytes)
      }, workspaceId);

      console.log('PDF S3 upload successful:', pdfS3Result);

      // Create file record for the PDF
      const pdfFileRecord = await File.create({
        originalName: finalFileName,
        fileName: pdfS3Result.fileName,
        fileSize: pdfBytes.length,
        mimeType: 'application/pdf',
        s3Key: pdfS3Result.s3Key,
        s3Bucket: pdfS3Result.s3Bucket,
        s3Url: pdfS3Result.s3Url,
        workspaceId: parseInt(workspaceId),
        userId: req.user.id,
        processingStatus: 'completed',
        metadata: {
          type: 'handwriting_pdf',
          originalImageCount: req.files.length,
          originalImageNames: req.files.map(f => f.originalname),
          originalImageSizes: req.files.map(f => f.size),
          processedAt: new Date().toISOString(),
          combinedLatexContent: combinedLatexContent,
          individualLatexContent: processedFiles.map(f => ({
            fileName: f.name,
            latexContent: f.latexContent
          }))
        }
      });

      console.log('PDF file record created:', pdfFileRecord.id);

      res.status(201).json({
        success: true,
        message: `Handwriting processed successfully and converted to PDF (${req.files.length} images)${customFileName ? ` as "${finalFileName}"` : ''}`,
        data: {
          pdfFile: {
            id: pdfFileRecord.id,
            originalName: pdfFileRecord.originalName,
            fileName: pdfFileRecord.fileName,
            fileSize: pdfFileRecord.fileSize,
            s3Url: pdfFileRecord.s3Url,
            workspaceId: pdfFileRecord.workspaceId,
            processingStatus: pdfFileRecord.processingStatus,
            createdAt: pdfFileRecord.createdAt
          },
          originalImages: processedFiles,
          combinedLatexContent: combinedLatexContent
        }
      });

    } catch (openaiError) {
      console.error('OpenAI Vision API error:', openaiError);
      
      res.status(500).json({
        success: false,
        message: 'Failed to process handwriting. Please ensure the images contain clear, readable handwritten content and try again.',
        error: openaiError.message
      });
    }

  } catch (error) {
    console.error('Handwriting upload error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process handwriting'
    });
  }
}, handleUploadError);

export default router; s