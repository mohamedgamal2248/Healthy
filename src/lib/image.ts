"use client";

/** Downscale + re-encode a photo to a JPEG data URL (max side 1024 px) so uploads stay small and fast. */
export async function toCompressedDataUrl(source: Blob | HTMLVideoElement, maxSide = 1024, quality = 0.82): Promise<string> {
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void;
  if (source instanceof HTMLVideoElement) {
    w = source.videoWidth; h = source.videoHeight;
    draw = (ctx, cw, ch) => ctx.drawImage(source, 0, 0, cw, ch);
  } else {
    const bmp = await createImageBitmap(source).catch(async () => {
      const url = URL.createObjectURL(source);
      try {
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("decode")); img.src = url; });
        return img as unknown as ImageBitmap;
      } finally { URL.revokeObjectURL(url); }
    });
    w = (bmp as ImageBitmap).width; h = (bmp as ImageBitmap).height;
    draw = (ctx, cw, ch) => ctx.drawImage(bmp as CanvasImageSource, 0, 0, cw, ch);
  }
  if (!w || !h) throw new Error("empty image");
  const k = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.round(w * k), ch = Math.round(h * k);
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  draw(ctx, cw, ch);
  let q = quality, out = canvas.toDataURL("image/jpeg", q);
  while (out.length > 1_900_000 && q > 0.4) { q -= 0.12; out = canvas.toDataURL("image/jpeg", q); }
  return out;
}
