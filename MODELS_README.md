# Sparqit AI Models Configuration

This document outlines all the OpenAI models used throughout the Sparqit application for different functionalities.

## 📋 Model Overview

| Function | Model | Purpose | Configuration |
|----------|-------|---------|---------------|
| **Chat** | `gpt-4o-mini` | General conversation | 2000 tokens, 0.7 temp |
| **RAG** | `gpt-4o-mini` | Document-based responses | 2000 tokens, 0.7 temp |
| **Content Generation** | `gpt-4o-mini` | Study materials, quizzes, flashcards | 2000 tokens, 0.7 temp |
| **Handwriting Recognition** | `gpt-4o` | Convert handwritten math to LaTeX | 2000 tokens, 0.1 temp |
| **Advanced Chat** | `gpt-4.1` | Complex reasoning and analysis | 2000 tokens, 0.7 temp |
| **Claude Opus** | `claude-opus-4` | Most advanced Claude model | 2000 tokens, 0.7 temp |
| **Claude Sonnet** | `claude-sonnet-4` | Balanced performance model | 2000 tokens, 0.7 temp |
| **Alternative Chat** | `gemini-2.5-pro` | Google Gemini 2.5 Pro model | 2000 tokens, 0.7 temp |
| **Fast Alternative** | `gemini-2.5-flash` | Google Gemini 2.5 Flash model | 2000 tokens, 0.7 temp |
| **Embeddings** | `text-embedding-3-small` | Vector embeddings for similarity search | 1536 dimensions |
| **Tokenization** | `gpt-4` | Text chunking and token counting | Modern tokenizer |

---

## 🤖 Chat Models

### General Chat (`chatService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Basic conversation and document analysis
- **Configuration**:
  - Max tokens: 1000-1500
  - Temperature: 0.7
  - Stream: false

### Document Analysis (`chatService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Analyze specific document content
- **Configuration**:
  - Max tokens: 1500
  - Temperature: 0.5
  - Stream: false

### Advanced Chat (`chatService.js`)
- **Model**: `gpt-4.1`
- **Purpose**: Complex reasoning and advanced analysis tasks
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

---

## 🔍 RAG (Retrieval-Augmented Generation) Models

### RAG Chat (`ragChatService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Context-aware responses with source citations
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false
- **Features**:
  - Source citation enforcement
  - Document context integration
  - Citation distribution monitoring

### RAG All Documents (`ragChatService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Search across all workspace documents
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

### Document-Specific RAG (`ragChatService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Focus on specific document content
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

---

## 📚 Content Generation Models

### Study Materials (`contentGenerationService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Generate study guides, notes, and summaries
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

### Quiz Generation (`contentGenerationService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Create multiple-choice and open-ended questions
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

### Flashcard Generation (`contentGenerationService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Create flashcards with questions and answers
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

### Practice Problems (`contentGenerationService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Generate practice exercises and problems
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

### Exam Generation (`contentGenerationService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Create comprehensive exams and tests
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

### Cheatsheet Generation (`contentGenerationService.js`)
- **Model**: `gpt-4o-mini`
- **Purpose**: Create concise reference materials
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.7
  - Stream: false

---

## ✍️ Handwriting Recognition Models

### LaTeX Conversion (`handwriting.js`)
- **Model**: `gpt-4o`
- **Purpose**: Convert handwritten mathematical content to LaTeX
- **Configuration**:
  - Max tokens: 2000
  - Temperature: 0.1
  - Vision: enabled
- **Features**:
  - Mathematical expression recognition
  - LaTeX syntax generation
  - Error correction and validation

### LaTeX Error Fixing (`handwriting.js`)
- **Model**: `