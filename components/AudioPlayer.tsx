import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    src: string;
    className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className = '' }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };
    
    // Reset playing state if the audio source changes (e.g., navigating pages)
    useEffect(() => {
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    }, [src]);

    return (
        <div className={`flex items-center ${className}`}>
            <audio 
                ref={audioRef} 
                src={src} 
                onEnded={() => setIsPlaying(false)} 
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                preload="auto" 
            />
            <button
                onClick={togglePlayPause}
                title={isPlaying ? 'Pause narration' : 'Play narration'}
                className="w-12 h-12 flex items-center justify-center text-2xl rounded-full shadow-md transition-transform transform bg-white hover:bg-orange-100 active:scale-90 focus:outline-none focus:ring-2 focus:ring-orange-400"
                aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
            >
                {isPlaying ? '⏸️' : '🔊'}
            </button>
        </div>
    );
};

export default AudioPlayer;
