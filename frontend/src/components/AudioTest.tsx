import React, { useState } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff } from 'lucide-react';

export const AudioTest: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioCount, setAudioCount] = useState(0);
  const [lastAmplitude, setLastAmplitude] = useState(0);

  const testAudioCapture = async () => {
    console.log('🎤 [TEST] Testing audio capture...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 24000 } 
      });
      console.log('🎤 [TEST] Microphone access granted');
      
      const audioContext = new AudioContext({ sampleRate: 24000 });
      await audioContext.resume();
      console.log('🎤 [TEST] Audio context state:', audioContext.state);
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let count = 0;
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const maxAmplitude = Math.max(...inputData.map(sample => Math.abs(sample)));
        
        if (maxAmplitude > 0.001) {
          count++;
          setAudioCount(count);
          setLastAmplitude(maxAmplitude);
          console.log('🎤 [TEST] Audio detected, count:', count, 'amplitude:', maxAmplitude);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
      
      // Stop after 10 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        setIsRecording(false);
        console.log('🎤 [TEST] Audio test completed, total audio chunks:', count);
      }, 10000);
      
    } catch (error) {
      console.error('🎤 [TEST] Audio test failed:', error);
    }
  };

  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Audio Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={testAudioCapture}
            disabled={isRecording}
            className="w-full"
          >
            {isRecording ? (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Testing Audio...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Audio Test
              </>
            )}
          </Button>
          
          {isRecording && (
            <div className="space-y-2">
              <p className="text-sm">Audio chunks detected: {audioCount}</p>
              <p className="text-sm">Last amplitude: {lastAmplitude.toFixed(4)}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(100, lastAmplitude * 1000)}%` }}
                />
              </div>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Speak into your microphone for 10 seconds to test audio capture
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 