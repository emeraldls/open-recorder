interface WorkerPayload {
  canvas?: OffscreenCanvas;
  frame?: ImageBitmap;
  brightness?: number;
  contrast?: number;
  colorBoost?: number;
  enableChromaKey?: boolean;
}

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;

// Default processing values
let brightness = 20;
let contrast = 1.2;
let colorBoost = 1.1;
let enableChromaKey = false;

function computeFrame(frame: ImageBitmap) {
  if (!ctx || !canvas) return;

  // Ensure canvas size matches the frame size
  if (canvas.width !== frame.width || canvas.height !== frame.height) {
    canvas.width = frame.width;
    canvas.height = frame.height;
  }

  ctx.drawImage(frame, 0, 0);
  frame.close(); // Close the bitmap to free memory

  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const length = data.length / 4;

    for (let i = 0; i < length; i++) {
      const baseIndex = i * 4;
      let r = data[baseIndex];
      let g = data[baseIndex + 1];
      let b = data[baseIndex + 2];

      // Apply effects
      r = contrast * (r - 128) + 128 + brightness;
      g = contrast * (g - 128) + 128 + brightness;
      b = contrast * (b - 128) + 128 + brightness;

      r = Math.min(255, Math.max(0, r));
      g = Math.min(255, Math.max(0, g));
      b = Math.min(255, Math.max(0, b));

      r = Math.min(255, r * colorBoost);
      g = Math.min(255, g * colorBoost);
      b = Math.min(255, b * colorBoost);

      if (enableChromaKey && g > 100 && r > 100 && b < 43) {
        data[baseIndex + 3] = 0; // Make transparent
      }

      data[baseIndex] = r;
      data[baseIndex + 1] = g;
      data[baseIndex + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error("Worker: Error processing frame:", error);
  }
}

self.onmessage = (
  e: MessageEvent<{ type: string; payload: WorkerPayload }>
) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init":
      if (payload.canvas) {
        canvas = payload.canvas;
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        console.log("Worker: OffscreenCanvas initialized");
      }
      break;
    case "frame":
      if (payload.frame) {
        computeFrame(payload.frame);
      }
      break;
    case "update-params":
      brightness = payload.brightness ?? brightness;
      contrast = payload.contrast ?? contrast;
      colorBoost = payload.colorBoost ?? colorBoost;
      enableChromaKey = payload.enableChromaKey ?? enableChromaKey;
      break;
  }
};
