import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadToS3, generateGeneratedFileKey } from '../config/s3.js';
import { File, Workspace } from '../models/index.js';
import contentGenerationService from '../services/contentGenerationService.js';
import chunkingService from '../services/chunkingServices.js';
import { generatePdf, warmup } from '../utils/renderPdf.js';

const router = express.Router();

// Warm up the PDF renderer on startup
warmup().catch(console.error);

// Helper function to generate shorter file names
const generateShortFileName = (workspaceName, contentType) => {
  const cleanWorkspaceName = workspaceName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20);
  
  const now = new Date();
  const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  
  const shortType = contentType === 'Practice Questions' ? 'Practice' : contentType;
  
  return `${cleanWorkspaceName}_${shortType}_${dateStr}.pdf`;
};

// Helper function to create file record and start RAG processing
const createFileRecordAndStartRAG = async (fileData, workspaceId, userId, contentType, generationType, generatedContent, sourceFileId = null) => {
  const fileRecord = await File.create({
    originalName: fileData.fileName,
    fileName: fileData.fileName,
    fileSize: fileData.fileSize,
    mimeType: 'application/pdf',
    s3Key: fileData.s3Key,
    s3Bucket: fileData.s3Bucket,
    s3Url: fileData.s3Url,
    workspaceId: workspaceId,
    userId: userId,
    category: contentType,
    isProcessed: false,
    processingStatus: 'pending',
    metadata: {
      type: 'generated',
      generationType: generationType,
      sourceWorkspace: fileData.workspaceName,
      generatedAt: new Date().toISOString(),
      content: generatedContent,
      ...(sourceFileId && { sourceFileId: sourceFileId })
    }
  });

  // Start automatic RAG processing in the background
  setImmediate(async () => {
    try {
      console.log(`🔄 Starting automatic RAG processing for generated file ${fileRecord.id}`);
      await chunkingService.processFile(fileRecord.id, userId, workspaceId);
      console.log(`✅ Automatic RAG processing completed for generated file ${fileRecord.id}`);
    } catch (error) {
      console.error(`❌ Automatic RAG processing failed for generated file ${fileRecord.id}:`, error);
      await File.update({
        processingStatus: 'failed',
        metadata: {
          ...fileRecord.metadata,
          error: error.message,
          failedAt: new Date().toISOString()
        }
      }, { where: { id: fileRecord.id } });
    }
  });

  return fileRecord;
};

