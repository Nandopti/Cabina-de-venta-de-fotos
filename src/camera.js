/**
 * Cámara web con la API del navegador (MediaDevices.getUserMedia).
 * No se usa librería: Chrome, Firefox, Safari y el navegador del celular
 * ya pueden entregar el video de la cámara.
 *
 * Requisitos:
 * - La página debe abrirse por http://localhost o por HTTPS.
 *   Un celular abriendo http://192.168.x.x a veces bloquea la cámara,
 *   sobre todo iPhone. En ese caso usa la foto de muestra o sirve la
 *   cabina con HTTPS.
 * - El <video> necesita el atributo playsinline. Sin eso, iPhone abre
 *   el video a pantalla completa y la cabina deja de verse.
 */

export async function openCamera(facingMode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador no puede usar la cámara. Prueba con la foto de muestra o sube una imagen.");
  }

  const attempts = [
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 1600 },
      },
    },
    { audio: false, video: { facingMode } },
    { audio: false, video: true },
  ];

  let lastError;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw friendlyCameraError(lastError);
}

export function attachStream(video, stream) {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  return video.play();
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function friendlyCameraError(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return new Error("El navegador bloqueó la cámara. Permite el acceso en el candado de la barra de dirección, o usa la foto de muestra.");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return new Error("No encontré una cámara. Puedes subir una foto o usar la de muestra.");
  }
  if (name === "NotReadableError") {
    return new Error("Otra aplicación está usando la cámara. Ciérrala e inténtalo de nuevo.");
  }
  return new Error("No pude abrir la cámara. Puedes subir una foto o usar la de muestra.");
}
