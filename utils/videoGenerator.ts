export async function combineVideoScenes(
    videoBlobUrls: string[],
    onProgress: (progress: number, message: string) => void
): Promise<string> {
    return new Promise(async (resolve, reject) => {
        onProgress(0, 'Setting up the video studio...');
        
        const canvas = document.createElement('canvas');
        // Standard 720p resolution
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Could not get canvas context');

        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const audioTrack = dest.stream.getAudioTracks()[0];
        
        const canvasStream = canvas.captureStream(30); // 30 FPS
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            audioTrack,
        ]);
        
        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            onProgress(100, 'Your video is complete!');
            resolve(URL.createObjectURL(blob));
            audioCtx.close();
        };

        recorder.start();
        onProgress(5, 'Starting the final recording...');

        const videoElement = document.createElement('video');
        videoElement.muted = false; // Ensure audio can be heard and captured
        const videoSourceNode = audioCtx.createMediaElementSource(videoElement);
        videoSourceNode.connect(dest);
        videoSourceNode.connect(audioCtx.destination); // Connect to speakers to hear it

        const drawFrame = () => {
            if (videoElement.paused || videoElement.ended) return;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
        };

        videoElement.addEventListener('play', drawFrame);

        for (let i = 0; i < videoBlobUrls.length; i++) {
            const url = videoBlobUrls[i];
            const progress = 10 + (i / videoBlobUrls.length) * 85;
            onProgress(progress, `Adding scene ${i + 1} of ${videoBlobUrls.length}...`);
            
            videoElement.src = url;
            
            await new Promise<void>(res => { videoElement.onloadedmetadata = () => res(); });
            
            try {
                 await videoElement.play();
            } catch (e) {
                console.error("Video playback error:", e);
                // Attempt to unmute and play again if autoplay fails
                videoElement.muted = false;
                await videoElement.play().catch(finalError => {
                    console.error("Final playback attempt failed:", finalError);
                    reject(`Could not play video for scene ${i+1}.`);
                });
            }
            
            await new Promise<void>(res => { videoElement.onended = () => res(); });
        }

        onProgress(98, 'Finalizing the video file...');
        recorder.stop();
    });
}