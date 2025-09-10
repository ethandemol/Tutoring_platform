# Google Gemini API Setup

This guide explains how to set up Google Gemini API for the model switching feature in Sparqit.

## Prerequisites

1. Google Cloud Platform account
2. Google AI Studio access (for Gemini API)

## Setup Steps

### 1. Get Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Add to Environment Variables

Add the following to your `.env` file:

```bash
# Google Gemini API
GOOGLE_API_KEY=your-google-api-key-here
```

### 3. Install Dependencies

The Google Generative AI package is already included in `package.json`:

```bash
npm install
```

## Available Models

The following models are available:

| Model | Provider | Description | Use Case |
|-------|----------|-------------|----------|
| `gpt-4o-mini` | OpenAI | Fast and cost-effective | General tasks |
| `gpt-4o` | OpenAI | High-performance with vision | Vision tasks |
| `gpt-4.1` | OpenAI | Advanced reasoning model | Complex analysis |
| `claude-opus-4` | Anthropic | Most advanced Claude model | Complex reasoning |
| `claude-sonnet-4` | Anthropic | Balanced performance model | General tasks |
| `gemini-2.5-pro` | Google | Google Gemini 2.5 Pro model | General text generation |
| `gemini-2.5-flash` | Google | Fast Google Gemini 2.5 Flash model | Fast text generation |

## Configuration

The models are configured in `backend/src/services/aiProviderService.js`:

```javascript
'claude-opus-4': {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 2000,
  temperature: 0.7,
  description: 'Claude Opus 4 - Most advanced Claude model'
},
'claude-sonnet-4': {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 2000,
  temperature: 0.7,
  description: 'Claude Sonnet 4 - Balanced performance model'
},
'gemini-2.5-pro': {
  provider: 'gemini',
  model: 'gemini-2.5-pro',
  maxTokens: 2000,
  temperature: 0.7,
  description: 'Google Gemini 2.5 Pro model for text generation'
},
'gemini-2.5-flash': {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  maxTokens: 2000,
  temperature: 0.7,
  description: 'Fast Google Gemini 2.5 Flash model'
},
```

## Usage

Users can now switch between models in the chat interface:

1. **Default**: `gpt-4o-mini` (OpenAI) - Fast and cost-effective
2. **Advanced**: `gpt-4.1` (OpenAI) - Complex reasoning tasks
3. **Vision**: `gpt-4o` (OpenAI) - Image processing capabilities
4. **Claude Opus**: `claude-opus-4` (Anthropic) - Most advanced Claude
5. **Claude Sonnet**: `claude-sonnet-4` (Anthropic) - Balanced performance
6. **Alternative**: `gemini-2.5-pro` or `gemini-2.5-flash` (Google) - Different provider

## API Endpoints

### Get Available Models
```
GET /api/chat/models
```

### Send Message with Model Selection
```
POST /api/chat/message
{
  "messages": [...],
  "modelName": "gpt-4.1"
}
```

### RAG with Model Selection
```
POST /api/rag/message
{
  "messages": [...],
  "workspaceId": "...",
  "modelName": "gpt-4.1"
}
```

## Error Handling

If the Google API key is not configured:
- The model selector will still show Gemini options
- API calls will fail with appropriate error messages
- Users can still use OpenAI models

## Cost Considerations

- **OpenAI**: Pay per token usage
- **Google Gemini**: Pay per request (different pricing model)

## Troubleshooting

### Common Issues

1. **"Invalid API Key"**
   - Verify your Google API key is correct
   - Ensure the key has access to Gemini API

2. **"Model not found"**
   - Check that the model name is correct
   - Verify the model is available in your region

3. **"Rate limit exceeded"**
   - Google has rate limits on API calls
   - Consider implementing retry logic

### Testing

Test the setup with a simple curl command:

```bash
curl -X POST http://localhost:5002/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "modelName": "gpt-4.1"
  }'
```

## Security Notes

- Never commit API keys to version control
- Use environment variables for all API keys
- Consider implementing API key rotation
- Monitor usage to prevent unexpected charges