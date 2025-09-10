import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import { handwritingUpload, handleUploadError } from '../middleware/upload.js';
import { uploadToS3, getFileFromS3 } from '../config/s3.js';
import File from '../models/File.js';
import Workspace from '../models/Workspace.js';
import OpenAI from 'openai';
import { generatePdf } from '../utils/renderPdf.js';
import latex from 'node-latex';
import pdfToImageService from '../services/pdfToImageService.js';
import chunkingService from '../services/chunkingServices.js';

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
    console.log('🔍 Checking if pdflatex is available...');
    
    // Check if pdflatex is available
    const { exec } = await import('child_process');
    exec('which pdflatex', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ pdflatex not found in PATH:', error.message);
        console.log('🔍 Current PATH:', process.env.PATH);
        console.log('🔍 PATH components:', process.env.PATH.split(':'));
      } else {
        console.log('✅ pdflatex found at:', stdout.trim());
      }
    });
    
    // Also check if we can run pdflatex directly
    exec('pdflatex --version', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ pdflatex --version failed:', error.message);
        console.log('🔍 stderr:', stderr);
      } else {
        console.log('✅ pdflatex --version succeeded:', stdout.split('\n')[0]);
      }
    });
    
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
        console.log('🔍 Error details:', error.message);
        console.log('🔍 Error stack:', error.stack);
        
        // Try to run pdflatex manually as a fallback
        console.log('🔄 Trying manual pdflatex execution...');
        const { exec } = require('child_process');
        const fs = require('fs');
        const path = require('path');
        
        // Create a temporary directory and files
        const tempDir = '/tmp/latex_temp';
        const texFile = path.join(tempDir, 'document.tex');
        const pdfFile = path.join(tempDir, 'document.pdf');
        
        try {
          // Ensure temp directory exists
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Write LaTeX content to file
          fs.writeFileSync(texFile, fullLatexDocument);
          console.log('📄 Wrote LaTeX content to:', texFile);
          
          // Try different pdflatex paths
          const pdflatexPaths = [
            'pdflatex', // Try PATH first
            '/root/.nix-profile/bin/pdflatex', // Try Nix profile
            '/nix/store/*/bin/pdflatex' // Try Nix store
          ];
          
          let pdflatexCommand = null;
          for (const pdflatexPath of pdflatexPaths) {
            try {
              const { execSync } = require('child_process');
              execSync(`${pdflatexPath} --version`, { stdio: 'pipe' });
              pdflatexCommand = pdflatexPath;
              console.log(`✅ Found pdflatex at: ${pdflatexPath}`);
              break;
            } catch (e) {
              console.log(`❌ pdflatex not found at: ${pdflatexPath}`);
            }
          }
          
          if (!pdflatexCommand) {
            throw new Error('pdflatex not found in any expected location');
          }
          
          // Run pdflatex manually with the found command
          exec(`cd ${tempDir} && ${pdflatexCommand} -interaction=nonstopmode document.tex`, (error, stdout, stderr) => {
            if (error) {
              console.error('❌ Manual pdflatex failed:', error.message);
              console.log('🔍 pdflatex stdout:', stdout);
              console.log('🔍 pdflatex stderr:', stderr);
              // Fallback to simple PDF creation
              console.log('🔄 Falling back to simple PDF creation...');
              createSimplePdf(cleanedLatexContent).then(resolve).catch(reject);
            } else {
              console.log('✅ Manual pdflatex succeeded');
              if (fs.existsSync(pdfFile)) {
                const pdfBuffer = fs.readFileSync(pdfFile);
                console.log('✅ PDF created manually, size:', pdfBuffer.length, 'bytes');
                resolve(pdfBuffer);
              } else {
                console.log('❌ PDF file not found after manual creation');
                createSimplePdf(cleanedLatexContent).then(resolve).catch(reject);
              }
            }
          });
        } catch (fsError) {
          console.error('❌ File system error:', fsError.message);
          createSimplePdf(cleanedLatexContent).then(resolve).catch(reject);
        }
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

