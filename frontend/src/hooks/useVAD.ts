import { useState, useEffect, useRef, useCallback } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { MicVAD } from "@ricky0123/vad-web";

interface VADCallbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array) => void;
  onVADMisfire: () => void;
}

interface VADOptions {
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
  redemptionFrames?: number;
  preSpeechPadFrames?: number;
  minSpeechFrames?: number;
  frameSamples?: number;
}

export const useVAD = (callbacks: VADCallbacks, options: VADOptions = {}) => {
  const [vad, setVad] = useState<any>(null);
  const [isVADReady, setIsVADReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const vadAudioContextRef = useRef<AudioContext | null>(null);
  const isInitializing = useRef(false);

  const initializeVAD = useCallback(async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;

    try {
      console.log('🎤 [VAD] Initializing Silero VAD...');
      
      // Create a separate AudioContext for VAD
      const vadAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      vadAudioContextRef.current = vadAudioCtx;
      
      const vadInstance = await MicVAD.new({
        onSpeechStart: () => {
          console.log('🎤 [VAD] Speech detected - user started speaking');
          setIsListening(true);
          callbacks.onSpeechStart();
        },
        onSpeechEnd: (audio: Float32Array) => {
          console.log('🎤 [VAD] Speech ended - processing user input');
          setIsListening(false);
          callbacks.onSpeechEnd(audio);
        },
        onVADMisfire: () => {
          console.log('🎤 [VAD] VAD misfire detected');
          setIsListening(false);
          callbacks.onVADMisfire();
        },
        // VAD Configuration with defaults
        positiveSpeechThreshold: options.positiveSpeechThreshold ?? 0.8,
        negativeSpeechThreshold: options.negativeSpeechThreshold ?? 0.3,
        redemptionFrames: options.redemptionFrames ?? 8,
        preSpeechPadFrames: options.preSpeechPadFrames ?? 1,
        minSpeechFrames: options.minSpeechFrames ?? 3,
        frameSamples: options.frameSamples ?? 1536,
      });
      
      setVad(vadInstance);
      setIsVADReady(true);
      console.log('✅ [VAD] Silero VAD initialized successfully');
    } catch (error) {
      console.error('❌ [VAD] Failed to initialize VAD:', error);
      throw error;
    } finally {
      isInitializing.current = false;
    }
  }, [callbacks, options]);

  const destroyVAD = useCallback(() => {
    if (vad) {
      try {
        vad.destroy();
      } catch (error) {
        console.warn('Error destroying VAD:', error);
      }
      setVad(null);
      setIsVADReady(false);
      setIsListening(false);
    }
    
    // Cleanup VAD AudioContext
    if (vadAudioContextRef.current && vadAudioContextRef.current.state !== "closed") {
      try {
        vadAudioContextRef.current.close();
      } catch (error) {
        console.warn('Error closing VAD AudioContext:', error);
      }
    }
    vadAudioContextRef.current = null;
  }, [vad]);

  const startVAD = useCallback(() => {
    if (vad && isVADReady) {
      try {
        vad.start();
      } catch (error) {
        console.warn('Error starting VAD:', error);
      }
    }
  }, [vad, isVADReady]);

  const pauseVAD = useCallback(() => {
    if (vad) {
      try {
        vad.pause();
      } catch (error) {
        console.warn('Error pausing VAD:', error);
      }
    }
  }, [vad]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyVAD();
    };
  }, [destroyVAD]);

  return {
    vad,
    isVADReady,
    isListening,
    initializeVAD,
    destroyVAD,
    startVAD,
    pauseVAD,
  };
}; 