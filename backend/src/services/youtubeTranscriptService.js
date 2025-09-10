import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class YouTubeTranscriptService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../scripts/youtube_transcript_fetcher.py');
  }

  /**
   * Extract YouTube video ID from URL
   * @param {string} url - YouTube URL
   * @returns {string|null} Video ID
   */
  extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Fetch transcript from YouTube video
   * @param {string} videoId - YouTube video ID
   * @param {Object} proxyConfig - Optional proxy configuration
   * @returns {Promise<Object>} Transcript data
   */
  async fetchTranscript(videoId, proxyConfig = null) {
    try {
      console.log(`🎬 [YT-TRANSCRIPT] Fetching transcript for video: ${videoId}`);
      
      // Ensure tmp directory exists
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      // Create temporary output file
      const outputFile = path.join(tmpDir, `transcript_${videoId}_${Date.now()}.json`);
      
      // Prepare arguments for Python script
      const args = [videoId, outputFile];
      if (proxyConfig) {
        args.push(JSON.stringify(proxyConfig));
      }
      
      // Run Python script to fetch transcript
      const result = await this.runPythonScript(this.pythonScriptPath, args);
      
      // Clean up temporary file
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
      
      console.log(`✅ [YT-TRANSCRIPT] Successfully fetched transcript for video: ${videoId}`);
      console.log(`📊 [YT-TRANSCRIPT] Transcript stats: ${result.snippets.length} snippets, ${result.total_duration}s`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to fetch transcript for video ${videoId}:`, error.message);
      throw new Error(`Failed to fetch YouTube transcript: ${error.message}`);
    }
  }

  /**
   * Process transcript into chunks for RAG
   * @param {Object} transcriptData - Transcript data from fetchTranscript
   * @param {string} videoTitle - Video title
   * @param {string} videoDescription - Video description
   * @param {string} channelName - Channel name
   * @param {string} paragraphWithCommas - Optional paragraph with added commas
   * @returns {string} Formatted content for chunking
   */
  processTranscriptForRAG(transcriptData, videoTitle, videoDescription, channelName, paragraphWithCommas = null) {
    try {
      console.log(`📝 [YT-TRANSCRIPT] Processing transcript for RAG...`);
      
      // Use paragraph with commas if provided, otherwise combine snippets
      let transcriptText;
      if (paragraphWithCommas) {
        transcriptText = paragraphWithCommas;
        console.log(`✅ [YT-TRANSCRIPT] Using paragraph with commas for RAG (${transcriptText.length} characters)`);
      } else {
        // Fallback to combining all transcript snippets
        transcriptText = transcriptData.snippets
          .map(snippet => snippet.text)
          .join(' ');
        console.log(`⚠️ [YT-TRANSCRIPT] Using fallback combined snippets for RAG (${transcriptText.length} characters)`);
      }
      
      // Create structured content for RAG
      const content = `Title: ${videoTitle}

Description: ${videoDescription}

Channel: ${channelName}

Duration: ${transcriptData.total_duration} seconds

Transcript:
${transcriptText}

Timestamps:
${transcriptData.snippets.map(snippet => 
  `[${this.formatTimestamp(snippet.start)}] ${snippet.text}`
).join('\n')}`;
      
      console.log(`✅ [YT-TRANSCRIPT] Transcript processed for RAG (${content.length} characters)`);
      return content;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to process transcript for RAG:`, error.message);
      throw new Error(`Failed to process transcript for RAG: ${error.message}`);
    }
  }

  /**
   * Combine transcript chunks into a whole document
   * @param {Object} transcriptData - Transcript data from fetchTranscript
   * @returns {string} Combined transcript text
   */
  combineTranscriptChunks(transcriptData) {
    try {
      console.log(`🔗 [YT-TRANSCRIPT] Combining transcript chunks...`);
      
      // Combine all transcript snippets into one continuous text
      const combinedText = transcriptData.snippets
        .map(snippet => snippet.text)
        .join(' ');
      
      console.log(`✅ [YT-TRANSCRIPT] Combined ${transcriptData.snippets.length} chunks into whole document`);
      return combinedText;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to combine transcript chunks:`, error.message);
      throw new Error(`Failed to combine transcript chunks: ${error.message}`);
    }
  }

  /**
   * Extract actual content from transcript text, removing metadata
   * @param {string} transcriptText - Combined transcript text
   * @returns {string} Cleaned content text
   */
  extractActualContent(transcriptText) {
    try {
      console.log(`🧹 [YT-TRANSCRIPT] Extracting actual content from transcript...`);
      
      // Remove metadata sections
      let cleanedText = transcriptText
        .replace(/Title:.*?\n/g, '')
        .replace(/Description:.*?\n/g, '')
        .replace(/Channel:.*?\n/g, '')
        .replace(/Duration:.*?\n/g, '')
        .replace(/Summary:.*?\n/g, '')
        .replace(/Key Points:.*?\n/g, '')
        .replace(/Original URL:.*?\n/g, '')
        .replace(/Transcript:.*?\n/g, '')
        .replace(/Timestamps:.*?\n/g, '');
      
      // Remove bullet points and numbered lists
      cleanedText = cleanedText
        .replace(/^\s*[-*]\s*/gm, '') // Remove bullet points
        .replace(/^\s*\d+\.\s*/gm, '') // Remove numbered lists
        .replace(/^\s*\d+\s*/gm, ''); // Remove numbers
      
      // Clean up extra whitespace and line breaks
      cleanedText = cleanedText
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`✅ [YT-TRANSCRIPT] Extracted ${cleanedText.length} characters of actual content`);
      return cleanedText;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to extract actual content:`, error.message);
      return transcriptText; // Return original if extraction fails
    }
  }

  /**
   * Break transcript text into sentences using GPT for intelligent segmentation
   * @param {string} transcriptText - Combined transcript text
   * @returns {Promise<Array>} Array of sentence objects with timestamps
   */
  async breakIntoSentencesWithGPT(transcriptText) {
    // Skip GPT sentence breaking and use fallback directly
    console.log(`🔄 [YT-TRANSCRIPT] Skipping GPT sentence breaking, using fallback method directly...`);
    return this.breakIntoSentences(transcriptText);
  }

  /**
   * Break transcript text into sentences using natural language processing (fallback method)
   * @param {string} transcriptText - Combined transcript text
   * @returns {Array} Array of sentence objects with timestamps
   */
  breakIntoSentences(transcriptText) {
    try {
      console.log(`🔤 [YT-TRANSCRIPT] Breaking transcript into sentences (fallback method)...`);
      
      // First, try the original regex pattern
      let sentenceRegex = /[^.!?]+[.!?]+/g;
      let sentences = transcriptText.match(sentenceRegex) || [];
      
      // If no sentences found, try alternative patterns
      if (sentences.length === 0) {
        console.log(`⚠️ [YT-TRANSCRIPT] No sentences found with regex, trying alternative patterns...`);
        
        // Try splitting by periods, exclamation marks, and question marks
        const alternativeSplits = transcriptText.split(/[.!?]+/);
        sentences = alternativeSplits
          .map(s => s.trim())
          .filter(s => s.length > 10); // Filter out very short fragments
        
        console.log(`📊 [YT-TRANSCRIPT] Alternative splits found: ${sentences.length}`);
      }
      
      // If still no sentences, try splitting by line breaks and other patterns
      if (sentences.length === 0) {
        console.log(`⚠️ [YT-TRANSCRIPT] Still no sentences, trying line-based splitting...`);
        
        // Split by line breaks and filter meaningful content
        const lines = transcriptText.split(/\n+/);
        sentences = lines
          .map(line => line.trim())
          .filter(line => line.length > 20 && !line.startsWith('Title:') && !line.startsWith('Description:') && !line.startsWith('Channel:') && !line.startsWith('Summary:'))
          .slice(0, 20); // Limit to first 20 meaningful lines
        
        console.log(`📊 [YT-TRANSCRIPT] Line-based splits found: ${sentences.length}`);
      }
      
      // If we still have very few sentences, try more aggressive splitting
      if (sentences.length <= 1) {
        console.log(`⚠️ [YT-TRANSCRIPT] Very few sentences, trying aggressive splitting...`);
        
        // Split by common delimiters and meaningful breaks
        const aggressiveSplits = transcriptText
          .split(/[.!?\-–—\n]+/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && 
                      !s.startsWith('Title:') && 
                      !s.startsWith('Description:') && 
                      !s.startsWith('Channel:') && 
                      !s.startsWith('Summary:') &&
                      !s.startsWith('Duration:') &&
                      !s.startsWith('Transcript:') &&
                      !s.startsWith('Timestamps:'))
          .slice(0, 15); // Limit to first 15 meaningful segments
        
        if (aggressiveSplits.length > sentences.length) {
          sentences = aggressiveSplits;
          console.log(`📊 [YT-TRANSCRIPT] Aggressive splits found: ${sentences.length}`);
        }
      }
      
      // If still only one sentence, try splitting by commas and other natural breaks
      if (sentences.length <= 1) {
        console.log(`⚠️ [YT-TRANSCRIPT] Still only one sentence, trying comma-based splitting...`);
        
        // Split by commas and other natural speech breaks
        const commaSplits = transcriptText
          .split(/[,;]\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 30 && s.length < 200) // Reasonable sentence length
          .slice(0, 10); // Limit to first 10 segments
        
        if (commaSplits.length > 1) {
          sentences = commaSplits;
          console.log(`📊 [YT-TRANSCRIPT] Comma-based splits found: ${sentences.length}`);
        }
      }
      
      // Clean up sentences and create objects
      const cleanedSentences = sentences
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 10) // Filter out very short fragments
        .map((sentence, index) => ({
          id: index + 1,
          text: sentence,
          startIndex: transcriptText.indexOf(sentence)
        }));
      
      console.log(`✅ [YT-TRANSCRIPT] Broke transcript into ${cleanedSentences.length} sentences`);
      return cleanedSentences;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to break transcript into sentences:`, error.message);
      throw new Error(`Failed to break transcript into sentences: ${error.message}`);
    }
  }

  /**
   * Process transcript into sentences with timestamps
   * @param {Object} transcriptData - Transcript data from fetchTranscript
   * @returns {Promise<Object>} Processed transcript with sentences and timestamps
   */
  async processTranscriptIntoSentences(transcriptData) {
    try {
      console.log(`📝 [YT-TRANSCRIPT] Processing transcript into sentences...`);
      
      // Step 1: Combine chunks into whole document
      const combinedText = this.combineTranscriptChunks(transcriptData);
      
      // Step 2: Break into sentences using GPT (with fallback)
      const sentences = await this.breakIntoSentencesWithGPT(combinedText);
      
      // Step 3: Map sentences to approximate timestamps
      const sentencesWithTimestamps = this.mapSentencesToTimestamps(sentences, transcriptData.snippets);
      
      console.log(`✅ [YT-TRANSCRIPT] Processed transcript into ${sentencesWithTimestamps.length} sentences with timestamps`);
      return {
        originalSnippets: transcriptData.snippets,
        sentences: sentencesWithTimestamps,
        totalDuration: transcriptData.total_duration,
        combinedText: combinedText
      };
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to process transcript into sentences:`, error.message);
      throw new Error(`Failed to process transcript into sentences: ${error.message}`);
    }
  }

  /**
   * Use GPT to add commas and make transcript a long paragraph, then break into sentences with timestamps
   * @param {Object} transcriptData - Transcript data from fetchTranscript
   * @returns {Promise<Object>} Processed transcript with sentences and timestamps
   */
  async processTranscriptWithCommasAndSentences(transcriptData) {
    try {
      console.log(`📝 [YT-TRANSCRIPT] Processing transcript with commas and sentence breaking...`);
      
      // Step 1: Combine chunks into whole document
      const combinedText = this.combineTranscriptChunks(transcriptData);
      
      // Step 2: Use GPT to add commas and make it a long paragraph
      const paragraphWithCommas = await this.addCommasWithGPT(combinedText);
      
      // Step 3: Break the paragraph into sentences using fallback method (skip GPT)
      console.log(`🔄 [YT-TRANSCRIPT] Using fallback sentence breaking method...`);
      const sentences = this.breakIntoSentences(paragraphWithCommas);
      
      // Step 4: Map sentences to timestamps using original transcript structure
      const sentencesWithTimestamps = this.mapSentencesToTimestampsFromSnippets(sentences, transcriptData.snippets);
      
      console.log(`✅ [YT-TRANSCRIPT] Processed transcript with commas and sentence breaking: ${sentencesWithTimestamps.length} sentences with timestamps`);
      
      // Validate timestamp ordering
      this.validateTimestampOrdering(sentencesWithTimestamps);
      
      // Post-process to fix obvious mapping issues
      const correctedSentences = this.fixTimestampMapping(sentencesWithTimestamps, transcriptData.snippets);
      
      return {
        originalSnippets: transcriptData.snippets,
        sentences: correctedSentences,
        totalDuration: transcriptData.total_duration,
        combinedText: combinedText,
        paragraphWithCommas: paragraphWithCommas
      };
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to process transcript with commas and sentence breaking:`, error.message);
      throw new Error(`Failed to process transcript with commas and sentence breaking: ${error.message}`);
    }
  }

  /**
   * Use GPT to add commas and make transcript a long paragraph
   * @param {string} transcriptText - Combined transcript text
   * @returns {Promise<string>} Transcript text with added commas as a long paragraph
   */
  async addCommasWithGPT(transcriptText) {
    try {
      console.log(`🤖 [YT-TRANSCRIPT] Using GPT to add commas and make long paragraph...`);
      
      // First, extract the actual content
      const actualContent = this.extractActualContent(transcriptText);
      
      // If the content is too short, return as is
      if (actualContent.length < 50) {
        console.log(`⚠️ [YT-TRANSCRIPT] Content too short (${actualContent.length} chars), returning as is`);
        return actualContent;
      }
      
      const { default: openai } = await import('../config/openai.js');
      
      const prompt = `Please add appropriate commas and punctuation to the following transcript text to make it flow as a natural, readable paragraph. 

Rules:
1. Add commas where natural pauses occur in speech
2. Add periods, question marks, or exclamation marks at the end of complete thoughts
3. Maintain the original meaning and content
4. Make it read like a natural paragraph, not a transcript
5. Preserve all the original words and their order
6. Add commas for lists, introductory phrases, and natural speech pauses
7. Make sure the paragraph flows smoothly and is easy to read

Transcript text to add commas to:
${actualContent}

Please return the text with added commas and punctuation as a natural paragraph:`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: "You are an expert at adding proper punctuation to transcript text to make it flow naturally as a paragraph. You understand speech patterns and can identify where commas and other punctuation should be added."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 10000,
        temperature: 0.1
      });

      const gptResponse = response.choices[0].message.content;
      
      console.log(`✅ [YT-TRANSCRIPT] GPT added commas and punctuation (${gptResponse.length} characters)`);
      return gptResponse;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to add commas with GPT:`, error.message);
      // Fallback to original text
      console.log(`🔄 [YT-TRANSCRIPT] Falling back to original text...`);
      return this.extractActualContent(transcriptText);
    }
  }

  /**
   * Map sentences to timestamps by finding the first occurrence of each sentence in the original transcript
   * @param {Array} sentences - Array of sentence objects
   * @param {Array} snippets - Original transcript snippets with timestamps
   * @returns {Array} Sentences with timestamps
   */
  mapSentencesToTimestamps(sentences, snippets) {
    try {
      console.log(`🕐 [YT-TRANSCRIPT] Mapping ${sentences.length} sentences to timestamps...`);
      
      // Create a combined text from original snippets for searching
      const originalText = snippets.map(snippet => snippet.text).join(' ');
      
      return sentences.map(sentence => {
        // Clean the sentence text for better matching (remove extra punctuation that GPT might have added)
        const cleanSentenceText = this.cleanSentenceForMatching(sentence.text);
        
        // Find the first occurrence of this sentence in the original text
        const firstOccurrenceIndex = originalText.indexOf(cleanSentenceText);
        
        let startTimestamp = 0;
        
        if (firstOccurrenceIndex !== -1) {
          // Find which snippet contains this occurrence
          let currentCharIndex = 0;
          for (const snippet of snippets) {
            const snippetLength = snippet.text.length + 1; // +1 for space
            const snippetStart = currentCharIndex;
            const snippetEnd = currentCharIndex + snippetLength;
            
            // Check if the sentence starts within this snippet
            if (firstOccurrenceIndex >= snippetStart && firstOccurrenceIndex < snippetEnd) {
              startTimestamp = snippet.start;
              break;
            }
            
            currentCharIndex += snippetLength;
          }
        } else {
          // Fallback: try to find partial matches
          console.log(`⚠️ [YT-TRANSCRIPT] Could not find exact match for sentence: "${cleanSentenceText.substring(0, 50)}..."`);
          startTimestamp = this.findPartialMatchTimestamp(cleanSentenceText, snippets);
        }
        
        return {
          ...sentence,
          startTimestamp: startTimestamp,
          formattedTimestamp: this.formatTimestamp(startTimestamp)
        };
      });
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to map sentences to timestamps:`, error.message);
      throw new Error(`Failed to map sentences to timestamps: ${error.message}`);
    }
  }

  /**
   * Map sentences to timestamps using original transcript snippets structure
   * This method works better with GPT-modified text by finding the best matching snippet
   * @param {Array} sentences - Array of sentence objects
   * @param {Array} snippets - Original transcript snippets with timestamps
   * @returns {Array} Sentences with timestamps
   */
  mapSentencesToTimestampsFromSnippets(sentences, snippets) {
    try {
      console.log(`🕐 [YT-TRANSCRIPT] Mapping ${sentences.length} sentences to timestamps from snippets...`);
      
      // Create a combined text from original snippets for searching
      const originalText = snippets.map(snippet => snippet.text).join(' ');
      console.log(`📄 [YT-TRANSCRIPT] Original transcript length: ${originalText.length} characters`);
      
      return sentences.map((sentence, sentenceIndex) => {
        // Clean the sentence text for better matching
        const cleanSentenceText = this.cleanSentenceForMatching(sentence.text);
        
        // Try to find the sentence in the original transcript
        let startTimestamp = 0;
        let matchMethod = 'none';
        let matchScore = 0;
        
        // Method 1: Try to find exact match in original text
        const exactMatchIndex = originalText.toLowerCase().indexOf(cleanSentenceText.toLowerCase());
        if (exactMatchIndex !== -1) {
          // Find which snippet contains this position
          let currentCharIndex = 0;
          for (const snippet of snippets) {
            const snippetLength = snippet.text.length + 1; // +1 for space
            const snippetStart = currentCharIndex;
            const snippetEnd = currentCharIndex + snippetLength;
            
            if (exactMatchIndex >= snippetStart && exactMatchIndex < snippetEnd) {
              startTimestamp = snippet.start;
              matchMethod = 'exact';
              matchScore = 1.0;
              break;
            }
            
            currentCharIndex += snippetLength;
          }
        }
        
        // Method 2: If no exact match, try to find the best partial match
        if (matchMethod === 'none') {
          let bestMatchSnippet = null;
          let bestMatchScore = 0;
          
          // Split sentence into meaningful words (3+ characters)
          const sentenceWords = cleanSentenceText.split(/\s+/).filter(word => word.length >= 3);
          
          if (sentenceWords.length > 0) {
            for (const snippet of snippets) {
              const snippetText = snippet.text.toLowerCase();
              
              // Calculate how many words from the sentence appear in this snippet
              let wordMatches = 0;
              for (const word of sentenceWords) {
                if (snippetText.includes(word)) {
                  wordMatches++;
                }
              }
              
              // Calculate match score
              const score = wordMatches / sentenceWords.length;
              
              if (score > bestMatchScore) {
                bestMatchScore = score;
                bestMatchSnippet = snippet;
              }
            }
            
            if (bestMatchSnippet && bestMatchScore > 0.2) {
              startTimestamp = bestMatchSnippet.start;
              matchMethod = 'partial';
              matchScore = bestMatchScore;
            }
          }
        }
        
        // Method 3: If still no match, use position-based estimation
        if (matchMethod === 'none') {
          // Estimate position based on sentence index
          const estimatedPosition = (sentenceIndex / sentences.length) * snippets.length;
          const snippetIndex = Math.floor(estimatedPosition);
          
          if (snippetIndex < snippets.length) {
            startTimestamp = snippets[snippetIndex].start;
            matchMethod = 'estimated';
            matchScore = 0.1;
          } else if (snippets.length > 0) {
            startTimestamp = snippets[snippets.length - 1].start;
            matchMethod = 'fallback';
            matchScore = 0.0;
          }
        }
        
        // Log match quality for debugging
        if (matchScore < 0.5) {
          console.log(`⚠️ [YT-TRANSCRIPT] Low match score (${matchScore.toFixed(2)}) for sentence ${sentenceIndex + 1}: "${cleanSentenceText.substring(0, 50)}..." (method: ${matchMethod})`);
        } else {
          console.log(`✅ [YT-TRANSCRIPT] Good match (${matchScore.toFixed(2)}) for sentence ${sentenceIndex + 1} (method: ${matchMethod})`);
        }
        
        // Debug: Show first few words and timestamp
        const firstWords = cleanSentenceText.split(' ').slice(0, 3).join(' ');
        console.log(`🔍 [YT-TRANSCRIPT] Sentence ${sentenceIndex + 1}: "${firstWords}..." → ${this.formatTimestamp(startTimestamp)} (${matchMethod})`);
        
        return {
          ...sentence,
          startTimestamp: startTimestamp,
          formattedTimestamp: this.formatTimestamp(startTimestamp),
          matchScore: matchScore,
          matchMethod: matchMethod
        };
      });
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to map sentences to timestamps from snippets:`, error.message);
      throw new Error(`Failed to map sentences to timestamps from snippets: ${error.message}`);
    }
  }

  /**
   * Clean sentence text for better matching with original transcript
   * @param {string} sentenceText - Sentence text from GPT
   * @returns {string} Cleaned sentence text
   */
  cleanSentenceForMatching(sentenceText) {
    return sentenceText
      .trim()
      // Remove extra punctuation that GPT might have added, but be more conservative
      .replace(/^[.,!?]+/, '') // Remove leading punctuation
      .replace(/[.,!?]+$/, '') // Remove trailing punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase(); // Case insensitive matching
  }

  /**
   * Find timestamp for a sentence by looking for partial matches
   * @param {string} sentenceText - Sentence text to find
   * @param {Array} snippets - Original transcript snippets
   * @returns {number} Timestamp in seconds
   */
  findPartialMatchTimestamp(sentenceText, snippets) {
    try {
      // Split sentence into words
      const sentenceWords = sentenceText.split(/\s+/).filter(word => word.length > 2);
      
      if (sentenceWords.length === 0) {
        return 0;
      }
      
      // Look for snippets that contain the first few words of the sentence
      const searchWords = sentenceWords.slice(0, Math.min(3, sentenceWords.length));
      const searchText = searchWords.join(' ').toLowerCase();
      
      for (const snippet of snippets) {
        const snippetText = snippet.text.toLowerCase();
        if (snippetText.includes(searchText)) {
          return snippet.start;
        }
      }
      
      // If no match found, return timestamp of first snippet
      return snippets.length > 0 ? snippets[0].start : 0;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Error in partial match timestamp:`, error.message);
      return 0;
    }
  }

  /**
   * Validate that timestamps are in chronological order
   * @param {Array} sentences - Array of sentences with timestamps
   */
  validateTimestampOrdering(sentences) {
    let outOfOrderCount = 0;
    let totalTimeGap = 0;
    
    for (let i = 1; i < sentences.length; i++) {
      const prevTimestamp = sentences[i - 1].startTimestamp;
      const currentTimestamp = sentences[i].startTimestamp;
      
      if (currentTimestamp < prevTimestamp) {
        outOfOrderCount++;
        console.log(`⚠️ [YT-TRANSCRIPT] Timestamp out of order: ${this.formatTimestamp(prevTimestamp)} → ${this.formatTimestamp(currentTimestamp)}`);
      }
      
      totalTimeGap += Math.abs(currentTimestamp - prevTimestamp);
    }
    
    const avgGap = totalTimeGap / Math.max(1, sentences.length - 1);
    console.log(`📊 [YT-TRANSCRIPT] Timestamp validation: ${outOfOrderCount} out of order, avg gap: ${avgGap.toFixed(1)}s`);
    
    if (outOfOrderCount > sentences.length * 0.3) {
      console.warn(`⚠️ [YT-TRANSCRIPT] Many timestamps out of order (${outOfOrderCount}/${sentences.length})`);
    }
  }

  /**
   * Fix obvious timestamp mapping issues by checking sequence and adjusting based on surrounding sentences
   * @param {Array} sentences - Array of sentences with timestamps
   * @param {Array} snippets - Original transcript snippets
   * @returns {Array} Corrected sentences
   */
  fixTimestampMapping(sentences, snippets) {
    try {
      console.log(`🔧 [YT-TRANSCRIPT] Fixing timestamp mapping issues...`);
      
      const correctedSentences = [...sentences];
      let fixesApplied = 0;
      
      for (let i = 0; i < correctedSentences.length; i++) {
        const current = correctedSentences[i];
        const prev = i > 0 ? correctedSentences[i - 1] : null;
        const next = i < correctedSentences.length - 1 ? correctedSentences[i + 1] : null;
        
        let needsFix = false;
        let suggestedTimestamp = current.startTimestamp;
        
        // Check for obvious issues
        if (prev && current.startTimestamp < prev.startTimestamp) {
          console.log(`🔧 [YT-TRANSCRIPT] Fixing backward timestamp: ${this.formatTimestamp(prev.startTimestamp)} → ${this.formatTimestamp(current.startTimestamp)}`);
          needsFix = true;
          
          // Estimate based on previous sentence
          const estimatedGap = 5; // Assume 5 seconds between sentences
          suggestedTimestamp = prev.startTimestamp + estimatedGap;
        }
        
        if (next && current.startTimestamp > next.startTimestamp) {
          console.log(`🔧 [YT-TRANSCRIPT] Fixing forward timestamp: ${this.formatTimestamp(current.startTimestamp)} → ${this.formatTimestamp(next.startTimestamp)}`);
          needsFix = true;
          
          // Estimate based on next sentence
          const estimatedGap = 5; // Assume 5 seconds between sentences
          suggestedTimestamp = Math.max(0, next.startTimestamp - estimatedGap);
        }
        
        // Check for unrealistic gaps (more than 60 seconds between consecutive sentences)
        if (prev && Math.abs(current.startTimestamp - prev.startTimestamp) > 60) {
          console.log(`🔧 [YT-TRANSCRIPT] Fixing unrealistic gap: ${Math.abs(current.startTimestamp - prev.startTimestamp)}s between sentences`);
          needsFix = true;
          
          // Use average gap from surrounding sentences
          const avgGap = 10; // Default 10 seconds
          suggestedTimestamp = prev.startTimestamp + avgGap;
        }
        
        // If fix is needed, find a better timestamp
        if (needsFix) {
          const betterTimestamp = this.findBetterTimestamp(current.text, snippets, suggestedTimestamp, prev?.startTimestamp, next?.startTimestamp);
          
          if (betterTimestamp !== current.startTimestamp) {
            console.log(`✅ [YT-TRANSCRIPT] Fixed timestamp: ${this.formatTimestamp(current.startTimestamp)} → ${this.formatTimestamp(betterTimestamp)}`);
            correctedSentences[i] = {
              ...current,
              startTimestamp: betterTimestamp,
              formattedTimestamp: this.formatTimestamp(betterTimestamp),
              wasFixed: true
            };
            fixesApplied++;
          }
        }
      }
      
      console.log(`✅ [YT-TRANSCRIPT] Applied ${fixesApplied} timestamp fixes`);
      return correctedSentences;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to fix timestamp mapping:`, error.message);
      return sentences; // Return original if fixing fails
    }
  }

  /**
   * Find a better timestamp for a sentence based on context
   * @param {string} sentenceText - Sentence text
   * @param {Array} snippets - Original transcript snippets
   * @param {number} suggestedTimestamp - Suggested timestamp
   * @param {number} prevTimestamp - Previous sentence timestamp
   * @param {number} nextTimestamp - Next sentence timestamp
   * @returns {number} Better timestamp
   */
  findBetterTimestamp(sentenceText, snippets, suggestedTimestamp, prevTimestamp, nextTimestamp) {
    try {
      const cleanSentenceText = this.cleanSentenceForMatching(sentenceText);
      
      // Find snippets within a reasonable range
      const minTimestamp = prevTimestamp ? Math.max(0, prevTimestamp + 1) : 0;
      const maxTimestamp = nextTimestamp ? Math.min(nextTimestamp - 1, nextTimestamp + 30) : suggestedTimestamp + 30;
      
      let bestSnippet = null;
      let bestScore = 0;
      
      for (const snippet of snippets) {
        // Only consider snippets within the reasonable range
        if (snippet.start < minTimestamp || snippet.start > maxTimestamp) {
          continue;
        }
        
        const snippetText = snippet.text.toLowerCase();
        const sentenceWords = cleanSentenceText.split(/\s+/).filter(word => word.length >= 3);
        
        if (sentenceWords.length === 0) continue;
        
        // Calculate match score
        let wordMatches = 0;
        for (const word of sentenceWords) {
          if (snippetText.includes(word)) {
            wordMatches++;
          }
        }
        
        const score = wordMatches / sentenceWords.length;
        
        if (score > bestScore) {
          bestScore = score;
          bestSnippet = snippet;
        }
      }
      
      // Return the best matching snippet's timestamp, or the suggested timestamp if no good match
      return bestSnippet && bestScore > 0.3 ? bestSnippet.start : suggestedTimestamp;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Error finding better timestamp:`, error.message);
      return suggestedTimestamp;
    }
  }

  /**
   * Format timestamp in MM:SS format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Run Python script with arguments
   * @param {string} scriptPath - Path to Python script
   * @param {Array} args - Arguments to pass to script
   * @returns {Promise<Object>} Script result
   */
  runPythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [scriptPath, ...args]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Read the output file
            const outputPath = args[1]; // Second argument is the output file
            const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${error.message}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Get transcript summary using OpenAI
   * @param {string} transcriptContent - Processed transcript content
   * @param {string} videoTitle - Video title
   * @returns {Promise<string>} Summary
   */
  async generateTranscriptSummary(transcriptContent, videoTitle) {
    try {
      console.log(`📋 [YT-TRANSCRIPT] Generating summary for: ${videoTitle}`);
      
      const { default: openai } = await import('../config/openai.js');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at summarizing YouTube video transcripts. Provide a comprehensive, well-structured summary that captures the main points, key insights, and important details from the video content. Use clear headings, bullet points, and proper formatting to make the summary easy to read and understand. Do NOT add any 'Summary of' titles or similar prefixes."
          },
          {
            role: "user",
            content: `Please provide a detailed, well-formatted summary of this YouTube video transcript:

Title: ${videoTitle}

Transcript Content:
${transcriptContent.substring(0, 3000)}...

Please provide a comprehensive summary with the following structure:

## Main Topics Discussed

• [Topic 1]
• [Topic 2]
• [Topic 3]

## Key Points and Insights

• [Key point 1]
• [Key point 2]
• [Key point 3]

## Important Details and Examples

• [Detail/example 1]
• [Detail/example 2]

## Overall Message/Conclusion

[Final thoughts and main takeaways]

Use clear formatting with bullet points and proper structure. Do NOT add any 'Summary of' titles or similar prefixes.`
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });

      let summary = response.choices[0].message.content;
      
      // Post-process to remove any "Summary of" titles that GPT might add
      summary = summary
        .replace(/^Summary of\s+["""].*?["""]\s*:?\s*/gi, '') // Remove "Summary of "title":"
        .replace(/^Summary of\s+.*?\s*:?\s*/gi, '') // Remove "Summary of title:"
        .replace(/^Summary\s*:?\s*/gi, '') // Remove "Summary:"
        .replace(/^Overview\s*:?\s*/gi, '') // Remove "Overview:"
        .trim();
      
      console.log(`✅ [YT-TRANSCRIPT] Summary generated successfully`);
      
      return summary;
      
    } catch (error) {
      console.error(`❌ [YT-TRANSCRIPT] Failed to generate summary:`, error.message);
      throw new Error(`Failed to generate transcript summary: ${error.message}`);
    }
  }
}

export default new YouTubeTranscriptService(); 