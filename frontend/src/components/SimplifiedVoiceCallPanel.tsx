import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Mic, Star, History, X, Trash2, Plus, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

interface WorkspaceVoiceCallPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string | null;
  workspaceName: string;
}

function SourceCitationBadge({ citation, onSourceClick }: { citation: SourceCitation; onSourceClick: (citation: SourceCitation) => void }) {
  return (
    <span 
      className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded cursor-pointer hover:bg-blue-200 transition-colors"
      onClick={() => onSourceClick(citation)}
    >
      📄 {citation.fileName}
      {citation.pageNumber && ` - Page ${citation.pageNumber}`}
      <span className="ml-1 opacity-70">({(citation.similarity * 100).toFixed(0)}%)</span>
    </span>
  );
}

function MessageWithSources({ message, onSourceClick }: { message: Message; onSourceClick: (citation: SourceCitation) => void }) {
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
  ];
  
  const parts = [];
  let lastIndex = 0;
  let matchFound = false;

  for (const pattern of sourcePatterns) {
    const matches = [...message.content.matchAll(pattern)];
    if (matches.length > 0) {
      matchFound = true;
      
      for (const match of matches) {
        if (match.index! > lastIndex) {
          parts.push({
            type: 'text',
            content: message.content.slice(lastIndex, match.index)
          });
        }

        const sourceNumbers = [parseInt(match[1])];
        if (match[2]) sourceNumbers.push(parseInt(match[2]));
        
        parts.push({
          type: 'citation',
          sourceNumbers,
          fullMatch: match[0]
        });

        lastIndex = match.index! + match[0].length;
      }
      break;
    }
  }

  if (lastIndex < message.content.length) {
    parts.push({
      type: 'text',
      content: message.content.slice(lastIndex)
    });
  }

  if (!matchFound) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {message.content}
      </ReactMarkdown>
    );
  }

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
            const citations = part.sourceNumbers.map(num => {
              let citation = message.sourceCitations?.find(c => c.chunkIndex === num - 1);
              
              if (!citation && message.sourceCitations && message.sourceCitations.length >= num) {
                citation = message.sourceCitations[num - 1];
              }
              
              if (!citation && message.sourceCitations && message.sourceCitations.length > 0) {
                citation = message.sourceCitations[0];
              }
              
              return citation;
            }).filter(Boolean) as SourceCitation[];
            
            return (
              <span key={index} className="inline">
                <span className="text-blue-600 font-medium cursor-pointer hover:underline hover:bg-blue-50 px-1 rounded" 
                      onClick={() => citations[0] && onSourceClick(citations[0])}>
                  {part.fullMatch}
                </span>
              </span>
            );
          }
        })}
      </div>
    </div>
  );
}

