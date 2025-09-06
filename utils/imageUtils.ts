const MAX_WIDTH = 800; // Define a max width for stored images
const JPEG_QUALITY = 0.8; // 80% quality

export const compressImageBase64 = (base64String: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64String;

        img.onload = () => {
            let { width, height } = img;

            // Only resize if the image is wider than our max width
            if (width > MAX_WIDTH) {
                height = (height * MAX_WIDTH) / width;
                width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Get the data URL for the resized image as a JPEG
            const compressedBase64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            resolve(compressedBase64);
        };

        img.onerror = (error) => {
            reject(new Error('Failed to load image for compression.'));
        };
    });
};
