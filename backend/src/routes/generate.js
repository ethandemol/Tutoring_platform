import express from 'express';
import { generatePdf } from '../utils/renderPdf.js';
import { authenticate } from '../middleware/auth.js';
import { uploadToS3, generateGeneratedFileKey } from '../config/s3.js';
import { File, Workspace, ChatSession } from '../models/index.js';
import contentGenerationService from '../services/contentGenerationService.js';

const router = express.Router();

// Generate content from workspace
router.post('/content', authenticate, async (req, res) => {
  try {
    const { workspaceId, type, fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID and content type are required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    let generatedContent;
    let contentType;

    // Generate content based on type with intelligent content selection
    switch (type) {
      case 'exam':
        generatedContent = await contentGenerationService.generateExam(workspace.name, workspaceId, userId, fileIds);
        contentType = 'Exam Questions';
        break;
      case 'quiz':
        generatedContent = await contentGenerationService.generateQuiz(workspace.name, workspaceId, userId, fileIds);
        contentType = 'Quiz';
        break;
      case 'flashcards':
        generatedContent = await contentGenerationService.generateFlashcards(workspace.name, workspaceId, userId, fileIds);
        contentType = 'Flashcards';
        break;
      case 'cheat_sheet':
        generatedContent = await contentGenerationService.generateCheatSheet(workspace.name, workspaceId, userId, fileIds);
        contentType = 'Cheat Sheet';
        break;
      case 'study_guide':
        generatedContent = await contentGenerationService.generateStudyGuide(workspace.name, workspaceId, userId, fileIds);
        contentType = 'Study Guide';
        break;
      case 'notes':
        generatedContent = await contentGenerationService.generateNotes(workspace.name, workspaceId, userId, fileIds);
        contentType = 'Notes';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
    }

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `${contentType}: ${workspace.name}`,
      courseName: workspace.name,
      content: generatedContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, contentType);
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: contentType,
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      contentType,
      type,
      generatedContent
    );

    res.json({
      success: true,
      message: 'Content generated successfully',
      data: {
        file: fileRecord,
        content: generatedContent
      }
    });

  } catch (error) {
    console.error('Generate content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content: ' + error.message
    });
  }
});

// Helper function to generate short file names
const generateShortFileName = (workspaceName, contentType) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const shortName = workspaceName.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '');
  return `${shortName}_${contentType.replace(/\s+/g, '')}_${timestamp}.pdf`;
};

// Helper function to create file record and start RAG processing
const createFileRecordAndStartRAG = async (fileData, workspaceId, userId, contentType, generationType, generatedContent, sourceFileId = null) => {
  try {
    // Create file record
    const fileRecord = await File.create({
      fileName: fileData.fileName,
      originalName: fileData.fileName,
      fileSize: fileData.fileSize,
      mimeType: 'application/pdf',
      s3Key: fileData.s3Key,
      s3Bucket: fileData.s3Bucket,
      s3Url: fileData.s3Url,
      workspaceId: workspaceId,
      userId: userId,
      category: contentType,
      generationType: generationType,
      sourceFileId: sourceFileId,
      status: 'processed',
      isGenerated: true
    });

    // Start RAG processing for the generated content
    // This will create chunks and embeddings for the generated content
    await contentGenerationService.processGeneratedContent(fileRecord.id, generatedContent, workspaceId, userId);

    return fileRecord;
  } catch (error) {
    console.error('Error creating file record and starting RAG:', error);
    throw error;
  }
};



// Generate exam
router.post('/exam/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace content (with optional file filtering)
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    // Get exam configuration from request body
    const { numMultipleChoice = 5, numShortAnswer = 3, numEssay = 2, totalPoints = 100 } = req.body;
    
    // Validate exam configuration
    if (numMultipleChoice < 0 || numShortAnswer < 0 || numEssay < 0 || totalPoints <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam configuration parameters'
      });
    }
    
    if (numMultipleChoice + numShortAnswer + numEssay === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one question type must be specified'
      });
    }

    // Generate exam using OpenAI with configuration
    const examContent = await contentGenerationService.generateExam(workspace.name, workspaceId, userId, fileIds, {
      numMultipleChoice,
      numShortAnswer,
      numEssay,
      totalPoints
    });

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `Exam: ${workspace.name}`,
      courseName: workspace.name,
      content: examContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, 'Exam');
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: 'Exam',
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      'Exam',
      'exam',
      examContent
    );

    res.json({
      success: true,
      message: 'Exam generated successfully',
      data: {
        file: fileRecord,
        examContent: examContent
      }
    });

  } catch (error) {
    console.error('Generate exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate exam: ' + error.message
    });
  }
});