export const SimplifiedVoiceCallPanel: React.FC<WorkspaceVoiceCallPanelProps> = ({
  isOpen,
  onClose,
  workspaceId,
  workspaceName
}) => {
  console.log('🎤 [SIMPLIFIED-VOICE] Component loaded - isOpen:', isOpen);
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
  
  // TTS State
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  // Messages State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hi! I'm your AI assistant. I can help you understand your workspace content through voice conversation.",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);

  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const [selectedChatMode, setSelectedChatMode] = useState<ChatMode>("focused");

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
    formData.append('workspaceId', workspaceId || '');
    
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
            name: `Voice Call about ${workspaceName}`,
            workspaceId: workspaceId,
            mode: 'call'
          }),
        });

        const sessionData = await sessionResponse.json();
        if (sessionResponse.ok && sessionData.success) {
          setSessionId(sessionData.data.id);
        }
      }

      // Use RAG API for response
      const ragResponse = await fetch(buildApiUrl(API_ENDPOINTS.RAG.MESSAGE), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          workspaceId: workspaceId,
          fileId: null,
          modelName: selectedModel,
          chatMode: selectedChatMode
        }),
      });

      const ragData = await ragResponse.json();
      if (ragResponse.ok && ragData.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: ragData.message,
          isUser: false,
          timestamp: new Date(),
          sourceCitations: ragData.context?.sourceCitations || [],
        };

        setMessages(prev => [...prev, aiMessage]);

        // Save to session if we have a session ID
        if (sessionId) {
          try {
            await fetch(buildApiUrl(API_ENDPOINTS.CHAT.MESSAGES(sessionId)), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: messageContent.trim(),
              }),
            });
          } catch (error) {
            console.error('Error saving to session:', error);
          }
        }

        // Text-to-speech if enabled
        if (aiMessage.content) {
          await speakText(aiMessage.content);
        }
      } else {
        throw new Error(ragData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error sending message",
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
        pauseVAD();
        
        // Stop any playing audio
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          setIsTTSPlaying(false);
        }
        
        toast({
          title: "Speech Ended",
          description: "Voice call has been stopped",
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

  // Load call history
  const loadCallHistory = async () => {
    if (!workspaceId) return;
    
    setIsLoadingSessions(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(`/chat-sessions/sessions?workspaceId=${workspaceId}&mode=call`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setChatSessions(data.data);
      } else {
        console.error('Failed to load call history:', data.message);
        toast({
          title: "Failed to load call history",
          description: data.message || "Could not load call history",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading call history:', error);
      toast({
        title: "Error loading call history",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Load call session
  const loadCallSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSION(sessionId)), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const session = data.data;
        setSessionId(session.id);
        
        const sessionMessages: Message[] = session.messages?.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          isUser: msg.isUser,
          timestamp: new Date(msg.createdAt),
          sourceCitations: msg.sourceCitations || []
        })) || [];
        
        setMessages(sessionMessages);
        setShowHistoryDialog(false);
        
        toast({
          title: "Call loaded",
          description: `Loaded call from ${new Date(session.updatedAt).toLocaleDateString()}`,
        });
      } else {
        toast({
          title: "Failed to load call",
          description: data.message || "Could not load call session",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading call session:', error);
      toast({
        title: "Error loading call",
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  // Toggle star session
  const toggleStarSession = async (sessionId: string, isStarred: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.STAR(sessionId)), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isStarred }),
      });

      if (response.ok) {
        setChatSessions(prev => prev.map(session => 
          session.id === sessionId ? { ...session, isStarred } : session
        ));
        
        toast({
          title: isStarred ? "Call starred" : "Call unstarred",
          description: isStarred ? "Call saved permanently" : "Call will auto-delete in 24h",
        });
      }
    } catch (error) {
      console.error('Error toggling star status:', error);
      toast({
        title: "Error",
        description: "Failed to update call status",
        variant: "destructive",
      });
    }
  };

  // Delete call session
  const deleteCallSession = async (sessionIdToDelete: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.SESSION(sessionIdToDelete)), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setChatSessions(prev => prev.filter(session => session.id !== sessionIdToDelete));
        
        if (sessionIdToDelete === sessionId) {
          setSessionId(null);
          setMessages([{
            id: "1",
            content: "Hi! I'm your AI assistant. I can help you understand your workspace content through voice conversation. The call is now active - just start speaking!",
            isUser: false,
            timestamp: new Date(),
          }]);
        }
        
        toast({
          title: "Call deleted",
          description: "Call session has been deleted",
        });
      }
    } catch (error) {
      console.error('Error deleting call session:', error);
      toast({
        title: "Error",
        description: "Failed to delete call",
        variant: "destructive",
      });
    }
  };

  // Handle source citation click
  const handleSourceCitationClick = (citation: SourceCitation) => {
    try {
      const isYouTubeWithTimestamp = citation.metadata?.type === 'youtube' && citation.metadata?.timestamp;
      
      let url = `/file/${citation.fileId}`;
      let description = `Navigated to ${citation.fileName}`;
      
      if (isYouTubeWithTimestamp) {
        const timestamp = citation.metadata.timestamp;
        const minutes = Math.floor(timestamp / 60);
        const seconds = Math.floor(timestamp % 60);
        const timestampText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        url += `?timestamp=${timestamp}&citation=${encodeURIComponent(JSON.stringify(citation))}`;
        description += ` at ${timestampText}`;
      } else {
        url += `?citation=${encodeURIComponent(JSON.stringify(citation))}`;
        if (citation.pageNumber) {
          description += `, page ${citation.pageNumber}`;
        }
      }
      
      navigate(url);
      toast({
        title: "Source found",
        description: description,
      });
    } catch (error) {
      console.error('Error navigating to source:', error);
      toast({
        title: "Navigation failed",
        description: "Could not navigate to the source document",
        variant: "destructive",
      });
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatScrollRef.current) {
        const viewport = chatScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };

    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Cleanup on panel close
  useEffect(() => {
    if (!isOpen) {
      console.log('🔇 [SIMPLIFIED-VOICE] Panel closing - cleaning up');
      
      // Stop the call
      setIsCallActive(false);
      
      // Stop manual recording if active
      if (isRecording && mediaRecorder) {
        stopManualRecording();
      }
      
      // Stop VAD only if in continuous mode
      if (speechMode === 'continuous') {
        pauseVAD();
      }
      
      // Stop any playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setIsTTSPlaying(false);
      }
      
      // Reset states
      setIsProcessing(false);
    }
  }, [isOpen, currentAudio, isRecording, mediaRecorder, speechMode, pauseVAD]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup VAD only if it was initialized
      if (speechMode === 'continuous') {
        destroyVAD();
      }
      
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      // Cleanup AudioContext - check state before closing
      if (audioContextRef.current && audioContextRef.current.state !== "closed" && !isAudioContextClosed) {
        try {
          audioContextRef.current.close();
          setIsAudioContextClosed(true);
        } catch (error) {
          console.warn('AudioContext already closed or in invalid state:', error);
          setIsAudioContextClosed(true);
        }
      }
      // VAD cleanup is handled by the useDisposableVAD hook
    };
  }, [destroyVAD, currentAudio, speechMode]);

  // Load call history when dialog opens
  useEffect(() => {
    if (showHistoryDialog && workspaceId) {
      loadCallHistory();
    }
  }, [showHistoryDialog, workspaceId]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Mic className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Speech</h3>
            <p className="text-xs text-muted-foreground">Voice conversation with your Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <History className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Speech History</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : chatSessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No saved speech sessions</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chatSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                          sessionId === session.id ? 'bg-primary/10 border-primary' : 'border-border'
                        }`}
                        onClick={() => loadCallSession(session.id)}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {session.summary && session.summary !== 'null' 
                                ? (session.summary.length > 30 ? session.summary.substring(0, 30) + '...' : session.summary)
                                : session.name || 'Unnamed Call'}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate">
                                {new Date(session.updatedAt).toLocaleDateString()}
                              </p>
                              {!session.isStarred && (
                                <span className="text-xs text-orange-500 truncate">
                                  • Auto-delete in 24h
                                </span>
                              )}
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 w-fit">
                              Voice Call
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStarSession(session.id, !session.isStarred);
                            }}
                            className={`h-6 w-6 p-0 hover:bg-yellow-50 ${
                              session.isStarred 
                                ? 'text-yellow-500 hover:text-yellow-600' 
                                : 'text-muted-foreground hover:text-yellow-500'
                            }`}
                            title={session.isStarred ? "Unstar this call" : "Star this call"}
                          >
                            <Star className={`w-3 h-3 ${session.isStarred ? 'fill-current' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCallSession(session.id);
                            }}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  onClick={() => {
                    setShowHistoryDialog(false);
                    setSessionId(null);
                    setMessages([{
                      id: "1",
                      content: "Hi! I'm your AI assistant. I can help you understand your workspace content through voice conversation.",
                      isUser: false,
                      timestamp: new Date(),
                    }]);
                  }}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Call
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
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

      {/* Call Controls */}
      <div className="p-2 border-t border-border flex-shrink-0">
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