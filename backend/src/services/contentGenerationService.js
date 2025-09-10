import openai from '../config/openai.js';
import { Chunk, File } from '../models/index.js';
import { Op } from 'sequelize';

class ContentGenerationService {
  constructor() {
    this.openai = openai;
    this.maxContextLength = 100000; // Conservative limit for GPT-4o-mini context window
  }

  /**
   * Get all content from a workspace for context
   * @param {number} workspaceId - Workspace ID
   * @param {number} userId - User ID
   * @param {Array<number>} fileIds - Optional array of specific file IDs to include
   * @returns {Promise<string>} Combined content from all files
   */
  async getWorkspaceContent(workspaceId, userId, fileIds = null) {
    try {
      console.log(`📄 [CONTENT] Getting workspace content for workspace ${workspaceId}...`);
      
      // Build where clause
      const whereClause = { workspaceId, userId, isActive: true };
      
      // If specific file IDs are provided, filter by them using IN operator
      if (fileIds && fileIds.length > 0) {
        // Convert fileIds to numbers if they're strings
        const numericFileIds = fileIds.map(id => parseInt(id, 10));
        whereClause.fileId = { [Op.in]: numericFileIds };
        console.log(`📄 [CONTENT] Filtering by ${fileIds.length} specific files:`, fileIds);
        console.log(`📄 [CONTENT] Converted to numeric IDs:`, numericFileIds);
      }
      
      // Get chunks from the workspace
      const chunks = await Chunk.findAll({
        where: whereClause,
        include: [{
          model: File,
          as: 'file',
          attributes: ['originalName']
        }],
        order: [['chunkIndex', 'ASC']],
        attributes: ['content', 'chunkIndex', 'fileId']
      });

      if (chunks.length === 0) {
        console.log(`❌ [CONTENT] No content found in workspace ${workspaceId}`);
        return '';
      }

      console.log(`✅ [CONTENT] Found ${chunks.length} chunks from workspace`);

      // Log some sample content for debugging
      if (chunks.length > 0) {
        console.log(`📄 [CONTENT] Sample chunk content:`, chunks[0].content.substring(0, 200) + '...');
        console.log(`📄 [CONTENT] Sample file name:`, chunks[0].file.originalName);
      }

      // Combine all content with file references
      const content = chunks.map(chunk => 
        `[From ${chunk.file.originalName}]: ${chunk.content}`
      ).join('\n\n');

      console.log(`📄 [CONTENT] Combined content length: ${content.length} characters`);
      return content;
    } catch (error) {
      console.error(`❌ [CONTENT] Failed to get workspace content:`, error);
      throw new Error('Failed to retrieve workspace content');
    }
  }

  /**
   * Get intelligently selected content for large documents
   * @param {number} workspaceId - Workspace ID
   * @param {number} userId - User ID
   * @param {Array<number>} fileIds - Optional array of specific file IDs to include
   * @param {string} contentType - Type of content being generated (exam, quiz, flashcards, etc.)
   * @returns {Promise<string>} Selected and processed content
   */
  async getIntelligentContent(workspaceId, userId, fileIds = null, contentType = 'general') {
    try {
      console.log(`🧠 [INTELLIGENT] Getting intelligent content for ${contentType} generation...`);
      
      // Build where clause
      const whereClause = { workspaceId, userId, isActive: true };
      
      if (fileIds && fileIds.length > 0) {
        const numericFileIds = fileIds.map(id => parseInt(id, 10));
        whereClause.fileId = { [Op.in]: numericFileIds };
      }
      
      // Get all chunks
      const chunks = await Chunk.findAll({
        where: whereClause,
        include: [{
          model: File,
          as: 'file',
          attributes: ['originalName']
        }],
        order: [['chunkIndex', 'ASC']],
        attributes: ['content', 'chunkIndex', 'fileId']
      });

      if (chunks.length === 0) {
        console.log(`❌ [INTELLIGENT] No content found in workspace ${workspaceId}`);
        return '';
      }

      console.log(`📄 [INTELLIGENT] Found ${chunks.length} chunks, total size: ${chunks.reduce((sum, chunk) => sum + chunk.content.length, 0)} characters`);

      // If content is small enough, return it directly
      const totalContent = chunks.map(chunk => 
        `[From ${chunk.file.originalName}]: ${chunk.content}`
      ).join('\n\n');

      if (totalContent.length <= this.maxContextLength) {
        console.log(`✅ [INTELLIGENT] Content fits within context window, using full content`);
        return totalContent;
      }

      // For large documents, use intelligent selection
      console.log(`📊 [INTELLIGENT] Content too large (${totalContent.length} chars), using intelligent selection`);
      
      return await this.selectRelevantContent(chunks, contentType);
    } catch (error) {
      console.error(`❌ [INTELLIGENT] Failed to get intelligent content:`, error);
      throw new Error('Failed to retrieve intelligent content');
    }
  }