// Generate quiz
router.post('/quiz/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace content (with optional file filtering)
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    // Get quiz configuration from request body
    const { numQuestions = 10, questionType = 'both' } = req.body;
    
    // Validate quiz configuration
    if (numQuestions < 1 || numQuestions > 50) {
      return res.status(400).json({
        success: false,
        message: 'Number of questions must be between 1 and 50'
      });
    }
    
    if (!['multiple_choice', 'free_response', 'both'].includes(questionType)) {
      return res.status(400).json({
        success: false,
        message: 'Question type must be multiple_choice, free_response, or both'
      });
    }

    // Generate quiz using OpenAI with configuration
    const quizContent = await contentGenerationService.generateQuiz(workspace.name, workspaceId, userId, fileIds, {
      numQuestions,
      questionType
    });

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `Quiz: ${workspace.name}`,
      courseName: workspace.name,
      content: quizContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, 'Quiz');
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: 'Quiz',
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      'Quiz',
      'quiz',
      quizContent
    );

    res.json({
      success: true,
      message: 'Quiz generated successfully',
      data: {
        file: fileRecord,
        quizContent: quizContent
      }
    });

  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz: ' + error.message
    });
  }
});

// Generate flashcards
router.post('/flashcards/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace content (with optional file filtering)
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    // Generate flashcards using OpenAI
    const flashcardsContent = await contentGenerationService.generateFlashcards(workspace.name, workspaceId, userId, fileIds);

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `Flashcards: ${workspace.name}`,
      courseName: workspace.name,
      content: flashcardsContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, 'Flashcards');
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: 'Flashcards',
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      'Flashcards',
      'flashcards',
      flashcardsContent
    );

    res.json({
      success: true,
      message: 'Flashcards generated successfully',
      data: {
        file: fileRecord,
        flashcardsContent: flashcardsContent
      }
    });

  } catch (error) {
    console.error('Generate flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate flashcards: ' + error.message
    });
  }
});

// Generate cheat sheet
router.post('/cheatsheet/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace content (with optional file filtering)
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    // Generate cheat sheet using OpenAI
    const cheatSheetContent = await contentGenerationService.generateCheatSheet(workspace.name, workspaceId, userId, fileIds);

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `Cheat Sheet: ${workspace.name}`,
      courseName: workspace.name,
      content: cheatSheetContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, 'Cheat Sheet');
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: 'Cheat Sheet',
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      'Cheat Sheet',
      'cheat_sheet',
      cheatSheetContent
    );

    res.json({
      success: true,
      message: 'Cheat sheet generated successfully',
      data: {
        file: fileRecord,
        cheatSheetContent: cheatSheetContent
      }
    });

  } catch (error) {
    console.error('Generate cheat sheet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate cheat sheet: ' + error.message
    });
  }
});

// Generate study guide
router.post('/studyguide/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace content (with optional file filtering)
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    // Generate study guide using OpenAI
    const studyGuideContent = await contentGenerationService.generateStudyGuide(workspace.name, workspaceId, userId, fileIds);

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `Study Guide: ${workspace.name}`,
      courseName: workspace.name,
      content: studyGuideContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, 'Study Guide');
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: 'Study Guide',
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      'Study Guide',
      'study_guide',
      studyGuideContent
    );

    res.json({
      success: true,
      message: 'Study guide generated successfully',
      data: {
        file: fileRecord,
        studyGuideContent: studyGuideContent
      }
    });

  } catch (error) {
    console.error('Generate study guide error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate study guide: ' + error.message
    });
  }
});

