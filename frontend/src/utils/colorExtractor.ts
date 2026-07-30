export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
}

export const extractColorsFromImage = (imageUrl: string): Promise<ExtractedColors> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      // Resize for performance
      const MAX_SIZE = 100;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height).data;
      let r = 0, g = 0, b = 0;
      let count = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        // Skip bright/white or overly dark pixels to find rich colors
        const brightness = (imageData[i] + imageData[i+1] + imageData[i+2]) / 3;
        if (brightness < 20 || brightness > 230) continue;
        
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
      }

      if (count === 0) {
        // Fallback if image was purely white/black
        r = g = b = 128;
        count = 1;
      }

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      // Simple generation of complementary/analogous shades
      const primary = `rgb(${r}, ${g}, ${b})`;
      const secondary = `rgb(${Math.min(255, r + 50)}, ${Math.max(0, g - 30)}, ${b})`;
      const accent = `rgb(${Math.max(0, r - 30)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 30)})`;
      
      // For dark themes, background is a very dark tint of the dominant color
      const bgR = Math.floor(r * 0.1);
      const bgG = Math.floor(g * 0.1);
      const bgB = Math.floor(b * 0.1);
      
      const background = `rgb(${bgR}, ${bgG}, ${bgB})`;
      const surface = `rgba(${Math.floor(r * 0.2)}, ${Math.floor(g * 0.2)}, ${Math.floor(b * 0.2)}, 0.8)`;

      resolve({
        primary,
        secondary,
        accent,
        background,
        surface
      });
    };

    img.onerror = () => reject('Failed to load image');
    img.src = imageUrl;
  });
};