  /**
   * Select the most relevant content for generation
   * @param {Array} chunks - Array of content chunks
   * @param {string} contentType - Type of content being generated
   * @returns {Promise<string>} Selected content
   */
  async selectRelevantContent(chunks, contentType) {
    try {
      console.log(`🎯 [SELECTION] Selecting relevant content for ${contentType}...`);

      // Strategy 1: Use first, middle, and last chunks for comprehensive coverage
      const selectedChunks = [];
      const totalChunks = chunks.length;

      // Always include first chunk (introduction/overview)
      selectedChunks.push(chunks[0]);

      // Include middle chunks (core content)
      const middleStart = Math.floor(totalChunks * 0.25);
      const middleEnd = Math.floor(totalChunks * 0.75);
      const middleChunks = chunks.slice(middleStart, middleEnd);
      
      // Sample middle chunks evenly
      const middleSampleSize = Math.min(5, Math.floor(middleChunks.length / 2));
      for (let i = 0; i < middleSampleSize; i++) {
        const index = Math.floor(i * middleChunks.length / middleSampleSize);
        selectedChunks.push(middleChunks[index]);
      }

      // Always include last chunk (conclusion/summary)
      if (totalChunks > 1) {
        selectedChunks.push(chunks[totalChunks - 1]);
      }

      // Strategy 2: Use AI to identify key sections for specific content types
      if (contentType === 'exam' || contentType === 'quiz') {
        // For exams/quizzes, prioritize chunks with definitions, examples, and key concepts
        const examChunks = await this.identifyExamRelevantChunks(chunks);
        selectedChunks.push(...examChunks.slice(0, 3)); // Add top 3 exam-relevant chunks
      } else if (contentType === 'flashcards') {
        // For flashcards, prioritize chunks with definitions and key terms
        const flashcardChunks = await this.identifyFlashcardRelevantChunks(chunks);
        selectedChunks.push(...flashcardChunks.slice(0, 3)); // Add top 3 flashcard-relevant chunks
      }

      // Remove duplicates and combine
      const uniqueChunks = selectedChunks.filter((chunk, index, self) => 
        index === self.findIndex(c => c.id === chunk.id)
      );

      const selectedContent = uniqueChunks.map(chunk => 
        `[From ${chunk.file.originalName}]: ${chunk.content}`
      ).join('\n\n');

      console.log(`✅ [SELECTION] Selected ${uniqueChunks.length} chunks, content length: ${selectedContent.length} characters`);
      
      // If still too large, truncate intelligently
      if (selectedContent.length > this.maxContextLength) {
        console.log(`✂️ [SELECTION] Content still too large, truncating intelligently`);
        return this.truncateIntelligently(selectedContent);
      }

      return selectedContent;
    } catch (error) {
      console.error(`❌ [SELECTION] Failed to select relevant content:`, error);
      // Fallback to simple selection
      return this.simpleContentSelection(chunks);
    }
  }

  /**
   * Identify chunks most relevant for exam generation
   * @param {Array} chunks - Array of content chunks
   * @returns {Promise<Array>} Relevant chunks
   */
  async identifyExamRelevantChunks(chunks) {
    try {
      // Simple heuristic: look for chunks with question-like content, definitions, examples
      const examRelevantChunks = chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        const examKeywords = [
          'question', 'problem', 'solve', 'calculate', 'determine', 'find',
          'example', 'definition', 'concept', 'theory', 'principle', 'formula',
          'method', 'technique', 'procedure', 'algorithm', 'equation'
        ];
        
        return examKeywords.some(keyword => content.includes(keyword));
      });