// Generate notes
router.post('/notes/:workspaceId', authenticate, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      where: { id: workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get workspace content (with optional file filtering)
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    // Generate notes using OpenAI
    const notesContent = await contentGenerationService.generateNotes(workspace.name, workspaceId, userId, fileIds);

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `Notes: ${workspace.name}`,
      courseName: workspace.name,
      content: notesContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, 'Notes');
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, workspaceId, {
      isGenerated: true,
      generationType: 'Notes',
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      workspaceId,
      userId,
      'Notes',
      'notes',
      notesContent
    );

    res.json({
      success: true,
      message: 'Notes generated successfully',
      data: {
        file: fileRecord,
        notesContent: notesContent
      }
    });

  } catch (error) {
    console.error('Generate notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate notes: ' + error.message
    });
  }
});

// Generate content from a single file
router.post('/file/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type } = req.body;
    const userId = req.user.id;

    if (!fileId || !type) {
      return res.status(400).json({
        success: false,
        message: 'File ID and content type are required'
      });
    }

    // Get file
    const file = await File.findOne({
      where: { id: fileId, userId: userId }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get file content
    const fileContent = await contentGenerationService.getFileContent(fileId, userId);
    
    if (!fileContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in file'
      });
    }

    let generatedContent;
    let contentType;

    // Generate content based on type
    switch (type) {
      case 'exam':
        // Get exam configuration from request body
        const { numMultipleChoice = 5, numShortAnswer = 3, numEssay = 2, totalPoints = 100 } = req.body;
        
        // Validate exam configuration
        if (numMultipleChoice < 0 || numShortAnswer < 0 || numEssay < 0 || totalPoints <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid exam configuration parameters'
          });
        }
        
        if (numMultipleChoice + numShortAnswer + numEssay === 0) {
          return res.status(400).json({
            success: false,
            message: 'At least one question type must be specified'
          });
        }

        generatedContent = await contentGenerationService.generateExam(file.originalName, file.workspaceId, userId, [file.id], {
          numMultipleChoice,
          numShortAnswer,
          numEssay,
          totalPoints
        });
        contentType = 'Exam';
        break;
      case 'quiz':
        // Get quiz configuration from request body
        const { numQuestions = 10, questionType = 'both' } = req.body;
        
        // Validate quiz configuration
        if (numQuestions < 1 || numQuestions > 50) {
          return res.status(400).json({
            success: false,
            message: 'Number of questions must be between 1 and 50'
          });
        }
        
        if (!['multiple_choice', 'free_response', 'both'].includes(questionType)) {
          return res.status(400).json({
            success: false,
            message: 'Question type must be multiple_choice, free_response, or both'
          });
        }

        generatedContent = await contentGenerationService.generateQuiz(file.originalName, file.workspaceId, userId, [file.id], {
          numQuestions,
          questionType
        });
        contentType = 'Quiz';
        break;
      case 'flashcards':
        generatedContent = await contentGenerationService.generateFlashcards(file.originalName, file.workspaceId, userId, [file.id]);
        contentType = 'Flashcards';
        break;
      case 'cheat_sheet':
        generatedContent = await contentGenerationService.generateCheatSheet(file.originalName, file.workspaceId, userId, [file.id]);
        contentType = 'Cheat Sheet';
        break;
      case 'study_guide':
        generatedContent = await contentGenerationService.generateStudyGuide(file.originalName, file.workspaceId, userId, [file.id]);
        contentType = 'Study Guide';
        break;
      case 'notes':
        generatedContent = await contentGenerationService.generateNotes(file.originalName, file.workspaceId, userId, [file.id]);
        contentType = 'Notes';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
    }

    // Create PDF using template-based system
    const pdfDoc = await generatePdf({
      type: 'content',
      title: `${contentType}: ${file.originalName}`,
      courseName: file.originalName,
      content: generatedContent
    });

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(file.originalName, contentType);
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfDoc.length,
      buffer: Buffer.from(pdfDoc)
    }, file.workspaceId, {
      isGenerated: true,
      generationType: contentType,
      workspaceName: file.originalName
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfDoc.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: file.originalName
      },
      file.workspaceId,
      userId,
      contentType,
      type,
      generatedContent,
      fileId
    );

    res.json({
      success: true,
      message: 'Content generated successfully',
      data: {
        file: fileRecord,
        content: generatedContent
      }
    });

  } catch (error) {
    console.error('Generate content from file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content: ' + error.message
    });
  }
});

export default router; 