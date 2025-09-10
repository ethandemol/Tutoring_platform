import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Mic, FileText, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { useDisposableVAD } from '@/hooks/useDisposableVAD';
import { ModelSelector } from './ModelSelector';
import { ChatModeSelector, ChatMode } from './ChatModeSelector';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sourceCitations?: SourceCitation[];
}

interface SourceCitation {
  chunkId: number;
  fileId: number;
  fileName: string;
  pageNumber?: number;
  startChar: number;
  endChar: number;
  similarity: number;
  chunkIndex: number;
  content: string;
  metadata?: {
    timestamp?: number;
    type?: string;
  };
}

interface ChatSession {
  id: string;
  name: string;
  workspaceId?: string;
  fileId?: string;
  mode?: 'chat' | 'call';
  isStarred?: boolean;
  summary?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

interface FileVoiceCallPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  workspaceId: string;
}

function SourceCitationBadge({ citation, onSourceClick }: { citation: SourceCitation; onSourceClick: (citation: SourceCitation) => void }) {
  // Check if this is a YouTube video with timestamp
  const isYouTubeWithTimestamp = citation.metadata?.type === 'youtube' && citation.metadata?.timestamp;
  
  if (isYouTubeWithTimestamp) {
    const timestamp = citation.metadata.timestamp;
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const timestampText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    return (
      <Badge 
        variant="secondary" 
        className="cursor-pointer hover:bg-blue-100 transition-colors"
        onClick={() => onSourceClick(citation)}
      >
        <FileText className="w-3 h-3 mr-1" />
        {timestampText}
        <span className="ml-1 text-xs opacity-70">({(citation.similarity * 100).toFixed(0)}%)</span>
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="secondary" 
      className="cursor-pointer hover:bg-blue-100 transition-colors"
      onClick={() => onSourceClick(citation)}
    >
      <FileText className="w-3 h-3 mr-1" />
      {citation.fileName}
      {citation.pageNumber && ` - Page ${citation.pageNumber}`}
      <span className="ml-1 text-xs opacity-70">({(citation.similarity * 100).toFixed(0)}%)</span>
    </Badge>
  );
}

// Component to render message with source citations
const MessageWithSources = React.memo(({ message, onSourceClick }: { message: Message; onSourceClick: (citation: SourceCitation) => void }) => {

  // Multiple patterns to catch different citation formats
  const sourcePatterns = [
    /\[SOURCE (\d+)(?:, (\d+))*\]/g,
    /\[Source (\d+)(?:, (\d+))*\]/g,
    /\[source (\d+)(?:, (\d+))*\]/g,
    /SOURCE (\d+)(?:, (\d+))*\b/g,
    /Source (\d+)(?:, (\d+))*\b/g,
    /\(SOURCE (\d+)(?:, (\d+))*\)/g,
    /\(Source (\d+)(?:, (\d+))*\)/g,
    /"SOURCE (\d+)(?:, (\d+))*"/g,
    /"Source (\d+)(?:, (\d+))*"/g,
    /• \[SOURCE (\d+)(?:, (\d+))*\]/g,
    /• \[Source (\d+)(?:, (\d+))*\]/g,
  ];

  let matchFound = false;
  let parts: Array<{ type: 'text' | 'citation'; content: string; sourceNumbers: number[]; fullMatch: string }> = [];
  let lastIndex = 0;

  // Try each pattern
  for (const pattern of sourcePatterns) {
    const matches = [...message.content.matchAll(pattern)];
    
    if (matches.length > 0) {
      matchFound = true;
      
      matches.forEach((match) => {
        if (match.index! > lastIndex) {
          parts.push({
            type: 'text',
            content: message.content.slice(lastIndex, match.index),
            sourceNumbers: [],
            fullMatch: ''
          });
        }
        
        const sourceNumbers = match.slice(1).filter(Boolean).map(Number);
        
        parts.push({
          type: 'citation',
          content: match[0],
          sourceNumbers,
          fullMatch: match[0]
        });
        
        lastIndex = match.index! + match[0].length;
      });
      
      break; // Use the first pattern that finds matches
    }
  }

  // Add remaining text
  if (lastIndex < message.content.length) {
    parts.push({
      type: 'text',
      content: message.content.slice(lastIndex),
      sourceNumbers: [],
      fullMatch: ''
    });
  }

  // If no citations found, just render the text normally with markdown
  if (!matchFound) {
    
    // Fallback: Look for any text in brackets that might be a citation
    const fallbackPattern = /\[([^\]]+)\]/g;
    const fallbackMatches = [...message.content.matchAll(fallbackPattern)];
    
    if (fallbackMatches.length > 0) {
      
      // Render with fallback citations
      const fallbackParts = [];
      let fallbackLastIndex = 0;
      
      fallbackMatches.forEach((match, index) => {
        if (match.index! > fallbackLastIndex) {
          fallbackParts.push({
            type: 'text',
            content: message.content.slice(fallbackLastIndex, match.index)
          });
        }
        
        fallbackParts.push({
          type: 'fallback_citation',
          content: match[0],
          citationText: match[1]
        });
        
        fallbackLastIndex = match.index! + match[0].length;
      });
      
      if (fallbackLastIndex < message.content.length) {
        fallbackParts.push({
          type: 'text',
          content: message.content.slice(fallbackLastIndex)
        });
      }
      
      return (
        <div className="prose prose-sm max-w-none space-y-4">
          {fallbackParts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <span key={index}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.content}
                  </ReactMarkdown>
                </span>
              );
            } else {
              // Check if this is a YouTube video citation
              const matchingCitation = message.sourceCitations?.[0];
              if (matchingCitation?.metadata?.type === 'youtube' && matchingCitation.metadata?.timestamp) {
                // For YouTube videos, show the timestamp as plain text (not clickable)
                const timestamp = matchingCitation.metadata.timestamp;
                const minutes = Math.floor(timestamp / 60);
                const seconds = Math.floor(timestamp % 60);
                return (
                  <span key={index} className="inline-flex items-center gap-1">
                    <span className="text-foreground text-sm">
                      {`${minutes}:${seconds.toString().padStart(2, '0')}`}
                    </span>
                  </span>
                );
              }
              
              return (
                <span key={index} className="inline-flex items-center gap-1">
                  <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                        onClick={() => {
                          console.log('Fallback citation clicked:', part.citationText);
                          // Try to find a matching citation
                          if (matchingCitation) {
                            onSourceClick(matchingCitation);
                          }
                        }}>
                    {part.content}
                  </span>
                </span>
              );
            }
          })}
        </div>
      );
    }
    
    // No citations at all, just render with markdown
    return (
      <div className="prose prose-sm max-w-none space-y-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render with inline citations
  return (
    <div className="prose prose-sm max-w-none space-y-4">
      <div className="inline">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <span key={index} className="inline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {part.content}
                </ReactMarkdown>
              </span>
            );
          } else {
            // Find the corresponding source citations
            const citations = part.sourceNumbers.map(num => {
              // Try to find citation by chunkIndex first (num - 1 because AI uses 1-based indexing)
              let citation = message.sourceCitations?.find(c => c.chunkIndex === num - 1);
              
              // If not found, try to find by array index
              if (!citation && message.sourceCitations && message.sourceCitations.length >= num) {
                citation = message.sourceCitations[num - 1];
              }
              
              // If still not found, use the first available citation
              if (!citation && message.sourceCitations && message.sourceCitations.length > 0) {
                citation = message.sourceCitations[0];
              }
              
              console.log(`🔍 Looking for citation ${num}:`);
              console.log(`   - By chunkIndex ${num - 1}:`, message.sourceCitations?.find(c => c.chunkIndex === num - 1));
              console.log(`   - By array index ${num - 1}:`, message.sourceCitations?.[num - 1]);
              console.log(`   - Final result:`, citation);
              console.log(`📋 Available citations:`, message.sourceCitations?.map(c => ({ chunkIndex: c.chunkIndex, fileName: c.fileName })));
              
              return citation;
            }).filter(Boolean) as SourceCitation[];
            
            console.log(`✅ Citations found for part ${index}:`, citations);
            
            return (
              <span key={index} className="inline">
                {(() => {
                  // Check if this is a YouTube video with timestamp
                  const citation = citations[0];
                  if (citation?.metadata?.type === 'youtube' && citation.metadata?.timestamp) {
                    // For YouTube videos, show the timestamp as plain text (not clickable)
                    const timestamp = citation.metadata.timestamp;
                    const minutes = Math.floor(timestamp / 60);
                    const seconds = Math.floor(timestamp % 60);
                    return (
                      <span className="text-foreground text-sm">
                        {`${minutes}:${seconds.toString().padStart(2, '0')}`}
                      </span>
                    );
                  }
                  // For non-YouTube files, show the original clickable [source x] format
                  return (
                    <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                          onClick={() => {
                            console.log('🎯 Citation clicked:', part.fullMatch);
                            console.log('📄 Citation data:', citations[0]);
                            citations[0] && onSourceClick(citations[0]);
                          }}>
                      {part.fullMatch}
                    </span>
                  );
                })()}
              </span>
            );
          }
        })}
      </div>
    </div>
  );
});