      return examRelevantChunks;
    } catch (error) {
      console.error(`❌ [EXAM-SELECTION] Failed to identify exam chunks:`, error);
      return [];
    }
  }

  /**
   * Identify chunks most relevant for flashcard generation
   * @param {Array} chunks - Array of content chunks
   * @returns {Promise<Array>} Relevant chunks
   */
  async identifyFlashcardRelevantChunks(chunks) {
    try {
      // Simple heuristic: look for chunks with definitions, key terms, concepts
      const flashcardRelevantChunks = chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        const flashcardKeywords = [
          'definition', 'term', 'concept', 'meaning', 'refers to', 'is defined as',
          'key', 'important', 'essential', 'fundamental', 'basic', 'core'
        ];
        
        return flashcardKeywords.some(keyword => content.includes(keyword));
      });

      return flashcardRelevantChunks;
    } catch (error) {
      console.error(`❌ [FLASHCARD-SELECTION] Failed to identify flashcard chunks:`, error);
      return [];
    }
  }

  /**
   * Simple content selection as fallback
   * @param {Array} chunks - Array of content chunks
   * @returns {string} Selected content
   */
  simpleContentSelection(chunks) {
    console.log(`🔄 [FALLBACK] Using simple content selection`);
    
    // Take first 30% and last 20% of chunks
    const totalChunks = chunks.length;
    const firstChunks = chunks.slice(0, Math.floor(totalChunks * 0.3));
    const lastChunks = chunks.slice(Math.floor(totalChunks * 0.8));
    
    const selectedChunks = [...firstChunks, ...lastChunks];
    
    const content = selectedChunks.map(chunk => 
      `[From ${chunk.file.originalName}]: ${chunk.content}`
    ).join('\n\n');

    console.log(`✅ [FALLBACK] Selected ${selectedChunks.length} chunks, content length: ${content.length} characters`);
    return content;
  }

  /**
   * Intelligently truncate content while preserving important information
   * @param {string} content - Content to truncate
   * @returns {string} Truncated content
   */
  truncateIntelligently(content) {
    console.log(`✂️ [TRUNCATE] Intelligently truncating content from ${content.length} characters`);
    
    // Try to keep complete sentences and paragraphs
    const maxLength = this.maxContextLength * 0.9; // Leave 10% buffer
    
    if (content.length <= maxLength) {
      return content;
    }

    // Find a good truncation point (end of sentence/paragraph)
    const truncated = content.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('.\n'),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('?\n'),
      truncated.lastIndexOf('\n\n')
    );

    if (lastSentenceEnd > maxLength * 0.8) { // If we found a good break point
      return content.substring(0, lastSentenceEnd + 1);
    }

    // Fallback: just truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return content.substring(0, lastSpace) + '...';
  }


  /**
   * Generate exam questions based on workspace content
   * @param {string} workspaceName - Name of the workspace
   * @param {string} content - Workspace content
   * @param {Object} options - Exam configuration options
   * @param {number} options.numMultipleChoice - Number of multiple choice questions
   * @param {number} options.numShortAnswer - Number of short answer questions
   * @param {number} options.numEssay - Number of essay questions
   * @param {number} options.totalPoints - Total points for the exam
   * @returns {Promise<string>} Generated exam
   */
  async generateExam(workspaceName, workspaceId, userId, fileIds = null, options = {}) {
    try {
      console.log(`📝 [EXAM] Generating exam for ${workspaceName} with options:`, options);

      const { numMultipleChoice = 5, numShortAnswer = 3, numEssay = 2, totalPoints = 100 } = options;
      
      // Get intelligent content selection
      const content = await this.getIntelligentContent(workspaceId, userId, fileIds, 'exam');
      
      // Calculate point distribution
      const mcPoints = Math.floor((totalPoints * 0.4) / numMultipleChoice);
      const saPoints = Math.floor((totalPoints * 0.3) / numShortAnswer);
      const essayPoints = Math.floor((totalPoints * 0.3) / numEssay);

      const systemPrompt = `You are an expert educational content creator. Generate a comprehensive exam based on the provided content.

Content from workspace "${workspaceName}":
${content}

Generate a complete exam that includes:
1. ${numMultipleChoice} multiple choice questions (A, B, C, D options)
2. ${numShortAnswer} short answer questions (2-3 sentences expected)
3. ${numEssay} essay questions (detailed responses expected)
4. Clear instructions for students
5. Point values for each question (total ${totalPoints} points)

IMPORTANT FORMATTING REQUIREMENTS:
- Each question should be clearly separated with proper spacing
- Use clear, readable language without excessive formatting
- Avoid using LaTeX math notation unless absolutely necessary
- Ensure proper sentence structure and punctuation
- Use plain text formatting (no markdown, no special characters)

Format the output as:
EXAM: ${workspaceName}

Instructions: [Clear instructions for students]

MULTIPLE CHOICE (${Math.floor(totalPoints * 0.4)} points total)

1. [Question text] (${mcPoints} points)
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

2. [Next question text] (${mcPoints} points)
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

[Continue for all ${numMultipleChoice} multiple choice questions]

SHORT ANSWER (${Math.floor(totalPoints * 0.3)} points total)

${numMultipleChoice + 1}. [Question text] (${saPoints} points)
   [Space for answer]

${numMultipleChoice + 2}. [Question text] (${saPoints} points)
   [Space for answer]

[Continue for all ${numShortAnswer} short answer questions]

ESSAY QUESTIONS (${Math.floor(totalPoints * 0.3)} points total)

${numMultipleChoice + numShortAnswer + 1}. [Detailed question] (${essayPoints} points)
   [Space for detailed answer]

${numMultipleChoice + numShortAnswer + 2}. [Detailed question] (${essayPoints} points)
   [Space for detailed answer]

[Continue for all ${numEssay} essay questions]

================================================================================
                                    ANSWER KEY
================================================================================

MULTIPLE CHOICE SOLUTIONS

Question 1:
ANSWER: [Correct option letter]
EXPLANATION: [Detailed explanation of why this is the correct answer]

Question 2:
ANSWER: [Correct option letter]
EXPLANATION: [Detailed explanation of why this is the correct answer]

[Continue for all ${numMultipleChoice} multiple choice solutions]

SHORT ANSWER SOLUTIONS

Question ${numMultipleChoice + 1}:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]

Question ${numMultipleChoice + 2}:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]

[Continue for all ${numShortAnswer} short answer solutions]

ESSAY SOLUTIONS

Question ${numMultipleChoice + numShortAnswer + 1}:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]
GRADING CRITERIA:
• [What to look for when grading this essay]
• [Specific requirements for full credit]

Question ${numMultipleChoice + numShortAnswer + 2}:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]
GRADING CRITERIA:
• [What to look for when grading this essay]
• [Specific requirements for full credit]

[Continue for all ${numEssay} essay solutions]

Make sure all questions are relevant to the actual content provided and test comprehensive understanding. Use clear, simple language and proper spacing between questions.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a comprehensive exam for the content about ${workspaceName}.` }
        ],
        max_tokens: 8000,
        temperature: 0.7,
        stream: false,
      });

      console.log(`✅ [EXAM] Exam generated successfully`);
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`❌ [EXAM] Failed to generate exam:`, error);
      throw new Error('Failed to generate exam');
    }
  }

  /**
   * Generate quiz questions based on workspace content
   * @param {string} workspaceName - Name of the workspace
   * @param {string} content - Workspace content
   * @param {Object} options - Quiz configuration options
   * @param {number} options.numQuestions - Number of questions to generate
   * @param {string} options.questionType - Type of questions ('multiple_choice', 'free_response', 'both')
   * @returns {Promise<string>} Generated quiz
   */
  async generateQuiz(workspaceName, workspaceId, userId, fileIds = null, options = {}) {
    try {
      console.log(`🎲 [QUIZ] Generating quiz for ${workspaceName} with options:`, options);

      // Use the actual values from options, with fallbacks only if they're missing
      const numQuestions = options.numQuestions || 10;
      const questionType = options.questionType || 'both';
      
      // Get intelligent content selection
      const content = await this.getIntelligentContent(workspaceId, userId, fileIds, 'quiz');
      
      console.log(`🎲 [QUIZ] Using numQuestions: ${numQuestions}, questionType: ${questionType}`);
      
      let questionTypeInstructions = '';
      if (questionType === 'multiple_choice') {
        questionTypeInstructions = `Generate exactly ${numQuestions} multiple choice questions with 4 options (A, B, C, D) each.`;
      } else if (questionType === 'free_response') {
        questionTypeInstructions = `Generate exactly ${numQuestions} free response questions that require detailed written answers.`;
      } else {
        // 'both' - mix of question types
        const mcQuestions = Math.ceil(numQuestions * 0.6); // 60% multiple choice
        const frQuestions = numQuestions - mcQuestions; // 40% free response
        questionTypeInstructions = `Generate exactly ${mcQuestions} multiple choice questions with 4 options (A, B, C, D) each, and ${frQuestions} free response questions that require detailed written answers.`;
      }

      const systemPrompt = `You are an expert educational content creator. Generate a quiz based on the provided content.

Content from workspace "${workspaceName}":
${content}

Generate a quiz with ${numQuestions} questions based on the content provided.

${questionType === 'multiple_choice' ? 
`Generate exactly ${numQuestions} multiple choice questions with 4 options (A, B, C, D) each.` : 
questionType === 'free_response' ? 
`Generate exactly ${numQuestions} free response questions that require detailed written answers.` :
`Generate a mix of question types:
- ${Math.ceil(numQuestions * 0.6)} multiple choice questions (A, B, C, D options)
- ${numQuestions - Math.ceil(numQuestions * 0.6)} free response questions`}

Format the output as:

QUIZ: ${workspaceName}

${questionType === 'multiple_choice' ? 
`MULTIPLE CHOICE QUESTIONS

1. [Question text]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

2. [Question text]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

[Continue for all ${numQuestions} questions]` : 
questionType === 'free_response' ? 
`FREE RESPONSE QUESTIONS

1. [Question text]

2. [Question text]

[Continue for all ${numQuestions} questions]` :
`MULTIPLE CHOICE QUESTIONS

1. [Question text]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

[Continue for ${Math.ceil(numQuestions * 0.6)} multiple choice questions]

FREE RESPONSE QUESTIONS

${Math.ceil(numQuestions * 0.6) + 1}. [Question text]

${Math.ceil(numQuestions * 0.6) + 2}. [Question text]

[Continue for ${numQuestions - Math.ceil(numQuestions * 0.6)} free response questions]`}

================================================================================
                                    ANSWER KEY
================================================================================

${questionType === 'multiple_choice' ? 
`MULTIPLE CHOICE SOLUTIONS

Question 1:
ANSWER: [Correct option letter]
EXPLANATION: [Detailed explanation of why this is the correct answer]

Question 2:
ANSWER: [Correct option letter]
EXPLANATION: [Detailed explanation of why this is the correct answer]

[Continue for all ${numQuestions} multiple choice solutions]` : 
questionType === 'free_response' ? 
`FREE RESPONSE SOLUTIONS

Question 1:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]

Question 2:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]

