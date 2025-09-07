import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    audioUrl?: string;
    className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, className = '' }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
            }
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Reset playback state if the audio source changes
    useEffect(() => {
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, [audioUrl]);

    return (
        <div className={`flex items-center ${className}`}>
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />}
            <button
                onClick={togglePlayPause}
                title={isPlaying ? 'Pause narration' : 'Play narration'}
                className="w-12 h-12 flex items-center justify-center text-2xl rounded-full shadow-md transition-transform transform bg-white hover:bg-orange-100 active:scale-90 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
                disabled={!audioUrl}
            >
                {isPlaying ? '⏸️' : '🔊'}
            </button>
        </div>
    );
};

export default AudioPlayer;