export const FileVoiceCallPanel: React.FC<FileVoiceCallPanelProps> = ({
  isOpen,
  onClose,
  fileId,
  fileName,
  workspaceId
}) => {
  console.log('🎤 [FILE-VOICE] Component loaded - isOpen:', isOpen);
  const { toast } = useToast();
  const navigate = useNavigate();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // VAD and Audio State
  const [isCallActive, setIsCallActive] = useState(false);
  
  // Speech Mode State
  const [speechMode, setSpeechMode] = useState<'manual' | 'continuous'>('manual');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  
  // Audio Context - single instance for the component
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isAudioContextClosed, setIsAudioContextClosed] = useState(false);
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  
  // TTS State
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  // Messages State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: `Hi! I'm your AI assistant. I can help you understand "${fileName}" through voice conversation.`,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);

  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const [selectedChatMode, setSelectedChatMode] = useState<ChatMode>("focused");

  // Create new session function
  const createNewSession = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Voice Call about ${fileName}`,
          workspaceId: parseInt(workspaceId),
          fileId: parseInt(fileId),
          mode: 'call',
        }),
      });

      if (response.ok) {
        const sessionData = await response.json();
        if (sessionData.success) {
          setSessionId(sessionData.data.id);
        }
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  // Update session function
  const updateSession = async (sessionId: string, messages: Message[]) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.MESSAGES(sessionId)), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            content: msg.content,
            isUser: msg.isUser,
            sourceCitations: msg.sourceCitations || []
          }))
        }),
      });

      if (!response.ok) {
        console.error('Failed to update session');
      }
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  // Disposable VAD Hook
  const {
    isVADReady,
    isListening,
    isInitializing,
    startVAD,
    pauseVAD,
    destroyVAD,
    resetVAD,
  } = useDisposableVAD(
    {
      onSpeechStart: () => {
        console.log('🎤 [VAD] Speech detected - user started speaking');
      },
      onSpeechEnd: (audio: Float32Array) => {
        console.log('🎤 [VAD] Speech ended - processing user input');
        handleSpeechEnd(audio);
      },
      onVADMisfire: () => {
        console.log('🎤 [VAD] VAD misfire detected');
      },
    },
    {
      positiveSpeechThreshold: 0.8,
      negativeSpeechThreshold: 0.3,
      redemptionFrames: 8,
      preSpeechPadFrames: 1,
      minSpeechFrames: 3,
      frameSamples: 1536,
    }
  );

  // Cleanup function to stop all audio and VAD
  const cleanupAudioAndVAD = useCallback(() => {
    console.log('🧹 [CLEANUP] Stopping all audio and VAD');
    
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsTTSPlaying(false);
    }
    
    // Stop VAD
    pauseVAD();
    destroyVAD();
    
    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== "closed" && !isAudioContextClosed) {
      try {
        audioContextRef.current.close();
        setIsAudioContextClosed(true);
      } catch (error) {
        console.warn('AudioContext already closed or in invalid state:', error);
        setIsAudioContextClosed(true);
      }
    }
  }, [currentAudio, pauseVAD, destroyVAD, isAudioContextClosed]);

  // Save session when call ends
  const saveSession = useCallback(async () => {
    if (sessionId && messages.length > 1) {
      try {
        await updateSession(sessionId, messages);
        console.log('💾 [SESSION] Session saved successfully');
      } catch (error) {
        console.error('❌ [SESSION] Failed to save session:', error);
      }
    }
  }, [sessionId, messages]);

  // Initialize VAD only when switching to continuous mode
  useEffect(() => {
    if (speechMode === 'continuous' && !isVADReady && !isInitializing) {
      startVAD().catch((error) => {
        console.error('❌ [VAD] Failed to initialize VAD:', error);
        toast({
          title: "VAD Initialization Failed",
          description: "Voice activity detection could not be initialized",
          variant: "destructive",
        });
      });
    }
  }, [speechMode, isVADReady, isInitializing, startVAD]);

  // Manual Recording Functions
  const startManualRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Match VAD sample rate
        } 
      });
      
      // Clear any existing chunks
      setAudioChunks([]);
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('🎤 [MANUAL] Audio chunk received:', event.data.size, 'bytes');
        }
      };
      
      recorder.onstop = async () => {
        console.log('🎤 [MANUAL] Recording stopped, processing', chunks.length, 'chunks');
        
        if (chunks.length > 0) {
          try {
            // Convert MediaRecorder chunks to Float32Array (same as VAD)
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            console.log('🎤 [MANUAL] Created audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
            
            // Convert to Float32Array using the same method as VAD
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const channelData = audioBuffer.getChannelData(0);
            
            // Convert to WAV using the same function as VAD
            const wavBlob = await audioBufferToWav(audioBuffer);
            console.log('🎤 [MANUAL] Converted to WAV:', wavBlob.size, 'bytes');
            
            // Process the recorded audio using the same pipeline as VAD
            await handleManualSpeechEnd(wavBlob);
            
            // Close the audio context
            audioContext.close();
          } catch (error) {
            console.error('❌ [MANUAL] Failed to process audio:', error);
            toast({
              title: "Audio Processing Failed",
              description: "Could not process the recorded audio",
              variant: "destructive",
            });
          }
        } else {
          console.error('❌ [MANUAL] No audio chunks collected');
          toast({
            title: "Recording Failed",
            description: "No audio was recorded. Please try again.",
            variant: "destructive",
          });
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.onerror = (event) => {
        console.error('❌ [MANUAL] MediaRecorder error:', event);
        toast({
          title: "Recording Error",
          description: "An error occurred during recording",
          variant: "destructive",
        });
      };
      
      setMediaRecorder(recorder);
      recorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      console.log('🎤 [MANUAL] Started recording');
    } catch (error) {
      console.error('❌ [MANUAL] Failed to start recording:', error);
      toast({
        title: "Recording Failed",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopManualRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      console.log('🎤 [MANUAL] Stopped recording');
    }
  };

  const handleManualSpeechEnd = async (audioBlob: Blob) => {
    console.log('🎤 [MANUAL] Processing recorded audio');
    
    // Don't process if AI is currently speaking
    if (isTTSPlaying) {
      console.log('🎤 [MANUAL] Ignoring speech while AI is speaking');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Transcribe the audio
      const transcription = await transcribeAudio(audioBlob);
      
      if (transcription.trim()) {
        console.log('🎤 [MANUAL] Transcription:', transcription);
        
        // Process the message (this will add the user message to the array)
        await processUserMessage(transcription);
      }
    } catch (error) {
      console.error('❌ [MANUAL] Failed to process manual recording:', error);
      toast({
        title: "Processing Failed",
        description: "Could not process your voice input",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle speech end - this is the main processing function
  const handleSpeechEnd = useCallback(async (audio: Float32Array) => {
    console.log('🎤 [SPEECH-END] Processing user speech');
    
    // Don't process if AI is currently speaking
    if (isTTSPlaying) {
      console.log('🎤 [SPEECH-END] Ignoring speech while AI is speaking');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Convert Float32Array to audio blob for transcription
      const audioBlob = await convertFloat32ArrayToBlob(audio);
      
      // Transcribe the audio
      const transcribedText = await transcribeAudio(audioBlob);
      
      if (transcribedText && transcribedText.trim()) {
        console.log('🎤 [SPEECH-END] Transcribed text:', transcribedText);
        
        // Send the transcribed text through the conversation pipeline
        await processUserMessage(transcribedText);
      } else {
        console.log('🎤 [SPEECH-END] No speech detected in audio');
        toast({
          title: "No speech detected",
          description: "Please try speaking more clearly",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [SPEECH-END] Error processing speech:', error);
      toast({
        title: "Speech processing failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      // Reset VAD after processing to create a fresh instance for next speech
      resetVAD();
    }
  }, [isTTSPlaying, resetVAD]);

  // Convert Float32Array to audio blob
  const convertFloat32ArrayToBlob = async (audioData: Float32Array): Promise<Blob> => {
    // Use existing AudioContext or create new one
    if (!audioContextRef.current || audioContextRef.current.state === "closed" || isAudioContextClosed) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        setIsAudioContextClosed(false);
      } catch (error) {
        console.error('Failed to create AudioContext:', error);
        throw new Error('Failed to initialize audio processing');
      }
    }
    
    const audioContext = audioContextRef.current;
    const sampleRate = 16000; // Silero VAD default sample rate
    
    // Create an AudioBuffer
    const audioBuffer = audioContext.createBuffer(1, audioData.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Copy the Float32Array data
    channelData.set(audioData);
    
    // Convert to WAV format
    const wavBlob = await audioBufferToWav(audioBuffer);
    
    // Don't close the AudioContext - let it be reused
    return wavBlob;
  };

  // Convert AudioBuffer to WAV blob
  const audioBufferToWav = async (buffer: AudioBuffer): Promise<Blob> => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Transcribe audio using existing API
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    console.log('🎤 [TRANSCRIBE] Audio blob size:', audioBlob.size, 'bytes, type:', audioBlob.type);
    
    if (audioBlob.size === 0) {
      throw new Error('Audio file is empty');
    }
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('workspaceId', workspaceId);
    
    const response = await fetch(buildApiUrl(API_ENDPOINTS.TRANSCRIBE.TRANSCRIBE), {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TRANSCRIBE] Backend error:', response.status, errorText);
      throw new Error(`Transcription failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('🎤 [TRANSCRIBE] Transcription result:', result);
    return result.text;
  };

  // Process user message through RAG pipeline
  const processUserMessage = async (messageContent: string) => {
    if (!messageContent?.trim() || isSending) return;

    // Debug: Check if fileId is valid
    console.log('🔍 [FileVoiceCallPanel] Processing message with fileId:', fileId, 'type:', typeof fileId);
    console.log('🔍 [FileVoiceCallPanel] Processing message with workspaceId:', workspaceId, 'type:', typeof workspaceId);
    
    if (!fileId || fileId === 'undefined' || fileId === 'null') {
      console.error('❌ [FileVoiceCallPanel] Invalid fileId:', fileId);
      toast({
        title: "Error",
        description: "Invalid file ID. Please try refreshing the page.",
        variant: "destructive",
      });
      return;
    }

    if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
      console.error('❌ [FileVoiceCallPanel] Invalid workspaceId:', workspaceId);
      toast({
        title: "Error",
        description: "Invalid workspace ID. Please try refreshing the page.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    try {
      const token = localStorage.getItem('authToken');
      
      // Create session for voice call if not exists
      if (!sessionId) {
        const sessionResponse = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSIONS), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Voice Call about ${fileName}`,
            workspaceId: workspaceId,
            fileId: fileId,
            mode: 'call',
          }),
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.success) {
            setSessionId(sessionData.data.id);
          }
        }
      }

      // Convert frontend message format to OpenAI format for RAG API
      const openaiMessages = [...messages, userMessage].map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content
      }));

      // Send message to RAG API
      console.log('🔍 [FileVoiceCallPanel] Sending RAG request with:', {
        workspaceId: parseInt(workspaceId),
        fileId: parseInt(fileId),
        sessionId: sessionId,
        modelName: selectedModel,
        messageCount: openaiMessages.length
      });
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.RAG.MESSAGE), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: openaiMessages,
          workspaceId: parseInt(workspaceId),
          fileId: parseInt(fileId),
          sessionId: sessionId,
          modelName: selectedModel,
          chatMode: selectedChatMode
        }),
      });

      console.log('🔍 [FileVoiceCallPanel] RAG response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [FileVoiceCallPanel] RAG API error:', errorText);
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 [FileVoiceCallPanel] RAG response data:', {
        success: data.success,
        messageLength: data.message?.length,
        sourceCitations: data.context?.sourceCitations?.length
      });
      
      if (data.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message,
          isUser: false,
          timestamp: new Date(),
          sourceCitations: data.context?.sourceCitations || [],
        };

        setMessages(prev => [...prev, aiMessage]);

        // Text-to-speech if enabled
        if (aiMessage.content) {
          await speakText(aiMessage.content);
        }
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Text-to-speech function
  const speakText = async (text: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.TTS.TTS), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Stop any currently playing audio
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        
        setCurrentAudio(audio);
        setIsTTSPlaying(true);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setIsTTSPlaying(false);
          console.log('🎤 [TTS] AI finished speaking - ready for next user input');
          // Reset VAD after AI finishes speaking to prepare for next user input
          resetVAD();
        };
        
        audio.onpause = () => {
          setIsTTSPlaying(false);
        };
        
        audio.play();
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsTTSPlaying(false);
    }
  };

  // Start/Stop voice call
  const toggleCall = async () => {
    if (speechMode === 'manual') {
      // Manual mode - toggle recording
      if (isRecording) {
        stopManualRecording();
      } else {
        await startManualRecording();
      }
    } else {
      // Continuous mode - use VAD
      if (!isVADReady) {
        toast({
          title: "VAD Not Ready",
          description: "Voice activity detection is still initializing",
          variant: "destructive",
        });
        return;
      }

      if (isCallActive) {
        // Stop the call
        console.log('📞 [CALL] Stopping voice call');
        setIsCallActive(false);
        
        // Cleanup audio and VAD
        cleanupAudioAndVAD();
        
        // Save session
        await saveSession();
        
        toast({
          title: "Speech Ended",
          description: "Voice call has been stopped and session saved",
        });
      } else {
        // Start the call
        console.log('📞 [CALL] Starting voice call');
        setIsCallActive(true);
        
        startVAD();
        
        toast({
          title: "Speech Started",
          description: "Voice call is now active - just start speaking!",
        });
      }
    }
  };



  // Handle source citation click
  const handleSourceCitationClick = (citation: SourceCitation) => {
    console.log('📄 [CITATION] Clicked citation:', citation);
    
    // Navigate to the file preview page and scroll to the specific page
    if (citation.pageNumber) {
      navigate(`/file/${citation.fileId}?page=${citation.pageNumber}`);
    } else {
      navigate(`/file/${citation.fileId}`);
    }
    
    // Close the voice call panel
    onClose();
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    };
    
    scrollToBottom();
  }, [messages]);

  // Cleanup when panel closes
  useEffect(() => {
    if (!isOpen) {
      console.log('🔇 [FILE-VOICE] Panel closing - cleaning up');
      
      // Stop the call
      setIsCallActive(false);
      
      // Stop manual recording if active
      if (isRecording && mediaRecorder) {
        stopManualRecording();
      }
      
      // Cleanup audio and VAD only if in continuous mode
      if (speechMode === 'continuous') {
        cleanupAudioAndVAD();
      }
      
      // Save session if call was active
      if (isCallActive) {
        saveSession();
      }
    }
  }, [isOpen, cleanupAudioAndVAD, saveSession, isCallActive, isRecording, mediaRecorder, speechMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup VAD only if it was initialized
      if (speechMode === 'continuous') {
        destroyVAD();
      }
      
      // Cleanup audio and VAD
      cleanupAudioAndVAD();
      
      // Save session if call was active
      if (isCallActive) {
        saveSession();
      }
    };
  }, [cleanupAudioAndVAD, saveSession, isCallActive, speechMode, destroyVAD]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-background" style={{ height: '600px' }}>
      {/* Messages Area - Scrollable middle section */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full" ref={chatScrollRef}>
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.isUser ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <MessageWithSources 
                      message={message} 
                      onSourceClick={handleSourceCitationClick}
                    />
                  )}
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Quick Start Options - Show only when there's just the initial message */}
            {messages.length === 1 && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start text-left h-auto p-3"
                  onClick={() => processUserMessage("I want to be quizzed on this material. Can you ask me what specific topics or concepts I'd like to be tested on?")}
                >
                  <div className="text-sm">Quiz me on this material</div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-left h-auto p-3"
                  onClick={() => processUserMessage("I want to practice my presentation. Can you ask me if I have any reference slides and what the general purpose of this presentation is?")}
                >
                  <div className="text-sm">Help me practice my presentation</div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-left h-auto p-3"
                  onClick={() => processUserMessage("I want to do a mock interview. Can you ask me if I have any resume or specific interview questions to reference?")}
                >
                  <div className="text-sm">Help me do a mock interview</div>
                </Button>
              </div>
            )}
            
            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg bg-muted text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <p className="text-sm">AI is thinking...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Mode Selector */}
      <div className="px-4 py-3 border-t border-border">
        <ChatModeSelector
          selectedMode={selectedChatMode}
          onModeChange={setSelectedChatMode}
        />
      </div>

      {/* Call Controls - Fixed at bottom */}
      <div className="p-2 border-t border-border bg-background flex-shrink-0">
        <div className="flex flex-col items-center gap-2">
          {/* Speech Mode Selector */}
          <div className="flex items-center gap-2 w-full">
            <Label htmlFor="speech-mode" className="text-xs">Speech Mode:</Label>
            <Switch
              id="speech-mode"
              checked={speechMode === 'continuous'}
              onCheckedChange={(checked) => setSpeechMode(checked ? 'continuous' : 'manual')}
            />
            <Label htmlFor="speech-mode" className="text-xs">
              {speechMode === 'manual' ? 'Manual' : 'Continuous'}
            </Label>
          </div>
          
          {/* Call Button */}
          <Button
            onClick={toggleCall}
            disabled={isProcessing || isTTSPlaying || (speechMode === 'continuous' && !isVADReady)}
            className={`w-full h-12 ${
              (speechMode === 'manual' && isRecording) || (speechMode === 'continuous' && isCallActive)
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </div>
            ) : isTTSPlaying ? (
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span>AI Speaking...</span>
              </div>
            ) : (speechMode === 'manual' && isRecording) || (speechMode === 'continuous' && isCallActive) ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>{speechMode === 'manual' ? 'Stop Recording' : 'Speak Now'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </div>
            )}
          </Button>
          
          {/* Model Selector */}
          <div className="flex justify-center w-full">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}; 