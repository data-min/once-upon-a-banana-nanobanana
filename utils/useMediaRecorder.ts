import { useState, useRef, useEffect } from 'react';

// FIX: Add minimal type definitions for the Web Speech API to satisfy TypeScript
// for use in the useSpeechRecognition hook.
interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
}

type RecorderStatus = 'idle' | 'permission' | 'recording' | 'stopped' | 'error';

export const useMediaRecorder = (options: { isVideo: boolean; timeLimit?: number }) => {
  const { isVideo, timeLimit = 30 } = options;
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(timeLimit);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getPermissions = async () => {
    setStatus('permission');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      setStream(mediaStream);
      setStatus('idle');
      return mediaStream;
    } catch (err) {
      setError('Permission denied. Please allow access to your microphone and camera.');
      setStatus('error');
      return null;
    }
  };

  const startRecording = async () => {
    let currentStream = stream;
    if (!currentStream) {
      currentStream = await getPermissions();
    }
    if (!currentStream) return;

    setStatus('recording');
    setTimer(timeLimit);
    chunksRef.current = [];

    const recorder = new MediaRecorder(currentStream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      setStatus('stopped');
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
    };

    recorder.start();

    timerIntervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setStatus('stopped');
  };

  const getMediaBlob = (): Blob | null => {
    if (chunksRef.current.length === 0) return null;
    const mimeType = isVideo ? 'video/webm' : 'audio/webm';
    return new Blob(chunksRef.current, { type: mimeType });
  };
  
  const reset = () => {
    setStatus('idle');
    setError(null);
    setTimer(timeLimit);
  }

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  return { status, startRecording, stopRecording, getMediaBlob, timer, error, reset, stream };
};

// Simple Web Speech API Hook for transcription
export const useSpeechRecognition = () => {
    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        // FIX: Access non-standard window properties with a type assertion to any.
        const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionApi) {
            console.error('Speech recognition not supported in this browser.');
            return;
        }
        
        const recognition: SpeechRecognition = new SpeechRecognitionApi();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
              setTranscript(prev => prev ? `${prev} ${finalTranscript}`.trim() : finalTranscript.trim());
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                setError('Microphone permission denied. Please allow microphone access in your browser settings.');
            } else if (event.error === 'no-speech') {
                setError('No speech was detected. Please try speaking again.');
            } else {
                setError(`Speech recognition failed: ${event.error}. Please try again or check your connection.`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            // This event fires when recognition stops, either manually or automatically.
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
           if (recognitionRef.current) {
                recognitionRef.current.stop();
           }
        };
    }, []);

    const startListening = () => {
        if (recognitionRef.current && !isListening) {
            setTranscript('');
            setError(null);
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const stopListening = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };
    
    return { transcript, isListening, startListening, stopListening, supported: !!recognitionRef.current, error };
};