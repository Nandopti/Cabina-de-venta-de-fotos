/**
 * Arma el JPEG final.
 *
 * Librería: ninguna. Canvas es parte del navegador y sirve para recortar,
 * filtrar y enmarcar. El archivo resultante es el que se cobra, se descarga
 * y se comparte.
 *
 * Tamaño 1080×1350 (proporción 4:5). Se ve bien en el celular y en Instagram.
 */

const PHOTO_WIDTH = 1080;
const PHOTO_HEIGHT = 1350;

export async function composePhoto({ source, style, frame, mirror }) {
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  const ctx = canvas.getContext("2d");
  const rect = photoRect(frame.id);

  ctx.fillStyle = backgroundFor(frame.id);
  ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);

  const { width: srcW, height: srcH } = sourceSize(source);
  if (!srcW || !srcH) {
    throw new Error("La cámara todavía no tiene imagen. Espera un segundo y dispara otra vez.");
  }

  const crop = coverCrop(srcW, srcH, rect.w, rect.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = style.canvas || "none";
  if (mirror) {
    ctx.translate(rect.x + rect.w, rect.y);
    ctx.scale(-1, 1);
    ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, rect.w, rect.h);
  } else {
    ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();

  drawFrame(ctx, frame.id, style.name);
  return canvasToBlob(canvas);
}

/**
 * Foto pintada para probar el flujo sin cámara (pago, QR y compartir).
 * También es el respaldo si el usuario niega el permiso.
 */
export function createSampleCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 1200);
  sky.addColorStop(0, "#f0a202");
  sky.addColorStop(0.45, "#d4526e");
  sky.addColorStop(1, "#1c3d32");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 900, 1200);

  ctx.fillStyle = "#f6f0e4";
  ctx.beginPath();
  ctx.arc(450, 470, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2a1a16";
  ctx.beginPath();
  ctx.arc(450, 430, 150, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#f6f0e4";
  ctx.fillRect(250, 690, 400, 420);

  ctx.fillStyle = "#10241c";
  ctx.font = "700 42px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("FOTO DE MUESTRA", 450, 1120);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No pude generar el JPEG."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92,
    );
  });
}

function sourceSize(source) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function coverCrop(srcW, srcH, dstW, dstH) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const sw = srcH * dstRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / dstRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

function photoRect(frameId) {
  if (frameId === "polaroid") return { x: 56, y: 56, w: PHOTO_WIDTH - 112, h: PHOTO_HEIGHT - 250 };
  if (frameId === "feria") return { x: 72, y: 72, w: PHOTO_WIDTH - 144, h: PHOTO_HEIGHT - 230 };
  if (frameId === "cine") return { x: 0, y: 168, w: PHOTO_WIDTH, h: PHOTO_HEIGHT - 336 };
  return { x: 0, y: 0, w: PHOTO_WIDTH, h: PHOTO_HEIGHT };
}

function backgroundFor(frameId) {
  if (frameId === "polaroid") return "#f4efe6";
  if (frameId === "feria") return "#14352c";
  if (frameId === "cine") return "#0d0d0d";
  return "#10241c";
}

function drawFrame(ctx, frameId, styleName) {
  if (frameId === "polaroid") drawPolaroid(ctx, styleName);
  if (frameId === "feria") drawFeria(ctx, styleName);
  if (frameId === "cine") drawCine(ctx);
}

function drawPolaroid(ctx, styleName) {
  ctx.fillStyle = "#1c140e";
  ctx.font = "600 42px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("Cabina de retratos", PHOTO_WIDTH / 2, PHOTO_HEIGHT - 118);
  ctx.font = "400 28px Georgia, serif";
  ctx.fillStyle = "#7a6556";
  const date = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillText(`${styleName} · ${date}`, PHOTO_WIDTH / 2, PHOTO_HEIGHT - 68);
}

function drawFeria(ctx, styleName) {
  ctx.strokeStyle = "#f0a202";
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, PHOTO_WIDTH - 56, PHOTO_HEIGHT - 56);
  ctx.fillStyle = "#f0a202";
  for (const [x, y] of [
    [28, 28],
    [PHOTO_WIDTH - 28, 28],
    [28, PHOTO_HEIGHT - 28],
    [PHOTO_WIDTH - 28, PHOTO_HEIGHT - 28],
  ]) {
    diamond(ctx, x, y, 16);
  }
  ctx.font = "700 36px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(`CABINA  ·  ${styleName.toUpperCase()}`, PHOTO_WIDTH / 2, PHOTO_HEIGHT - 78);
}

function drawCine(ctx) {
  ctx.fillStyle = "#f6f0e4";
  ctx.font = "700 28px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("CABINA DE RETRATOS", PHOTO_WIDTH / 2, 96);
  ctx.font = "400 22px Georgia, serif";
  ctx.fillStyle = "#c8bba6";
  ctx.fillText("UNA TOMA  ·  UN RECUERDO", PHOTO_WIDTH / 2, PHOTO_HEIGHT - 78);
}

function diamond(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fill();
}
