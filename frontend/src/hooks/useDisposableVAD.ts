import { useState, useCallback, useRef } from 'react';
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

export const useDisposableVAD = (callbacks: VADCallbacks, options: VADOptions = {}) => {
  const [isVADReady, setIsVADReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const currentVADRef = useRef<any>(null);
  const currentAudioContextRef = useRef<AudioContext | null>(null);

  const createVAD = useCallback(async (): Promise<any> => {
    if (isInitializing) {
      console.log('🎤 [VAD] Already initializing, skipping...');
      return null;
    }

    setIsInitializing(true);
    
    try {
      console.log('🎤 [VAD] Creating new VAD instance...');
      
      // Create a fresh AudioContext for this VAD instance
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      currentAudioContextRef.current = audioCtx;
      
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
      
      currentVADRef.current = vadInstance;
      setIsVADReady(true);
      console.log('✅ [VAD] New VAD instance created successfully');
      
      return vadInstance;
    } catch (error) {
      console.error('❌ [VAD] Failed to create VAD instance:', error);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  }, [callbacks, options, isInitializing]);

  const destroyVAD = useCallback(() => {
    console.log('🧹 [VAD] Destroying VAD instance...');
    
    if (currentVADRef.current) {
      try {
        currentVADRef.current.destroy();
      } catch (error) {
        console.warn('⚠️ [VAD] Error destroying VAD:', error);
      }
      currentVADRef.current = null;
    }
    
    if (currentAudioContextRef.current && currentAudioContextRef.current.state !== "closed") {
      try {
        currentAudioContextRef.current.close();
      } catch (error) {
        console.warn('⚠️ [VAD] Error closing AudioContext:', error);
      }
    }
    currentAudioContextRef.current = null;
    
    setIsVADReady(false);
    setIsListening(false);
    console.log('✅ [VAD] VAD instance destroyed');
  }, []);

  const startVAD = useCallback(async () => {
    if (!currentVADRef.current) {
      console.log('🎤 [VAD] No VAD instance, creating new one...');
      await createVAD();
    }
    
    if (currentVADRef.current) {
      try {
        currentVADRef.current.start();
        console.log('🎤 [VAD] VAD started');
      } catch (error) {
        console.warn('⚠️ [VAD] Error starting VAD:', error);
      }
    }
  }, [createVAD]);

  const pauseVAD = useCallback(() => {
    if (currentVADRef.current) {
      try {
        currentVADRef.current.pause();
        console.log('🎤 [VAD] VAD paused');
      } catch (error) {
        console.warn('⚠️ [VAD] Error pausing VAD:', error);
      }
    }
  }, []);

  const resetVAD = useCallback(() => {
    console.log('🔄 [VAD] Resetting VAD...');
    destroyVAD();
    // Don't create new instance immediately - wait for next startVAD call
  }, [destroyVAD]);

  return {
    isVADReady,
    isListening,
    isInitializing,
    startVAD,
    pauseVAD,
    destroyVAD,
    resetVAD,
    createVAD,
  };
}; 