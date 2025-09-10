import React, { useState, useRef } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Square, Volume2 } from 'lucide-react';
import { AudioStreamPlayer } from '@/lib/audioStreamPlayer';

export const AudioInterruptionTest: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCount, setAudioCount] = useState(0);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAudioTest = () => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioStreamPlayer();
    }

    setIsPlaying(true);
    setAudioCount(0);

    // Simulate multiple audio chunks being sent rapidly
    intervalRef.current = setInterval(() => {
      if (audioPlayerRef.current) {
        // Create a simple audio tone
        const sampleRate = 24000;
        const duration = 0.1; // 100ms
        const samples = Math.floor(sampleRate * duration);
        const audioData = new Int16Array(samples);
        
        // Generate a simple sine wave tone
        for (let i = 0; i < samples; i++) {
          const frequency = 440; // A4 note
          const amplitude = 0.3;
          audioData[i] = Math.floor(
            amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate) * 32767
          );
        }

        audioPlayerRef.current.addAudioData(audioData, `test-${Date.now()}`);
        setAudioCount(prev => prev + 1);
      }
    }, 50); // Send audio every 50ms to simulate rapid audio chunks
  };

  const stopAudioTest = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.interrupt();
    }
    
    setIsPlaying(false);
  };

  const testInterruption = () => {
    if (audioPlayerRef.current) {
      console.log('🎵 [TEST] Testing audio interruption...');
      audioPlayerRef.current.interrupt();
    }
  };

  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Audio Interruption Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Button 
              onClick={isPlaying ? stopAudioTest : startAudioTest}
              className="flex-1"
            >
              {isPlaying ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Test
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Test
                </>
              )}
            </Button>
            
            <Button 
              onClick={testInterruption}
              variant="outline"
              disabled={!isPlaying}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Interrupt
            </Button>
          </div>
          
          {isPlaying && (
            <div className="space-y-2">
              <p className="text-sm">Audio chunks sent: {audioCount}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(100, audioCount * 5)}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="p-3 bg-muted rounded">
            <p className="text-sm">
              This test simulates rapid audio chunks being sent to the audio player.
              Click "Interrupt" to test if the audio interruption works correctly.
              You should hear a continuous tone that stops when interrupted.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 