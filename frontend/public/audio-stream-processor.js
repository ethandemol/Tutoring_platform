class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.receive.bind(this);
    this.recording = false;
    this.foundAudio = false;
  }

  receive(e) {
    const { event } = e.data;
    switch (event) {
      case 'start':
        this.recording = true;
        this.foundAudio = false;
        break;
      case 'stop':
        this.recording = false;
        break;
      case 'reset':
        this.foundAudio = false;
        break;
      default:
        break;
    }
  }

  /**
   * Converts 32-bit float data to 16-bit integers
   */
  floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
    }
    return int16Array;
  }

  process(inputList, outputList, parameters) {
    const inputs = inputList[0];
    
    // Process audio for voice chat recording (no output copying to prevent echo)
    if (inputs && inputs[0] && this.recording) {
      // Check for actual audio data
      let hasAudio = false;
      let maxAmplitude = 0;
      
      for (const channel of inputs) {
        if (channel) {
          for (const value of channel) {
            const absValue = Math.abs(value);
            if (absValue > 0.001) {
              hasAudio = true;
              maxAmplitude = Math.max(maxAmplitude, absValue);
            }
          }
        }
      }

      if (hasAudio) {
        this.foundAudio = true;
        
        // Get mono audio (average of all channels)
        const monoChannel = new Float32Array(inputs[0].length);
        for (let i = 0; i < inputs[0].length; i++) {
          let sum = 0;
          for (let channel = 0; channel < inputs.length; channel++) {
            sum += inputs[channel][i];
          }
          monoChannel[i] = sum / inputs.length;
        }

        // Convert to Int16Array and send to main thread
        const int16Array = this.floatTo16BitPCM(monoChannel);
        this.port.postMessage({
          event: 'audioData',
          data: Array.from(int16Array)
        });
      }
    }

    return true;
  }
}

registerProcessor('stream_processor', AudioStreamProcessor); 