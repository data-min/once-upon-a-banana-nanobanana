
import React, { useState, useEffect } from 'react';
import { Book } from '../types';
import { combineVideoScenes } from '../utils/videoGenerator';
import Button from './Button';

interface Props {
    book: Book;
    onClose: () => void;
}

type Stage = 'fetching' | 'combining' | 'done' | 'error';

const VideoGeneratorModal: React.FC<Props> = ({ book, onClose }) => {
    const [stage, setStage] = useState<Stage>('fetching');
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('Initializing...');
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const generate = async () => {
            try {
                // STAGE 1: FETCHING
                setStage('fetching');
                const sceneUrls = book.pages.map(p => p.videoUrl).filter((url): url is string => !!url);
                if (sceneUrls.length === 0) {
                    throw new Error("You haven't generated a video for any page yet. Please go back to the editor and create at least one page video.");
                }

                setMessage('Downloading video scenes...');
                const videoBlobs: Blob[] = [];
                for (let i = 0; i < sceneUrls.length; i++) {
                    const url = sceneUrls[i];
                    setProgress(i / sceneUrls.length * 50); // Fetching is first half
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Failed to fetch scene ${i + 1}`);
                    videoBlobs.push(await response.blob());
                }
                const videoBlobUrls = videoBlobs.map(b => URL.createObjectURL(b));

                // STAGE 2: COMBINING
                setStage('combining');
                setMessage('Stitching your story together...');
                setProgress(50); // Start combining progress at 50%
                const finalUrl = await combineVideoScenes(videoBlobUrls, (p, m) => {
                    setProgress(50 + p * 0.5); // Combining is second half
                    setMessage(m);
                });
                setFinalVideoUrl(finalUrl);

                setStage('done');
                setMessage('Your video is complete!');
                
                // Cleanup
                videoBlobUrls.forEach(URL.revokeObjectURL);

            } catch (err) {
                console.error('Video generation failed:', err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred during video creation.');
                setStage('error');
            }
        };

        generate();

    }, [book]);

    const isGenerating = stage !== 'done' && stage !== 'error';

    const stageMessages: Record<Stage, string> = {
        fetching: 'Preparing Video Files...',
        combining: 'Assembling Your Movie...',
        done: 'Your video is ready!',
        error: 'Oh no! Something went wrong.'
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-amber-50 rounded-2xl p-8 max-w-lg w-full shadow-2xl text-center">
                <h3 className="font-display text-4xl text-orange-500 mb-6">{stageMessages[stage]}</h3>
                
                {isGenerating && (
                    <div>
                        <div className="w-full bg-orange-200 rounded-full h-4 mb-2">
                            <div className="bg-orange-500 h-4 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s' }}></div>
                        </div>
                        <p className="font-body text-gray-600 min-h-[2rem]">{message}</p>
                    </div>
                )}
                
                {stage === 'error' && (
                     <p className="font-body text-sm text-red-600 bg-red-100 p-3 rounded-lg">{error}</p>
                )}

                {stage === 'done' && finalVideoUrl && (
                    <div className="animate-fade-in">
                        <video src={finalVideoUrl} controls className="w-full rounded-lg mb-4"></video>
                        <a href={finalVideoUrl} download={`${book.title}.webm`}>
                            <Button>Download Video</Button>
                        </a>
                    </div>
                )}

                <div className="mt-6">
                    <Button onClick={onClose} variant="secondary" disabled={isGenerating}>
                       {isGenerating ? 'Please Wait' : 'Close'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default VideoGeneratorModal;
