import React, { useState } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Play, Square } from 'lucide-react';
import { WavRecorder } from '@/lib/wavtools';

export const WavRecorderTest: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioCount, setAudioCount] = useState(0);
  const [wavRecorder, setWavRecorder] = useState<WavRecorder | null>(null);
  const [testResult, setTestResult] = useState<string>('');

  const startTest = async () => {
    try {
      setTestResult('Starting WavRecorder test...');
      setAudioCount(0);
      
      const recorder = new WavRecorder({
        sampleRate: 24000,
        outputToSpeakers: false,
        debug: true
      });
      
      setWavRecorder(recorder);
      
      console.log('🎤 [TEST] Beginning WavRecorder session...');
      await recorder.begin();
      
      console.log('🎤 [TEST] Starting WavRecorder recording...');
      await recorder.record((data) => {
        setAudioCount(prev => prev + 1);
        console.log('🎤 [TEST] Audio chunk received, size:', data.mono.byteLength);
      }, 4096);
      
      setIsRecording(true);
      setTestResult('Recording... Speak into your microphone');
      
    } catch (error) {
      console.error('🎤 [TEST] Failed to start recording:', error);
      setTestResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stopTest = async () => {
    if (!wavRecorder) return;
    
    try {
      console.log('🎤 [TEST] Stopping WavRecorder...');
      await wavRecorder.pause();
      await wavRecorder.quit();
      
      setIsRecording(false);
      setWavRecorder(null);
      setTestResult(`Test completed! Total audio chunks: ${audioCount}`);
      
    } catch (error) {
      console.error('🎤 [TEST] Error stopping recording:', error);
      setTestResult(`Error stopping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>WavRecorder Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button 
            onClick={isRecording ? stopTest : startTest}
            disabled={isRecording && !wavRecorder}
            className="w-full"
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop Test
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Test
              </>
            )}
          </Button>
          
          {isRecording && (
            <div className="space-y-2">
              <p className="text-sm">Audio chunks detected: {audioCount}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(100, audioCount * 2)}%` }}
                />
              </div>
            </div>
          )}
          
          {testResult && (
            <div className="p-3 bg-muted rounded">
              <p className="text-sm">{testResult}</p>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            This test verifies that WavRecorder can capture audio from your microphone.
            Speak into your microphone for 10 seconds to test audio capture.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 