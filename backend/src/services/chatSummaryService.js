import openai from '../config/openai.js';

/**
 * Generate a short summary for a chat session based on its messages
 * @param {Array} messages - Array of chat messages
 * @returns {Promise<string>} Generated summary
 */
export async function generateChatSummary(messages) {
  try {
    if (!messages || messages.length === 0) {
      return 'Empty chat session';
    }

    // Take the first few messages to generate a summary
    const recentMessages = messages.slice(0, 10);
    const conversationText = recentMessages
      .map(msg => `${msg.isUser ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    const prompt = `Please provide a very short summary (maximum 30 characters) of this conversation. Focus on the main topic or question being discussed. Keep it concise and descriptive.

Conversation:
${conversationText}

Summary:`;

    // Convert frontend message format to OpenAI format
    const openaiMessages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that creates very short, descriptive summaries of conversations. Keep summaries under 30 characters and focus on the main topic.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 500,
      temperature: 0.5,
      stream: false,
    });

    const summary = response.choices[0].message.content.trim();
    return summary || 'Chat session';
  } catch (error) {
    console.error('Error generating chat summary:', error);
    return 'Chat session';
  }
}

/**
 * Update the last activity timestamp for a chat session
 * @param {Object} session - Chat session object
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(session) {
  try {
    await session.update({
      lastActivityAt: new Date()
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
  }
} 