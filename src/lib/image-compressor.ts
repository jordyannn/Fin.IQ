/**
 * Helper kompresi gambar client-side sebelum dikirim ke Gemini OCR.
 * Menjaga rasio aspek, menurunkan dimensi max 1600px, dan mengonversi ke JPEG kualitas 85%.
 */
export async function compressImageToBase64(
  file: File,
  maxWidth = 1600,
  quality = 0.85
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = (readerEvent) => {
      const rawDataUrl = (readerEvent.target?.result as string) || "";
      const img = new Image();
      img.onerror = () => {
        // Fallback: jika canvas browser gagal me-render format gambar, kirim base64 asli
        const clean = rawDataUrl.replace(/^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/, "");
        if (clean) {
          resolve({
            base64: clean,
            mimeType: file.type || "image/jpeg",
            previewUrl: rawDataUrl,
          });
        } else {
          reject(new Error("Format gambar tidak valid atau korup."));
        }
      };
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          const clean = rawDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
          resolve({
            base64: clean,
            mimeType: file.type || "image/jpeg",
            previewUrl: rawDataUrl,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

        resolve({
          base64,
          mimeType: "image/jpeg",
          previewUrl: dataUrl,
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