[Continue for all ${numQuestions} free response solutions]` :
`MULTIPLE CHOICE SOLUTIONS

Question 1:
ANSWER: [Correct option letter]
EXPLANATION: [Detailed explanation of why this is the correct answer]

[Continue for ${Math.ceil(numQuestions * 0.6)} multiple choice solutions]

FREE RESPONSE SOLUTIONS

Question ${Math.ceil(numQuestions * 0.6) + 1}:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]

Question ${Math.ceil(numQuestions * 0.6) + 2}:
SAMPLE ANSWER: [Detailed sample answer]
KEY POINTS:
• [Key point 1]
• [Key point 2]
• [Key point 3]

[Continue for ${numQuestions - Math.ceil(numQuestions * 0.6)} free response solutions]`}

Make the quiz engaging and relevant to the actual content provided. Ensure all questions are based on the content provided and test understanding of key concepts.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a quiz for the content about ${workspaceName}.` }
        ],
        max_tokens: 6000,
        temperature: 0.7,
        stream: false,
      });

      console.log(`✅ [QUIZ] Quiz generated successfully`);
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`❌ [QUIZ] Failed to generate quiz:`, error);
      throw new Error('Failed to generate quiz');
    }
  }

  /**
   * Generate flashcards based on workspace content
   * @param {string} workspaceName - Name of the workspace
   * @param {string} content - Workspace content
   * @returns {Promise<string>} Generated flashcards
   */
  async generateFlashcards(workspaceName, workspaceId, userId, fileIds = null) {
    try {
      console.log(`🃏 [FLASHCARDS] Generating flashcards for ${workspaceName}...`);
      
      // Get intelligent content selection
      const content = await this.getIntelligentContent(workspaceId, userId, fileIds, 'flashcards');

      const systemPrompt = `You are an expert educational content creator. Generate flashcards based on the provided content.

Content from workspace "${workspaceName}":
${content}

Generate 10-15 flashcards that:
1. Cover key concepts, definitions, and important facts
2. Have clear, concise questions on the front
3. Have detailed, accurate answers on the back
4. Include a mix of definition, concept, and application cards
5. Are organized by topic or difficulty

Format the output as:
FLASHCARDS: [Workspace Name]

CARD 1
Front: [Question or term]
Back: [Answer or definition]

CARD 2
Front: [Question or term]
Back: [Answer or definition]

[Continue for all cards...]

Make sure the flashcards are relevant to the actual content provided and help with memorization and understanding.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate flashcards for the content about ${workspaceName}.` }
        ],
        max_tokens: 8000,
        temperature: 0.7,
        stream: false,
      });

      console.log(`✅ [FLASHCARDS] Flashcards generated successfully`);
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`❌ [FLASHCARDS] Failed to generate flashcards:`, error);
      throw new Error('Failed to generate flashcards');
    }
  }

  /**
   * Generate cheat sheet based on workspace content
   * @param {string} workspaceName - Name of the workspace
   * @param {string} content - Workspace content
   * @returns {Promise<string>} Generated cheat sheet
   */
  async generateCheatSheet(workspaceName, workspaceId, userId, fileIds = null) {
    try {
      console.log(`📋 [CHEAT SHEET] Generating cheat sheet for ${workspaceName}...`);
      
      // Get intelligent content selection
      const content = await this.getIntelligentContent(workspaceId, userId, fileIds, 'cheatsheet');

      const systemPrompt = `You are an expert educational content creator. Generate a comprehensive cheat sheet based on the provided content.

Content from workspace "${workspaceName}":
${content}

Generate a complete cheat sheet that includes:
1. Key formulas, definitions, and concepts from the actual content
2. Important facts and figures mentioned in the materials
3. Step-by-step processes or procedures described
4. Quick reference tables or lists of key information
5. Organized sections with clear headings based on the content topics
6. Condensed information for quick review during exams or study sessions

IMPORTANT FORMATTING REQUIREMENTS:
- Each section should be clearly separated with proper spacing
- Use clear, readable language without excessive formatting
- Avoid using LaTeX math notation unless absolutely necessary
- Ensure proper sentence structure and punctuation
- Use plain text formatting (no markdown, no special characters)
- Base ALL content on the actual provided materials - do not add generic information

Format the output as:
CHEAT SHEET: ${workspaceName}

SECTION 1: [Topic from the content]
• [Specific key point from the content]
• [Specific key point from the content]
• [Formula or definition from the content]

SECTION 2: [Topic from the content]
• [Specific key point from the content]
• [Specific key point from the content]
• [Important fact from the content]

[Continue with all relevant sections based on the actual content...]

CRITICAL REQUIREMENTS:
- Extract information ONLY from the provided content
- Do not add generic or common knowledge unless it's specifically mentioned in the content
- Focus on the specific topics, concepts, and details mentioned in the materials
- Organize information based on the actual structure and topics in the content
- Make it perfect for quick reference during exams or study sessions`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a cheat sheet for the content about ${workspaceName}.` }
        ],
        max_tokens: 8000,
        temperature: 0.7,
        stream: false,
      });

      console.log(`✅ [CHEAT SHEET] Cheat sheet generated successfully`);
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`❌ [CHEAT SHEET] Failed to generate cheat sheet:`, error);
      throw new Error('Failed to generate cheat sheet');
    }
  }

  /**
   * Generate study guide based on workspace content
   * @param {string} workspaceName - Name of the workspace
   * @param {string} content - Workspace content
   * @returns {Promise<string>} Generated study guide
   */
  async generateStudyGuide(workspaceName, workspaceId, userId, fileIds = null) {
    try {
      console.log(`📚 [STUDY GUIDE] Generating study guide for ${workspaceName}...`);
      
      // Get intelligent content selection
      const content = await this.getIntelligentContent(workspaceId, userId, fileIds, 'studyguide');
      
      console.log(`📚 [STUDY GUIDE] Content length: ${content.length} characters`);
      console.log(`📚 [STUDY GUIDE] Content preview: ${content.substring(0, 500)}...`);

      const systemPrompt = `You are an expert educational content creator. Generate a comprehensive study guide based on the provided content.

Content from workspace "${workspaceName}":
${content}

Generate a complete study guide that includes:
1. Learning objectives and goals based on the actual content
2. Detailed explanations of key concepts from the provided materials
3. Examples and applications mentioned in the content
4. Important definitions and terms from the materials
5. Review questions for each section based on the content
6. Summary points for quick review from the actual materials
7. Study tips and strategies relevant to the content

IMPORTANT FORMATTING REQUIREMENTS:
- Each section should be clearly separated with proper spacing
- Use clear, readable language without excessive formatting
- Avoid using LaTeX math notation unless absolutely necessary
- Ensure proper sentence structure and punctuation
- Use plain text formatting (no markdown, no special characters)
- Base ALL content on the actual provided materials - do not add generic information

Format the output as:
STUDY GUIDE: ${workspaceName}

LEARNING OBJECTIVES
• [Specific objective from the content]
• [Specific objective from the content]
• [Specific objective from the content]

CHAPTER 1: [Topic from the content]
Overview: [Brief introduction based on the actual content]

Key Concepts:
• [Specific concept from the content with explanation]
• [Specific concept from the content with explanation]

Examples:
[Specific example from the content with detailed explanation]
[Specific example from the content with detailed explanation]

Review Questions:
1. [Question based on the specific content]
2. [Question based on the specific content]

Summary:
• [Key point from the content]
• [Key point from the content]

[Continue with all relevant chapters based on the actual content...]

STUDY TIPS
• [Tip relevant to the specific content]
• [Tip relevant to the specific content]
• [Tip relevant to the specific content]

CRITICAL REQUIREMENTS:
- Extract information ONLY from the provided content
- Do not add generic or common knowledge unless it's specifically mentioned in the content
- Focus on the specific topics, concepts, and details mentioned in the materials
- Organize information based on the actual structure and topics in the content
- Make the study guide comprehensive, well-structured, and perfect for deep learning and understanding

IMPORTANT: The content you generate must be directly based on the provided materials. Do not include any information that is not explicitly mentioned in the content above.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a study guide for the content about ${workspaceName}.` }
        ],
        max_tokens: 10000,
        temperature: 0.7,
        stream: false,
      });

      console.log(`✅ [STUDY GUIDE] Study guide generated successfully`);
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`❌ [STUDY GUIDE] Failed to generate study guide:`, error);
      throw new Error('Failed to generate study guide');
    }
  }

  /**
   * Generate notes based on workspace content
   * @param {string} workspaceName - Name of the workspace
   * @param {string} content - Workspace content
   * @returns {Promise<string>} Generated notes
   */
  async generateNotes(workspaceName, workspaceId, userId, fileIds = null) {
    try {
      console.log(`📝 [NOTES] Generating notes for ${workspaceName}...`);
      
      // Get intelligent content selection
      const content = await this.getIntelligentContent(workspaceId, userId, fileIds, 'notes');

      const systemPrompt = `You are an expert educational content creator. Generate comprehensive notes based on the provided content.

Content from workspace "${workspaceName}":
${content}

Generate complete notes that include:
1. Clear, organized structure with headings and subheadings based on the actual content
2. Key concepts and main ideas from the provided materials
3. Important details and supporting information mentioned in the content
4. Examples and explanations from the actual materials
5. Bullet points and numbered lists for easy reading
6. Logical flow from basic to advanced concepts as presented in the content
7. Highlighted important terms and definitions from the materials

IMPORTANT FORMATTING REQUIREMENTS:
- Each section should be clearly separated with proper spacing
- Use clear, readable language without excessive formatting
- Avoid using LaTeX math notation unless absolutely necessary
- Ensure proper sentence structure and punctuation
- Use plain text formatting (no markdown, no special characters)
- Base ALL content on the actual provided materials - do not add generic information

Format the output as:
NOTES: ${workspaceName}

1. [Main Topic from the content]
   1.1 [Subtopic from the content]
       • [Specific key point from the content with explanation]
       • [Specific key point from the content with explanation]
       
       Example: [Specific example from the content with explanation]
       
   1.2 [Subtopic from the content]
       • [Specific key point from the content with explanation]
       • [Specific key point from the content with explanation]

2. [Main Topic from the content]
   2.1 [Subtopic from the content]
       • [Specific key point from the content with explanation]
       • [Specific key point from the content with explanation]

[Continue with all relevant topics based on the actual content...]

IMPORTANT TERMS
• [Term from content]: [Definition from the content]
• [Term from content]: [Definition from the content]
• [Term from content]: [Definition from the content]

CRITICAL REQUIREMENTS:
- Extract information ONLY from the provided content
- Do not add generic or common knowledge unless it's specifically mentioned in the content
- Focus on the specific topics, concepts, and details mentioned in the materials
- Organize information based on the actual structure and topics in the content
- Make the notes clear, comprehensive, and easy to follow for effective learning and review`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate notes for the content about ${workspaceName}.` }
        ],
        max_tokens: 10000,
        temperature: 0.7,
        stream: false,
      });

      console.log(`✅ [NOTES] Notes generated successfully`);
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`❌ [NOTES] Failed to generate notes:`, error);
      throw new Error('Failed to generate notes');
    }
  }

  /**
   * Get content from a specific file
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} File content
   */
  async getFileContent(fileId, userId) {
    try {
      console.log(`📄 [FILE CONTENT] Getting content for file ${fileId}...`);

      // Get file chunks
      const chunks = await this.db.query(`
        SELECT c.content, c.metadata
        FROM chunks c
        JOIN files f ON c.fileId = f.id
        WHERE f.id = ? AND f.userId = ?
        ORDER BY c.chunkIndex
      `, [fileId, userId]);

      if (!chunks || chunks.length === 0) {
        console.log(`⚠️ [FILE CONTENT] No chunks found for file ${fileId}`);
        return null;
      }

      // Combine all chunks
      const content = chunks.map(chunk => chunk.content).join('\n\n');
      console.log(`✅ [FILE CONTENT] Retrieved ${chunks.length} chunks for file ${fileId}`);
      return content;
    } catch (error) {
      console.error(`❌ [FILE CONTENT] Failed to get file content:`, error);
      throw new Error('Failed to get file content');
    }
  }

  /**
   * Process generated content for RAG
   * @param {string} fileId - Generated file ID
   * @param {string} content - Generated content
   * @param {string} workspaceId - Workspace ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async processGeneratedContent(fileId, content, workspaceId, userId) {
    try {
      console.log(`🔄 [RAG] Processing generated content for file ${fileId}...`);

      // Import chunking service dynamically to avoid circular dependencies
      const { default: chunkingService } = await import('./chunkingServices.js');

      // Process the generated content through RAG
      await chunkingService.processFile(fileId, userId, workspaceId);
      
      console.log(`✅ [RAG] Generated content processed successfully for file ${fileId}`);
    } catch (error) {
      console.error(`❌ [RAG] Failed to process generated content:`, error);
      // Don't throw error to avoid breaking the generation process
      console.log(`⚠️ [RAG] Continuing without RAG processing for file ${fileId}`);
    }
  }
}

export default new ContentGenerationService(); 