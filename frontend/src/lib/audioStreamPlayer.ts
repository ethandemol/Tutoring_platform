/**
 * Simple audio stream player for real-time voice chat
 * Handles audio playback from OpenAI Realtime API
 */

export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: Int16Array[] = [];
  private isPlaying = false;
  private sampleRate = 24000;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentItemId: string | null = null;
  private audioGain: GainNode | null = null;
  private isInterrupted = false;
  private isPlayingAudio = false;
  private pendingAudioQueue: { audioData: Int16Array; itemId?: string }[] = [];

  constructor() {
    this.initAudioContext();
  }

  private async initAudioContext() {
    try {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      
      // Create a gain node for volume control and smooth transitions
      this.audioGain = this.audioContext.createGain();
      this.audioGain.connect(this.audioContext.destination);
      
      console.log('🎵 [AUDIO] Audio context initialized');
    } catch (error) {
      console.error('❌ [AUDIO] Failed to initialize audio context:', error);
    }
  }

  /**
   * Stop current audio playback with fade out
   */
  private stopCurrentAudio() {
    if (this.currentSource && this.audioGain) {
      try {
        // Fade out the audio smoothly
        this.audioGain.gain.setValueAtTime(this.audioGain.gain.value, this.audioContext!.currentTime);
        this.audioGain.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + 0.1);
        
        // Stop the source after fade out
        setTimeout(() => {
          if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource.disconnect();
            this.currentSource = null;
          }
        }, 100);
      } catch (error) {
        // Audio might have already finished
        console.log('🎵 [AUDIO] Audio already stopped');
        this.currentSource = null;
      }
    }
    
    // Clear the pending queue
    this.pendingAudioQueue = [];
    this.isPlayingAudio = false;
  }

  /**
   * Add audio data to the playback queue
   * @param audioData - Int16Array audio data
   * @param itemId - Conversation item ID (for tracking)
   */
  addAudioData(audioData: Int16Array, itemId?: string) {
    if (!this.audioContext || !this.audioGain) {
      console.warn('⚠️ [AUDIO] Audio context not initialized');
      return;
    }

    // If interrupted, don't play new audio
    if (this.isInterrupted) {
      console.log('🎵 [AUDIO] Audio interrupted, skipping playback');
      return;
    }

    console.log(`🎵 [AUDIO] Adding audio data, size: ${audioData.length}, itemId: ${itemId}`);
    
    // If this is a new item, stop current audio and clear queue
    if (itemId && itemId !== this.currentItemId) {
      console.log(`🎵 [AUDIO] New item detected, stopping current audio and clearing queue`);
      this.stopCurrentAudio();
      this.currentItemId = itemId;
      this.pendingAudioQueue = [];
      this.isPlayingAudio = false;
    }
    
    // Add to pending queue
    this.pendingAudioQueue.push({ audioData, itemId });
    
    // If not currently playing, start playing
    if (!this.isPlayingAudio) {
      this.playNextAudioChunk();
    }
  }

  /**
   * Play the next audio chunk from the queue
   */
  private playNextAudioChunk() {
    if (this.pendingAudioQueue.length === 0 || this.isInterrupted) {
      this.isPlayingAudio = false;
      return;
    }

    const { audioData, itemId } = this.pendingAudioQueue.shift()!;
    this.isPlayingAudio = true;
    
    // Convert Int16Array to Float32Array for Web Audio API
    const float32Array = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Array[i] = audioData[i] / 32768.0; // Convert 16-bit to float
    }

    // Create audio buffer
    const audioBuffer = this.audioContext!.createBuffer(1, float32Array.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    // Create audio source and play
    const source = this.audioContext!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioGain!);
    
    // Store reference to current source
    this.currentSource = source;
    
    // Set up cleanup when audio finishes
    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
      }
      // Play next chunk when this one finishes
      this.playNextAudioChunk();
    };
    
    // Fade in the audio smoothly
    this.audioGain!.gain.setValueAtTime(0, this.audioContext!.currentTime);
    this.audioGain!.gain.linearRampToValueAtTime(1, this.audioContext!.currentTime + 0.05);
    
    // Play the audio
    source.start();
    console.log(`🎵 [AUDIO] Playing audio chunk, duration: ${audioBuffer.duration}s`);
  }

  /**
   * Resume audio context (needed after user interaction)
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('🎵 [AUDIO] Audio context resumed');
    }
  }

  /**
   * Stop all audio playback
   */
  stop() {
    this.stopCurrentAudio();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioQueue = [];
    this.pendingAudioQueue = [];
    this.isPlaying = false;
    this.isPlayingAudio = false;
    this.currentItemId = null;
    this.isInterrupted = false;
    console.log('🎵 [AUDIO] Audio player stopped');
  }

  /**
   * Interrupt current audio playback
   */
  interrupt() {
    console.log('🎵 [AUDIO] Interrupting current audio');
    this.isInterrupted = true;
    this.stopCurrentAudio();
    this.currentItemId = null;
    
    // Reset interruption flag after a short delay
    setTimeout(() => {
      this.isInterrupted = false;
    }, 500);
  }

  /**
   * Check if audio is currently playing
   */
  isCurrentlyPlaying() {
    return this.isPlayingAudio || this.currentSource !== null;
  }
} 