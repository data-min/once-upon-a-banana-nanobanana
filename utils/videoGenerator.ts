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

export async function mergeAudioAndVideo(
    videoBlobUrl: string,
    audioBlobUrl: string,
    onProgress: (progress: number, message: string) => void
): Promise<string> {
    return new Promise(async (resolve, reject) => {
        onProgress(0, 'Setting up video & audio...');

        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));

        let audioCtx: AudioContext;
        try {
            audioCtx = new AudioContext();
        } catch (e) {
            return reject(new Error('Could not create AudioContext.'));
        }
        
        const dest = audioCtx.createMediaStreamDestination();
        const audioTrack = dest.stream.getAudioTracks()[0];

        const canvasStream = canvas.captureStream(30);
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            audioTrack,
        ]);

        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(URL.createObjectURL(blob));
            if (audioCtx.state !== 'closed') {
                audioCtx.close();
            }
        };
        recorder.onerror = (e) => {
            const error = (e as any).error || new Error('Unknown MediaRecorder error');
            reject(new Error(`MediaRecorder error: ${error.name || error.message}`));
            if (audioCtx.state !== 'closed') {
                audioCtx.close();
            }
        };

        const videoElement = document.createElement('video');
        videoElement.muted = true;
        videoElement.src = videoBlobUrl;

        const audioElement = document.createElement('audio');
        audioElement.src = audioBlobUrl;
        
        const audioSourceNode = audioCtx.createMediaElementSource(audioElement);
        audioSourceNode.connect(dest);

        const drawFrame = () => {
            if (videoElement.paused || videoElement.ended) return;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
        };

        videoElement.addEventListener('play', drawFrame);

        try {
            await Promise.all([
                new Promise<void>((res, rej) => { videoElement.onloadeddata = () => res(); videoElement.onerror = () => rej(new Error('Video file is invalid.')); }),
                new Promise<void>((res, rej) => { audioElement.onloadeddata = () => res(); audioElement.onerror = () => rej(new Error('Audio file is invalid.')); }),
            ]);
        } catch (err) {
            return reject(err);
        }

        onProgress(50, 'Combining narration and animation...');
        recorder.start();
        
        try {
            // Browsers may suspend the audio context until a user gesture.
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            await Promise.all([videoElement.play(), audioElement.play()]);
        } catch (error) {
            return reject(new Error(`Playback failed: ${error}. This can happen if the browser blocks autoplay.`));
        }

        videoElement.onended = () => {
            setTimeout(() => {
                if(recorder.state === 'recording') {
                   recorder.stop();
                }
                onProgress(100, 'Finalizing...');
            }, 500); // Wait a moment to capture the last frame/audio
        };
    });
}