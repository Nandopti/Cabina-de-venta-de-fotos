/**
 * Guarda el JPEG en sessionStorage antes de ir al banco.
 *
 * Hace falta porque "Pagar con tarjeta" abre otra página (la del banco o
 * la simulación). Al volver, la memoria de JavaScript ya se borró y sin
 * esto la foto desaparecería.
 *
 * sessionStorage vive solo en esta pestaña y se borra al cerrarla.
 * No es un servidor de fotos. Un JPEG de esta cabina pesa unos cientos
 * de KB; el límite usual de sessionStorage es 5 MB.
 */

const PHOTO_KEY = "cabina.photo";

export async function savePhoto(blob) {
  const dataUrl = await blobToDataUrl(blob);
  sessionStorage.setItem(PHOTO_KEY, dataUrl);
}

export async function loadPhoto() {
  const dataUrl = sessionStorage.getItem(PHOTO_KEY);
  if (!dataUrl) return null;
  const response = await fetch(dataUrl);
  return response.blob();
}

export function clearPhoto() {
  sessionStorage.removeItem(PHOTO_KEY);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
