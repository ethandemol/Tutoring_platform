import { buildApiUrl, API_ENDPOINTS } from './config.js';

interface FeedbackData {
  feedbackType: string;
  feedback: string;
}

export const submitFeedback = async (data: FeedbackData) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(buildApiUrl(API_ENDPOINTS.FEEDBACK.SUBMIT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to submit feedback');
    } catch (jsonError) {
      // If JSON parsing fails, use the status text
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
  }

  try {
    return await response.json();
  } catch (jsonError) {
    throw new Error('Invalid response from server');
  }
}; 