// Update handwritingFileFilter to allow PDFs as well as images
const allowedTypes = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'application/pdf'
];

// Process handwriting upload
router.post('/upload/:workspaceId', authenticate, handwritingUpload.array('files', 10), async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Validate workspaceId
    if (isNaN(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid workspace ID. Please provide a valid numeric workspace ID.'
      });
    }
    
    const { directSave = false, category = 'Others' } = req.body; // Add directSave parameter
    
    console.log('Handwriting upload request received:', {
      workspaceId,
      hasFiles: !!req.files,
      fileCount: req.files?.length,
      fileSizes: req.files?.map(f => f.size),
      fileNames: req.files?.map(f => f.originalname),
      directSave,
      category
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

    // Check for PDF files and convert them to images
    let allImageFiles = [];
    for (const file of req.files) {
      if (file.mimetype === 'application/pdf') {
        // Convert PDF to images
        const images = await pdfToImageService.convertPdfToImages(file.buffer);
        // Each image: { pageNumber, buffer }
        for (const img of images) {
          allImageFiles.push({
            originalname: `${file.originalname}_page${img.pageNumber}.png`,
            mimetype: 'image/png',
            size: img.buffer.length,
            buffer: img.buffer,
            fieldname: file.fieldname,
            encoding: file.encoding
          });
        }
      } else {
        // Already an image
        allImageFiles.push(file);
      }
    }

    if (allImageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid images found in uploaded files.'
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
      console.log(`Processing ${allImageFiles.length} handwriting images with OpenAI Vision API...`);
      
      const allLatexContent = [];
      const processedFiles = [];
      
      // Process each file individually
      for (let i = 0; i < allImageFiles.length; i++) {
        const file = allImageFiles[i];
        console.log(`Processing file ${i + 1}/${allImageFiles.length}: ${file.originalname}`);
        
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
              7. Use less than and greater than as plain text (wrapped in \text{}), not symbols
              8. Check for duplicated spacing errors before returning the LaTeX code

              
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
        
        // Second GPT call to check and fix LaTeX errors
        console.log(`🔧 Checking and fixing LaTeX errors for file ${file.originalname}...`);
        const fixResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert LaTeX compiler and validator. Your task is to check and fix any errors in the provided LaTeX text that's going to be rendered into PDF.

CRITICAL: This LaTeX content will be inserted into a complete LaTeX document structure, so you must:
1. REMOVE any document-level commands like \\documentclass, \\usepackage, \\begin{document}, \\end{document}
2. REMOVE any preamble commands that should only appear at the top of a LaTeX document
3. Keep only the content that should go inside the document body

Instructions:
1. Analyze the LaTeX content for syntax errors, missing braces, unclosed environments, etc.
2. Fix any compilation errors you find
3. Ensure all mathematical expressions are properly formatted
4. Check for balanced braces and proper LaTeX syntax
5. Remove any document structure commands (\\documentclass, \\usepackage, \\begin{document}, \\end{document})
6. Remove \text{} for plain text and only wrap math symbols in math mode
7. Output ONLY the fully cleaned-up and compilable version of the LaTeX content
8. Do NOT include any explanatory text, comments, or markdown formatting
9. Return only the corrected LaTeX code that can be directly inserted into a document body. `
            },
            {
              role: "user",
              content: `Check and fix any errors in this LaTeX text that's going to be rendered into PDF. Remove any document structure commands and ensure all math commands are properly wrapped in math mode. Output a fully cleaned-up and compilable version of your LaTeX block only. No explanatory text.

Pay special attention to:
- Remove \text{} for plain text and only wrap math symbols in math mode
- Math commands like \\bar, \\frac, \\sum, \\int that must be in math mode
- Wrap standalone math symbols in \\( \\) or \\[ \\] delimiters
- Fix any math commands that appear outside of math mode


LaTeX content to fix:
${cleanLatexContent}`
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });

        const fixedLatexContent = fixResponse.choices[0]?.message?.content;
        
        if (!fixedLatexContent) {
          console.log(`Warning: No fixed LaTeX content generated for file ${file.originalname}, using original`);
          var finalLatexContent = cleanLatexContent;
        } else {
          console.log(`✅ LaTeX errors fixed for file ${file.originalname}`);
          console.log(`Fixed LaTeX content:`, fixedLatexContent.substring(0, 300) + '...');
          var finalLatexContent = fixedLatexContent.trim();
        }
        
        // Add page break between files (except for the first one)
        if (i > 0) {
          allLatexContent.push('\\newpage');
        }
        
        // Add the LaTeX content with proper spacing
        allLatexContent.push(finalLatexContent);
        allLatexContent.push(''); // Add empty line for spacing
        
        processedFiles.push({
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          latexContent: finalLatexContent
        });
      }
      
             if (allLatexContent.length === 0) {
         throw new Error('No valid LaTeX content was generated from any of the uploaded images. Please ensure the images contain clear, readable handwritten content.');
       }
      
             // Combine all LaTeX content with proper spacing
       const combinedLatexContent = allLatexContent.join('\n\n');
      console.log('Combined LaTeX content length:', combinedLatexContent.length);

      // Convert combined LaTeX to PDF
      console.log('🔍 [DEBUG] Final LaTeX content to render:');
      console.log('--- START OF LATEX ---');
      console.log(combinedLatexContent.substring(0, 500));
      console.log('--- END OF LATEX ---');
      
      const pdfBytes = await convertLatexToPdf(combinedLatexContent);

      // Get custom filename if provided
      const customFileName = req.body.pdfFileName;
      const defaultFileName = `Handwriting_Combined_${req.files.length}_pages.pdf`;
      const finalFileName = customFileName ? `${customFileName}.pdf` : defaultFileName;
      
      // Create both converted PDF and raw PDF for preview
      console.log('Creating PDFs for preview...');
      
      // Converted PDF (LaTeX to PDF)
      const convertedPdfBytes = await convertLatexToPdf(combinedLatexContent);
      const convertedPdfFileName = `handwriting_converted_${Date.now()}.pdf`;
      const convertedPdfS3Result = await uploadToS3({
        originalname: convertedPdfFileName,
        mimetype: 'application/pdf',
        size: convertedPdfBytes.length,
        buffer: Buffer.from(convertedPdfBytes)
      }, workspaceId);

      // Raw PDF (original images combined)
      const rawPdfBytes = await createSimplePdf(combinedLatexContent);
      const rawPdfFileName = `handwriting_raw_${Date.now()}.pdf`;
      const rawPdfS3Result = await uploadToS3({
        originalname: rawPdfFileName,
        mimetype: 'application/pdf',
        size: rawPdfBytes.length,
        buffer: Buffer.from(rawPdfBytes)
      }, workspaceId);

      console.log('PDFs created for preview:', {
        converted: convertedPdfS3Result.s3Key,
        raw: rawPdfS3Result.s3Key
      });

      if (directSave) {
        console.log('Saving converted PDF directly to database...');
        const convertedFileRecord = await File.create({
          originalName: finalFileName || 'Converted_Handwriting.pdf',
          fileName: convertedPdfS3Result.fileName,
          fileSize: convertedPdfBytes.length,
          mimeType: 'application/pdf',
          s3Key: convertedPdfS3Result.s3Key,
          s3Bucket: convertedPdfS3Result.s3Bucket,
          s3Url: convertedPdfS3Result.s3Url,
          workspaceId: parseInt(workspaceId),
          userId: req.user.id,
          category: category,
          processingStatus: 'pending',
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
        console.log('Converted PDF saved with ID:', convertedFileRecord.id);

        // Start RAG processing in the background
        setImmediate(async () => {
          try {
            console.log(`🔄 Starting RAG processing for converted handwriting file ${convertedFileRecord.id}`);
            await chunkingService.processFile(convertedFileRecord.id, req.user.id, parseInt(workspaceId));
            console.log(`✅ RAG processing completed for converted handwriting file ${convertedFileRecord.id}`);
          } catch (error) {
            console.error(`❌ RAG processing failed for converted handwriting file ${convertedFileRecord.id}:`, error);
            await File.update({
              processingStatus: 'failed',
              metadata: {
                ...convertedFileRecord.metadata,
                ragError: error.message,
                ragFailedAt: new Date().toISOString()
              }
            }, { where: { id: convertedFileRecord.id } });
          }
        });

        res.status(201).json({
          success: true,
          message: `Handwriting processed successfully and converted to PDF (${req.files.length} images)${customFileName ? ` as "${finalFileName}"` : ''}`,
          data: {
            id: convertedFileRecord.id,
            originalName: convertedFileRecord.originalName,
            fileName: convertedFileRecord.fileName,
            fileSize: convertedFileRecord.fileSize,
            s3Url: convertedFileRecord.s3Url,
            workspaceId: convertedFileRecord.workspaceId,
            processingStatus: convertedFileRecord.processingStatus,
            createdAt: convertedFileRecord.createdAt,
            category: convertedFileRecord.category,
            metadata: convertedFileRecord.metadata
          }
        });
      } else {
        res.status(201).json({
          success: true,
          message: `Handwriting processed successfully (${req.files.length} images)${customFileName ? ` as "${finalFileName}"` : ''}`,
          data: {
            convertedPdf: {
              originalName: `${finalFileName || 'Converted_Handwriting'}.pdf`,
              fileName: convertedPdfS3Result.fileName,
              fileSize: convertedPdfBytes.length,
              s3Key: convertedPdfS3Result.s3Key,
              s3Bucket: convertedPdfS3Result.s3Bucket,
              s3Url: convertedPdfS3Result.s3Url,
              workspaceId: parseInt(workspaceId),
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
            },
            rawPdf: {
              originalName: `${finalFileName || 'Raw_Handwriting'}_raw.pdf`,
              fileName: rawPdfS3Result.fileName,
              fileSize: rawPdfBytes.length,
              s3Key: rawPdfS3Result.s3Key,
              s3Bucket: rawPdfS3Result.s3Bucket,
              s3Url: rawPdfS3Result.s3Url,
              workspaceId: parseInt(workspaceId),
              metadata: {
                type: 'handwriting_pdf',
                originalImageCount: req.files.length,
                originalImageNames: req.files.map(f => f.originalname),
                originalImageSizes: req.files.map(f => f.size),
                processedAt: new Date().toISOString(),
                isRawVersion: true
              }
            },
            originalImages: processedFiles,
            combinedLatexContent: combinedLatexContent
          }
        });
      }

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

// Save selected PDF(s) to database
router.post('/save-pdfs', authenticate, async (req, res) => {
  try {
    const { convertedPdf, rawPdf, workspaceId, category } = req.body;
    const userId = req.user.id;

    // Validate workspaceId
    const parsedWorkspaceId = parseInt(workspaceId);
    if (isNaN(parsedWorkspaceId) || parsedWorkspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid workspace ID. Please provide a valid numeric workspace ID.'
      });
    }

    console.log('Saving selected PDFs:', {
      saveConverted: !!convertedPdf,
      saveRaw: !!rawPdf,
      workspaceId: parsedWorkspaceId,
      userId
    });

    const savedFiles = [];

    // Save converted PDF if selected
    if (convertedPdf) {
      console.log('Saving converted PDF...');
      const convertedFileRecord = await File.create({
        originalName: convertedPdf.originalName,
        fileName: convertedPdf.fileName,
        fileSize: convertedPdf.fileSize,
        mimeType: 'application/pdf',
        s3Key: convertedPdf.s3Key,
        s3Bucket: convertedPdf.s3Bucket,
        s3Url: convertedPdf.s3Url,
        workspaceId: parsedWorkspaceId,
        userId: userId,
        category: category || 'Others',
        processingStatus: 'pending',
        metadata: convertedPdf.metadata
      });

      console.log('Converted PDF saved with ID:', convertedFileRecord.id);

      // Start RAG processing in the background
      setImmediate(async () => {
        try {
          console.log(`🔄 Starting RAG processing for converted handwriting file ${convertedFileRecord.id}`);
          await chunkingService.processFile(convertedFileRecord.id, userId, parsedWorkspaceId);
          console.log(`✅ RAG processing completed for converted handwriting file ${convertedFileRecord.id}`);
        } catch (error) {
          console.error(`❌ RAG processing failed for converted handwriting file ${convertedFileRecord.id}:`, error);
          await File.update({
            processingStatus: 'failed',
            metadata: {
              ...convertedFileRecord.metadata,
              ragError: error.message,
              ragFailedAt: new Date().toISOString()
            }
          }, { where: { id: convertedFileRecord.id } });
        }
      });

      savedFiles.push({
        id: convertedFileRecord.id,
        originalName: convertedFileRecord.originalName,
        fileName: convertedFileRecord.fileName,
        fileSize: convertedFileRecord.fileSize,
        s3Url: convertedFileRecord.s3Url,
        workspaceId: convertedFileRecord.workspaceId,
        processingStatus: convertedFileRecord.processingStatus,
        createdAt: convertedFileRecord.createdAt,
        type: 'converted'
      });
    }

    // Save raw PDF if selected
    if (rawPdf) {
      console.log('Saving raw PDF...');
      const rawFileRecord = await File.create({
        originalName: rawPdf.originalName,
        fileName: rawPdf.fileName,
        fileSize: rawPdf.fileSize,
        mimeType: 'application/pdf',
        s3Key: rawPdf.s3Key,
        s3Bucket: rawPdf.s3Bucket,
        s3Url: rawPdf.s3Url,
        workspaceId: parsedWorkspaceId,
        userId: userId,
        category: category || 'Others',
        processingStatus: 'pending',
        metadata: rawPdf.metadata
      });

      console.log('Raw PDF saved with ID:', rawFileRecord.id);

      // Start RAG processing in the background
      setImmediate(async () => {
        try {
          console.log(`🔄 Starting RAG processing for raw handwriting file ${rawFileRecord.id}`);
          await chunkingService.processFile(rawFileRecord.id, userId, parsedWorkspaceId);
          console.log(`✅ RAG processing completed for raw handwriting file ${rawFileRecord.id}`);
        } catch (error) {
          console.error(`❌ RAG processing failed for raw handwriting file ${rawFileRecord.id}:`, error);
          await File.update({
            processingStatus: 'failed',
            metadata: {
              ...rawFileRecord.metadata,
              ragError: error.message,
              ragFailedAt: new Date().toISOString()
            }
          }, { where: { id: rawFileRecord.id } });
        }
      });

      savedFiles.push({
        id: rawFileRecord.id,
        originalName: rawFileRecord.originalName,
        fileName: rawFileRecord.fileName,
        fileSize: rawFileRecord.fileSize,
        s3Url: rawFileRecord.s3Url,
        workspaceId: rawFileRecord.workspaceId,
        processingStatus: rawFileRecord.processingStatus,
        createdAt: rawFileRecord.createdAt,
        type: 'raw'
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully saved ${savedFiles.length} PDF file(s)`,
      data: {
        savedFiles
      }
    });

  } catch (error) {
    console.error('Save PDFs error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save PDF files'
    });
  }
});

// Preview PDF endpoint
router.get('/preview-pdf', async (req, res) => {
  try {
    const { token, s3Key } = req.query;
    
    if (!token || !s3Key) {
      return res.status(400).json({
        success: false,
        message: 'Token and s3Key are required'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get file from S3
    const fileBuffer = await getFileFromS3(s3Key);
    
    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow iframe embedding
    
    // Add CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Send the PDF
    res.send(fileBuffer);

  } catch (error) {
    console.error('Preview PDF error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to load PDF'
    });
  }
});

export default router; 