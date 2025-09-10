class AudioPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.receive.bind(this);
    this.playbackBuffer = [];
    this.isPlaying = false;
  }

  receive(e) {
    const { event, buffer, trackId } = e.data;
    switch (event) {
      case 'reset':
        this.playbackBuffer = [];
        this.isPlaying = false;
        break;
      case 'write':
        // Handle playback audio data
        if (trackId === 'ai-response' && buffer) {
          this.playbackBuffer.push(...buffer);
          this.isPlaying = true;
        }
        break;
      default:
        break;
    }
  }

  process(inputList, outputList, parameters) {
    const outputs = outputList[0];
    
    // Handle playback (AI responses)
    if (this.isPlaying && this.playbackBuffer.length > 0 && outputs && outputs[0]) {
      const outputChannel = outputs[0];
      const samplesToPlay = Math.min(this.playbackBuffer.length, outputChannel.length);
      
      for (let i = 0; i < samplesToPlay; i++) {
        outputChannel[i] = this.playbackBuffer.shift();
      }
      
      // Fill remaining output with silence
      for (let i = samplesToPlay; i < outputChannel.length; i++) {
        outputChannel[i] = 0;
      }
      
      // If buffer is empty, stop playing
      if (this.playbackBuffer.length === 0) {
        this.isPlaying = false;
        this.port.postMessage({ event: 'stop' });
      }
    } else if (outputs && outputs[0]) {
      // Fill output with silence when not playing
      for (let i = 0; i < outputs[0].length; i++) {
        outputs[0][i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('playback_processor', AudioPlaybackProcessor); 