// Helper function to convert content to JSON format for templates
const convertContentToJson = (type, workspaceName, generatedContent, options = {}) => {
  const baseData = {
    title: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${workspaceName}`,
    courseName: workspaceName
  };

  switch (type) {
    case 'exam':
      // Extract answer key content from the generated content, excluding the AI's title
      const answerKeyMatch = generatedContent.match(/(?:================================================================================\s*ANSWER KEY\s*================================================================================|ANSWER KEY|SOLUTIONS)(.*)/s);
      let answerKeyContent = '';
      
      if (answerKeyMatch) {
        answerKeyContent = answerKeyMatch[1].trim();
        // Remove any remaining "ANSWER KEY" text that might be in the content
        answerKeyContent = answerKeyContent.replace(/^.*?ANSWER KEY.*?\n/s, '');
        answerKeyContent = answerKeyContent.replace(/================================================================================/g, '');
      }
      
      // Parse answer key content into structured format
      const parsedAnswerKey = parseAnswerKeyContent(answerKeyContent);
      
      // Remove duplicate answer key content from the questions section
      let questionsContent = generatedContent;
      // Remove any content that looks like answer key (Question 11, 12, etc.) from the questions
      questionsContent = questionsContent.replace(/\nQuestion 1[0-9].*?(?=\nQuestion [0-9]|$)/gs, '');
      questionsContent = questionsContent.replace(/\nQuestion 2[0-9].*?(?=\nQuestion [0-9]|$)/gs, '');
      // Also remove any "ANSWER KEY" sections that appear before the final one
      questionsContent = questionsContent.replace(/================================================================================\s*ANSWER KEY\s*================================================================================.*?(?=================================================================================\s*ANSWER KEY\s*================================================================================|$)/gs, '');
      
      return {
        ...baseData,
        type: 'exam',
        instructions: [
          'Answer all questions',
          'Show your work for partial credit',
          'Time limit: 90 minutes'
        ],
        questions: parseExamQuestions(questionsContent),
        answerKeyContent: answerKeyContent,
        parsedAnswerKey: parsedAnswerKey
      };

    case 'quiz':
      // Extract answer key content from the generated content, excluding the AI's title
      const quizAnswerKeyMatch = generatedContent.match(/(?:================================================================================\s*ANSWER KEY\s*================================================================================|ANSWER KEY|SOLUTIONS)(.*)/s);
      let quizAnswerKeyContent = '';
      
      if (quizAnswerKeyMatch) {
        quizAnswerKeyContent = quizAnswerKeyMatch[1].trim();
        // Remove any remaining "ANSWER KEY" text that might be in the content
        quizAnswerKeyContent = quizAnswerKeyContent.replace(/^.*?ANSWER KEY.*?\n/s, '');
        quizAnswerKeyContent = quizAnswerKeyContent.replace(/================================================================================/g, '');
      }
      
      // Parse answer key content into structured format
      const parsedQuizAnswerKey = parseAnswerKeyContent(quizAnswerKeyContent);
      
      // Remove duplicate answer key content from the questions section
      let quizQuestionsContent = generatedContent;
      
      // Remove any "ANSWER KEY" or "SOLUTIONS" sections from the questions content
      quizQuestionsContent = quizQuestionsContent.replace(/(?:================================================================================\s*)?(?:ANSWER KEY|SOLUTIONS)(?:\s*================================================================================)?.*$/s, '');
      
      // Remove any content that looks like answer key (Question 11, 12, etc.) from the questions
      quizQuestionsContent = quizQuestionsContent.replace(/\nQuestion 1[0-9].*?(?=\nQuestion [0-9]|$)/gs, '');
      quizQuestionsContent = quizQuestionsContent.replace(/\nQuestion 2[0-9].*?(?=\nQuestion [0-9]|$)/gs, '');
      
      // Remove any remaining "SOLUTIONS" sections
      quizQuestionsContent = quizQuestionsContent.replace(/\nSOLUTIONS.*$/s, '');
      
      // Clean up any trailing whitespace
      quizQuestionsContent = quizQuestionsContent.trim();
      
      return {
        ...baseData,
        type: 'quiz',
        questions: parseQuizQuestions(quizQuestionsContent, options),
        answerKeyContent: quizAnswerKeyContent,
        parsedAnswerKey: parsedQuizAnswerKey
      };

    case 'flashcards':
      return {
        ...baseData,
        type: 'flashcards',
        flashcards: parseFlashcards(generatedContent)
      };

    case 'cheat_sheet':
      return {
        ...baseData,
        type: 'cheatsheet',
        sections: parseCheatSheetSections(generatedContent)
      };

    case 'notes':
      return {
        ...baseData,
        type: 'notes',
        toc: parseTableOfContents(generatedContent),
        sections: parseNotesSections(generatedContent)
      };

    case 'practice_questions':
      return {
        ...baseData,
        type: 'practice',
        questions: parsePracticeQuestions(generatedContent)
      };

    case 'study_guide':
      return {
        ...baseData,
        type: 'studyguide',
        toc: parseTableOfContents(generatedContent),
        chapters: parseStudyGuideChapters(generatedContent)
      };

    default:
      throw new Error(`Unsupported content type: ${type}`);
  }
};

// Helper function to fix spacing issues in text
const fixTextSpacing = (text) => {
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
    .trim();
};

// Helper function to clean LaTeX formatting
const cleanLatexFormatting = (text) => {
  return text
    .replace(/\\text\{([^}]+)\}/g, '$1') // Convert \text{} to plain text
    .replace(/\\textit\{([^}]+)\}/g, '$1') // Convert \textit{} to plain text
    .replace(/\\emph\{([^}]+)\}/g, '$1') // Convert \emph{} to plain text
    // Clean up any remaining LaTeX artifacts
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '') // Remove other LaTeX commands
    .replace(/\\[a-zA-Z]+/g, '') // Remove standalone LaTeX commands
    .trim();
};

// Parse answer key content into structured format
const parseAnswerKeyContent = (content) => {
  if (!content || !content.trim()) return null;
  
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentAnswer = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check for section headers
    if (trimmedLine.match(/^(MULTIPLE CHOICE|SHORT ANSWER|ESSAY|FREE RESPONSE)\s+SOLUTIONS?$/i)) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        type: trimmedLine.split(' ')[0].toLowerCase(),
        answers: []
      };
      continue;
    }
    
    // Check for question headers
    const questionMatch = trimmedLine.match(/^Question\s+(\d+):$/i);
    if (questionMatch) {
      if (currentAnswer) {
        currentSection?.answers.push(currentAnswer);
      }
      currentAnswer = {
        questionNumber: parseInt(questionMatch[1]),
        answer: '',
        explanation: '',
        keyPoints: [],
        gradingCriteria: []
      };
      continue;
    }
    
    // Check for answer patterns
    if (currentAnswer) {
      if (trimmedLine.match(/^ANSWER:\s*(.+)$/i)) {
        currentAnswer.answer = trimmedLine.replace(/^ANSWER:\s*/i, '').trim();
      } else if (trimmedLine.match(/^EXPLANATION:\s*(.+)$/i)) {
        currentAnswer.explanation = trimmedLine.replace(/^EXPLANATION:\s*/i, '').trim();
      } else if (trimmedLine.match(/^SAMPLE ANSWER:\s*(.+)$/i)) {
        currentAnswer.answer = trimmedLine.replace(/^SAMPLE ANSWER:\s*/i, '').trim();
      } else if (trimmedLine.match(/^KEY POINTS:$/i)) {
        // Start collecting key points
        currentAnswer.collectingKeyPoints = true;
      } else if (trimmedLine.match(/^GRADING CRITERIA:$/i)) {
        // Start collecting grading criteria
        currentAnswer.collectingKeyPoints = false;
        currentAnswer.collectingGradingCriteria = true;
      } else if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        const point = trimmedLine.replace(/^[•\-]\s*/, '').trim();
        if (currentAnswer.collectingKeyPoints) {
          currentAnswer.keyPoints.push(point);
        } else if (currentAnswer.collectingGradingCriteria) {
          currentAnswer.gradingCriteria.push(point);
        }
      } else if (currentAnswer.collectingKeyPoints || currentAnswer.collectingGradingCriteria) {
        // Continue the previous point if it spans multiple lines
        const target = currentAnswer.collectingKeyPoints ? currentAnswer.keyPoints : currentAnswer.gradingCriteria;
        if (target.length > 0) {
          target[target.length - 1] += ' ' + trimmedLine;
        }
      } else if (currentAnswer.answer && !currentAnswer.explanation) {
        // If we have an answer but no explanation, this might be the explanation
        currentAnswer.explanation = trimmedLine;
      }
    }
  }
  
  // Add the last answer and section
  if (currentAnswer) {
    currentSection?.answers.push(currentAnswer);
  }
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
};

// Parse functions for different content types
const parseExamQuestions = (content) => {
  console.log('🔍 Raw exam content:', content.substring(0, 500) + '...');
  const questions = [];
  
  // Split content into sections
  const sections = content.split(/(?=^(?:MULTIPLE CHOICE|SHORT ANSWER|ESSAY QUESTIONS|SOLUTIONS))/m);
  
  // Find the question sections (exclude solutions)
  const questionSections = sections.filter(section => 
    !section.trim().startsWith('SOLUTIONS') && 
    (section.trim().startsWith('MULTIPLE CHOICE') || 
     section.trim().startsWith('SHORT ANSWER') || 
     section.trim().startsWith('ESSAY QUESTIONS'))
  );
  
  if (questionSections.length === 0) {
    // Fallback: try to parse the entire content as questions
    const questionBlocks = content.split(/(?=^\d+\.)/m);
    
    questionBlocks.forEach(block => {
      if (!block.trim()) return;
      
      // Extract question number and content
      const questionMatch = block.match(/^(\d+)\.\s*(.+)/s);
      if (!questionMatch) return;
      
      const questionNumber = questionMatch[1];
      let questionContent = questionMatch[2].trim();
      
      // Apply conservative spacing fix
      questionContent = fixTextSpacing(questionContent);
      
      // Check if this looks like multiple choice (contains A), B), C), D))
      const hasMultipleChoice = /[A-D]\)/.test(questionContent);
      
      if (hasMultipleChoice) {
        // Extract the main question (everything before the first option)
        const mainQuestionMatch = questionContent.match(/^(.+?)(?=\s*[A-D]\))/s);
        const mainQuestion = mainQuestionMatch ? mainQuestionMatch[1].trim() : questionContent;
        
        // Extract options with improved regex
        const options = {};
        // More robust regex to match options that might span multiple lines
        const optionRegex = /([A-D])\)\s*([^]*?)(?=\s*[A-D]\)|$)/g;
        let optionMatch;
        
        while ((optionMatch = optionRegex.exec(questionContent)) !== null) {
          const optionLetter = optionMatch[1];
          const optionText = optionMatch[2].trim();
          if (optionText) {
            options[optionLetter] = cleanLatexFormatting(fixTextSpacing(optionText));
          }
        }
        
        questions.push({
          q: cleanLatexFormatting(fixTextSpacing(mainQuestion)),
          type: 'multiple_choice',
          options: options,
          points: 5
        });
      } else {
        // Regular question
        questions.push({
          q: cleanLatexFormatting(questionContent),
          points: 5
        });
      }
    });
  } else {
    // Process each question section
    questionSections.forEach(section => {
      const lines = section.split('\n');
      let currentQuestion = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Check for question number
        const questionMatch = trimmedLine.match(/^(\d+)\.\s*(.+)/);
        if (questionMatch) {
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          
          const questionNumber = questionMatch[1];
          let questionText = questionMatch[2];
          
          // Extract points if present
          const pointsMatch = questionText.match(/\((\d+)\s*points?\)/i);
          const points = pointsMatch ? parseInt(pointsMatch[1]) : 5;
          questionText = questionText.replace(/\(\d+\s*points?\)/i, '').trim();
          
          currentQuestion = {
            q: cleanLatexFormatting(fixTextSpacing(questionText)),
            points: points
          };
        } else if (currentQuestion) {
          // Check for multiple choice options
          const optionMatch = trimmedLine.match(/^([A-D])\)\s*(.+)/);
          if (optionMatch) {
            if (!currentQuestion.options) {
              currentQuestion.options = {};
              currentQuestion.type = 'multiple_choice';
            }
            const optionLetter = optionMatch[1];
            const optionText = optionMatch[2];
            currentQuestion.options[optionLetter] = cleanLatexFormatting(fixTextSpacing(optionText));
          } else if (currentQuestion && currentQuestion.options && trimmedLine.match(/^[A-D]\)/)) {
            // Handle multi-line options (option text continues on next line)
            const optionMatch = trimmedLine.match(/^([A-D])\)\s*(.+)/);
            if (optionMatch) {
              const optionLetter = optionMatch[1];
              const optionText = optionMatch[2];
              // Append to existing option text
              if (currentQuestion.options[optionLetter]) {
                currentQuestion.options[optionLetter] += ' ' + cleanLatexFormatting(fixTextSpacing(optionText));
              } else {
                currentQuestion.options[optionLetter] = cleanLatexFormatting(fixTextSpacing(optionText));
              }
            }
          } else if (currentQuestion && currentQuestion.options && Object.keys(currentQuestion.options).length > 0) {
            // Continue the last option text if we're still in options section
            const lastOptionKey = Object.keys(currentQuestion.options).pop();
            currentQuestion.options[lastOptionKey] += ' ' + cleanLatexFormatting(fixTextSpacing(trimmedLine));
          } else {
            // Continue the question text
            currentQuestion.q += ' ' + cleanLatexFormatting(fixTextSpacing(trimmedLine));
          }
        }
      }
      
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
    });
  }
  
  const result = questions.length > 0 ? questions : [{ q: cleanLatexFormatting(fixTextSpacing(content)), points: 10 }];
  console.log('✅ Processed exam questions:', result.map(q => ({ 
    q: q.q.substring(0, 100) + '...', 
    type: q.type || 'regular',
    options: q.options ? Object.keys(q.options).map(key => `${key}: ${q.options[key].substring(0, 50)}...`) : null,
    points: q.points 
  })));
  return result;
};

const parseQuizQuestions = (content, options) => {
  console.log('🔍 Parsing quiz content:', content.substring(0, 500) + '...');
  const questions = [];
  const lines = content.split('\n');
  let currentQuestion = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    if (trimmedLine.match(/^\d+\./)) {
      if (currentQuestion) questions.push(currentQuestion);
      currentQuestion = { q: trimmedLine.replace(/^\d+\.\s*/, '') };
    } else if (currentQuestion && trimmedLine) {
      // Check for multiple choice options (A), B), C), D) or A. B. C. D.)
      if (trimmedLine.match(/^[A-D][\)\.]\s*/)) {
        if (!currentQuestion.options) {
          currentQuestion.options = {};
          currentQuestion.type = 'multiple_choice';
        }
        const option = trimmedLine.charAt(0);
        currentQuestion.options[option] = trimmedLine.substring(2).trim();
      } else {
        // If this line doesn't look like an option, add it to the question text
        currentQuestion.q += ' ' + trimmedLine;
      }
    }
  }

  if (currentQuestion) questions.push(currentQuestion);
  
  console.log('🔍 Parsed quiz questions:', questions.length);
  questions.forEach((q, i) => {
    console.log(`Question ${i + 1}:`, q.q.substring(0, 100) + '...');
    if (q.options) {
      console.log(`Options:`, Object.keys(q.options));
    }
  });
  
  return questions.length > 0 ? questions : [{ q: content }];
};

const parseFlashcards = (content) => {
  const flashcards = [];
  const lines = content.split('\n');
  let currentCard = null;

  for (const line of lines) {
    if (line.match(/^Q:/)) {
      if (currentCard) flashcards.push(currentCard);
      currentCard = { q: line.replace(/^Q:\s*/, '') };
    } else if (line.match(/^A:/) && currentCard) {
      currentCard.a = line.replace(/^A:\s*/, '');
    } else if (currentCard && line.trim()) {
      if (currentCard.a) {
        currentCard.a += ' ' + line.trim();
      } else {
        currentCard.q += ' ' + line.trim();
      }
    }
  }

  if (currentCard) flashcards.push(currentCard);
  return flashcards.length > 0 ? flashcards : [{ q: content, a: 'Answer' }];
};

const parseCheatSheetSections = (content) => {
  // Parse cheat sheet content into structured sections
  const sections = [];
  
  // Split by SECTION headers
  const sectionMatches = content.match(/SECTION \d+:\s*([^\n]+)/g);
  
  if (sectionMatches) {
    sectionMatches.forEach((match, index) => {
      const title = match.replace(/SECTION \d+:\s*/, '').trim();
      
      // Find content for this section
      const nextSectionIndex = content.indexOf(sectionMatches[index + 1]);
      const sectionEnd = nextSectionIndex > -1 ? nextSectionIndex : content.length;
      const sectionStart = content.indexOf(match) + match.length;
      const sectionContent = content.substring(sectionStart, sectionEnd).trim();
      
      // Parse bullet points
      const items = [];
      const lines = sectionContent.split('\n');
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
          const content = trimmedLine.substring(1).trim();
          if (content) {
            // Determine if this is a formula or regular text
            const isFormula = content.includes('\\(') || content.includes('\\(\\') || 
                             content.includes('=') && (content.includes('x') || content.includes('y') || content.includes('z'));
            
            items.push({
              content: content,
              type: isFormula ? 'formula' : 'text'
            });
          }
        }
      });
      
      if (items.length > 0) {
        sections.push({ title, items });
      }
    });
  }
  
  // Fallback: if no sections found, create a single section
  if (sections.length === 0) {
    const lines = content.split('\n').filter(line => line.trim());
    const items = lines.map(line => ({
      content: line.trim(),
      type: 'text'
    }));
    
    sections.push({ 
      title: 'Cheat Sheet Content', 
      items: items 
    });
  }

  return sections;
};

const parseTableOfContents = (content) => {
  // Extract headers for TOC
  const headers = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    if (line.match(/^[A-Z][^a-z]/) && line.length < 100) {
      headers.push(line.trim());
    }
  });

  return headers.slice(0, 10); // Limit to 10 items
};

const parseNotesSections = (content) => {
  const sections = [];
  
  // Split by numbered sections (1., 2., etc.)
  const sectionMatches = content.match(/^\d+\.\s*([^\n]+)/gm);
  
  if (sectionMatches) {
    sectionMatches.forEach((match, index) => {
      const title = match.replace(/^\d+\.\s*/, '').trim();
      
      // Find content for this section
      const nextSectionIndex = content.indexOf(sectionMatches[index + 1]);
      const sectionEnd = nextSectionIndex > -1 ? nextSectionIndex : content.length;
      const sectionStart = content.indexOf(match) + match.length;
      const sectionContent = content.substring(sectionStart, sectionEnd).trim();
      
      // Parse subsections (1.1, 1.2, etc.)
      const subsections = [];
      const subsectionMatches = sectionContent.match(/^\d+\.\d+\s*([^\n]+)/gm);
      
      if (subsectionMatches) {
        subsectionMatches.forEach((subMatch, subIndex) => {
          const subTitle = subMatch.replace(/^\d+\.\d+\s*/, '').trim();
          
          // Find content for this subsection
          const nextSubSectionIndex = sectionContent.indexOf(subsectionMatches[subIndex + 1]);
          const subSectionEnd = nextSubSectionIndex > -1 ? nextSubSectionIndex : sectionContent.length;
          const subSectionStart = sectionContent.indexOf(subMatch) + subMatch.length;
          const subSectionContent = sectionContent.substring(subSectionStart, subSectionEnd).trim();
          
          // Parse bullet points and content
          const contentItems = [];
          const lines = subSectionContent.split('\n');
          
          lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
              const content = trimmedLine.substring(1).trim();
              if (content) {
                contentItems.push({
                  text: content,
                  type: 'text'
                });
              }
            } else if (trimmedLine.startsWith('Example:')) {
              const exampleContent = trimmedLine.replace('Example:', '').trim();
              if (exampleContent) {
                contentItems.push({
                  text: exampleContent,
                  type: 'example'
                });
              }
            } else if (trimmedLine) {
              contentItems.push({
                text: trimmedLine,
                type: 'text'
              });
            }
          });
          
          if (contentItems.length > 0) {
            subsections.push({
              title: subTitle,
              content: contentItems
            });
          }
        });
      }
      
      // If no subsections, create one with the main content
      if (subsections.length === 0 && sectionContent) {
        subsections.push({
          content: [{ text: sectionContent, type: 'text' }]
        });
      }
      
      if (subsections.length > 0) {
        sections.push({
          title,
          subsections
        });
      }
    });
  }
  
  // Fallback: if no sections found, create a single section
  if (sections.length === 0) {
    sections.push({
      title: 'Notes',
      subsections: [{
        content: [{ text: content, type: 'text' }]
      }]
    });
  }

  return sections;
};

const parsePracticeQuestions = (content) => {
  const questions = [];
  const parts = content.split(/(?=^Question \d+)/m);
  
  parts.forEach(part => {
    if (part.trim()) {
      const lines = part.split('\n');
      const questionMatch = lines[0].match(/Question \d+:\s*(.+)/);
      
      if (questionMatch) {
        const q = questionMatch[1];
        const a = lines.find(line => line.includes('Answer:'))?.replace('Answer:', '').trim() || 'Answer provided';
        questions.push({ q, a });
      }
    }
  });

  return questions.length > 0 ? questions : [{ q: content, a: 'Answer' }];
};

const parseStudyGuideChapters = (content) => {
  const chapters = [];
  
  // Split by Chapter headers (Chapter 1:, Chapter 2:, etc.)
  const chapterMatches = content.match(/^CHAPTER \d+:\s*([^\n]+)/gm);
  
  if (chapterMatches) {
    chapterMatches.forEach((match, index) => {
      const title = match.replace(/^CHAPTER \d+:\s*/, '').trim();
      
      // Find content for this chapter
      const nextChapterIndex = content.indexOf(chapterMatches[index + 1]);
      const chapterEnd = nextChapterIndex > -1 ? nextChapterIndex : content.length;
      const chapterStart = content.indexOf(match) + match.length;
      const chapterContent = content.substring(chapterStart, chapterEnd).trim();
      
      // Parse chapter content into sections
      const sections = [];
      
      // Look for Key Concepts section
      const keyConceptsMatch = chapterContent.match(/Key Concepts:(.*?)(?=Examples:|Review Questions:|Summary:|$)/s);
      if (keyConceptsMatch) {
        sections.push({
          title: 'Key Concepts',
          subsections: [{
            content: [{ text: keyConceptsMatch[1].trim(), type: 'text' }]
          }]
        });
      }
      
      // Look for Examples section
      const examplesMatch = chapterContent.match(/Examples:(.*?)(?=Review Questions:|Summary:|$)/s);
      if (examplesMatch) {
        sections.push({
          title: 'Examples',
          subsections: [{
            content: [{ text: examplesMatch[1].trim(), type: 'text' }]
          }]
        });
      }
      
      // Look for Review Questions section
      const reviewQuestionsMatch = chapterContent.match(/Review Questions:(.*?)(?=Summary:|$)/s);
      if (reviewQuestionsMatch) {
        sections.push({
          title: 'Review Questions',
          subsections: [{
            content: [{ text: reviewQuestionsMatch[1].trim(), type: 'text' }]
          }]
        });
      }
      
      // Look for Summary section
      const summaryMatch = chapterContent.match(/Summary:(.*?)(?=CHAPTER|STUDY TIPS|$)/s);
      if (summaryMatch) {
        sections.push({
          title: 'Summary',
          subsections: [{
            content: [{ text: summaryMatch[1].trim(), type: 'text' }]
          }]
        });
      }
      
      // If no sections found, create one with the main content
      if (sections.length === 0 && chapterContent) {
        sections.push({
          title: 'Content',
          subsections: [{
            content: [{ text: chapterContent, type: 'text' }]
          }]
        });
      }
      
      if (sections.length > 0) {
        chapters.push({
          title,
          sections
        });
      }
    });
  }
  
  // Fallback: if no chapters found, create a single chapter
  if (chapters.length === 0) {
    chapters.push({
      title: 'Study Guide',
      sections: [{
        title: 'Content',
        subsections: [{
          content: [{ text: content, type: 'text' }]
        }]
      }]
    });
  }

  return chapters;
};

// General content generation endpoint
router.post('/content', authenticate, async (req, res) => {
  try {
    const { type, workspaceId, fileIds, ...options } = req.body;
    const userId = req.user.id;

    console.log('🔍 [GENERATE-NEW] Content generation request:', { type, workspaceId, fileIds, options });

    if (!type || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Type and workspaceId are required'
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

    // Get workspace content for context
    const workspaceContent = await contentGenerationService.getWorkspaceContent(workspaceId, userId, fileIds);
    
    if (!workspaceContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in workspace. Please upload some files first.'
      });
    }

    let generatedContent;
    let contentType;

    // Generate content based on type
    switch (type) {
      case 'practice_questions':
        generatedContent = await contentGenerationService.generatePracticeQuestions(workspace.name, workspaceContent);
        contentType = 'Practice Questions';
        break;
      case 'exam':
        console.log('🔍 [GENERATE-NEW] Generating exam with options:', options);
        generatedContent = await contentGenerationService.generateExam(workspace.name, workspaceId, userId, fileIds, options);
        contentType = 'Exam Questions';
        break;
      case 'quiz':
        console.log('🔍 [GENERATE-NEW] Generating quiz with options:', options);
        generatedContent = await contentGenerationService.generateQuiz(workspace.name, workspaceId, userId, fileIds, options);
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

    // Convert to JSON format for template
    const docJson = convertContentToJson(type, workspace.name, generatedContent, options);

    // Generate PDF using new system
    const pdfBuffer = await generatePdf(docJson);

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(workspace.name, contentType);
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer
    }, workspaceId, {
      isGenerated: true,
      generationType: contentType,
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfBuffer.length,
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

// Generate content from a single file
router.post('/file/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { type, ...options } = req.body;
    const userId = req.user.id;

    console.log('🔍 [GENERATE-NEW] File generation request:', { fileId, type, options });

    if (!type || !fileId) {
      return res.status(400).json({
        success: false,
        message: 'Type and fileId are required'
      });
    }

    // Get file details
    const file = await File.findOne({
      where: { id: fileId, userId: userId }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get workspace for context
    const workspace = await Workspace.findOne({
      where: { id: file.workspaceId, userId: userId }
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    // Get file content for context
    const fileContent = await contentGenerationService.getWorkspaceContent(file.workspaceId, userId, [parseInt(fileId)]);
    
    if (!fileContent) {
      return res.status(400).json({
        success: false,
        message: 'No content found in file. Please ensure the file has been processed.'
      });
    }

    let generatedContent;
    let contentType;

    // Generate content based on type
    switch (type) {
      case 'practice_questions':
        generatedContent = await contentGenerationService.generatePracticeQuestions(file.originalName, fileContent);
        contentType = 'Practice Questions';
        break;
      case 'exam':
        console.log('🔍 [GENERATE-NEW] Generating exam with options:', options);
        generatedContent = await contentGenerationService.generateExam(file.originalName, file.workspaceId, userId, [file.id], options);
        contentType = 'Exam Questions';
        break;
      case 'quiz':
        console.log('🔍 [GENERATE-NEW] Generating quiz with options:', options);
        generatedContent = await contentGenerationService.generateQuiz(file.originalName, file.workspaceId, userId, [file.id], options);
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

    // Convert to JSON format for template
    const docJson = convertContentToJson(type, file.originalName, generatedContent, options);

    // Generate PDF using new system
    const pdfBuffer = await generatePdf(docJson);

    // Upload PDF to S3 with structured naming
    const fileName = generateShortFileName(file.originalName, contentType);
    const s3Result = await uploadToS3({
      originalname: fileName,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer
    }, file.workspaceId, {
      isGenerated: true,
      generationType: contentType,
      workspaceName: workspace.name
    });

    // Create file record and start RAG processing
    const fileRecord = await createFileRecordAndStartRAG(
      {
        fileName: s3Result.fileName,
        fileSize: pdfBuffer.length,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.s3Bucket,
        s3Url: s3Result.s3Url,
        workspaceName: workspace.name
      },
      file.workspaceId,
      userId,
      contentType,
      type,
      generatedContent,
      parseInt(fileId) // Add sourceFileId for file-specific generation
    );

    res.json({
      success: true,
      message: `${contentType} generated successfully`,
      data: {
        file: fileRecord,
        content: generatedContent
      }
    });

  } catch (error) {
    console.error('Generate file content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content: ' + error.message
    });
  }
});

export default router; 