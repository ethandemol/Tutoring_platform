import openai from '../config/openai.js';

// Simple subject class to emoji mapping
const SUBJECT_CLASSES = {
  'Mathematics': '📊',
  'Physics': '⚡',
  'Chemistry': '🧪',
  'Biology': '🧬',
  'Computer Science': '💻',
  'Languages': '🗣️',
  'History': '📜',
  'Philosophy': '🤔',
  'Psychology': '🧠',
  'Sociology': '👥',
  'Economics': '💰',
  'Geography': '🗺️',
  'Literature': '📖',
  'Art': '🎨',
  'Music': '🎵',
  'Engineering': '⚙️',
  'Medicine': '🏥',
  'Education': '📚',
  'Research': '🔬',
  'Project': '📁',
  'Other': '📚'
};

class SubjectClassifierService {
  /**
   * Classify a workspace name to determine the most appropriate subject class
   * @param {string} workspaceName - The name of the workspace
   * @returns {Promise<{category: string, emoji: string, confidence: number}>}
   */
  async classifyWorkspace(workspaceName) {
    try {
      const name = workspaceName.trim();
      
      // Handle edge cases
      if (!name || name.length === 0) {
        return { category: 'Other', emoji: '📚', confidence: 0.5 };
      }

      // Use AI to classify the workspace name
      return await this.aiClassify(name);
    } catch (error) {
      console.error('Subject classification error:', error);
      // Fallback to Other category
      return { category: 'Other', emoji: '📚', confidence: 0.5 };
    }
  }

  /**
   * Use AI to classify the workspace name into one of the subject classes
   * @param {string} name 
   * @returns {Promise<Object>}
   */
  async aiClassify(name) {
    const categories = Object.keys(SUBJECT_CLASSES).join(', ');
    
    const prompt = `Given a workspace name, classify it into the most appropriate academic subject category from this list: ${categories}

Workspace name: "${name}"

Please respond with ONLY the category name from the list above. If none of the categories seem appropriate, respond with "Other".

Examples:
- "Calculus 101" → Mathematics
- "Introduction to Programming" → Computer Science
- "World History" → History
- "My Personal Notes" → Other
- "Physics Lab" → Physics
- "Spanish Literature" → Languages
- "Business Management" → Economics
- "Art Studio" → Art
- "Chemistry Lab" → Chemistry
- "Biology Notes" → Biology
- "Psychology Research" → Psychology
- "Engineering Design" → Engineering
- "Medical Studies" → Medicine
- "Teaching Methods" → Education
- "Research Project" → Research
- "Final Project" → Project

Category:`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that classifies academic workspace names into subject categories. Respond with only the category name.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.3,
        stream: false,
      });

      const category = response.choices[0].message.content.trim();
      
      // Validate the response and get the emoji
      if (SUBJECT_CLASSES[category]) {
        return {
          category,
          emoji: SUBJECT_CLASSES[category],
          confidence: 0.9
        };
      } else {
        // If AI returns an invalid category, fall back to Other
        return {
          category: 'Other',
          emoji: '📚',
          confidence: 0.5
        };
      }
    } catch (error) {
      console.error('AI classification error:', error);
      // Fall back to Other category
      return {
        category: 'Other',
        emoji: '📚',
        confidence: 0.5
      };
    }
  }

  /**
   * Get emoji for a specific category
   * @param {string} category 
   * @returns {string}
   */
  getEmojiForCategory(category) {
    return SUBJECT_CLASSES[category] || '📚';
  }

  /**
   * Get all available categories
   * @returns {Array}
   */
  getAvailableCategories() {
    return Object.keys(SUBJECT_CLASSES);
  }
}

export default new SubjectClassifierService(); 