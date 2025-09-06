export const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const parts = result.split(',');
      if (parts.length !== 2) {
        return reject(new Error("Invalid Data URL."));
      }
      const [mimeInfo, base64Content] = parts;
      const mimeType = mimeInfo.split(':')[1]?.split(';')[0];
       if (!mimeType) {
        return reject(new Error("Could not determine MIME type from data URL."));
      }
      resolve({ base64: base64Content, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};
