/**
 * Publicar la foto.
 *
 * Lo que sí funciona desde una página web, en el celular:
 *   Web Share API (navigator.share). Es del navegador, sin librería.
 *   Al pulsar Instagram o WhatsApp se abre la hoja de compartir del
 *   sistema, donde el usuario elige la app y publica. En Android e iPhone
 *   esa hoja incluye Instagram, WhatsApp, Facebook, X y TikTok si están
 *   instalados.
 *
 * Lo que una página NO puede hacer:
 *   Abrir Instagram y dejar la foto ya publicada, sin que la persona
 *   confirme. Instagram no tiene un enlace del tipo
 *   instagram.com/compartir?foto=... para imágenes locales.
 *   WhatsApp tampoco acepta el archivo por un enlace wa.me; ese enlace
 *   solo lleva texto.
 *
 * Si más adelante quieres publicar sin que la persona elija la app,
 * eso ya es un backend con la API oficial de Meta:
 *   1. App en developers.facebook.com
 *   2. Cuenta de Instagram profesional ligada a una página de Facebook
 *   3. Permiso instagram_content_publish, aprobado por Meta
 *   4. El servidor sube el JPEG a una URL pública y llama a
 *      POST /{ig-user-id}/media y luego /media_publish
 *   La documentación está en:
 *   https://developers.facebook.com/docs/instagram-platform/content-publishing
 *   No dejes el token de Meta en este frontend.
 *
 * En computadora, o si el navegador no deja compartir archivos, la cabina
 * descarga el JPEG y abre el sitio de la red para que la persona lo adjunte.
 */

export async function sharePhoto(blob, network) {
  const file = new File([blob], `cabina-${Date.now()}.jpg`, { type: "image/jpeg" });
  const text = "Mi retrato de la cabina.";

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Cabina de retratos",
      text,
    });
    return { method: "share" };
  }

  downloadPhoto(blob, file.name);
  const page = fallbackPage(network, text);
  if (page) {
    window.open(page, "_blank", "noopener,noreferrer");
  }
  return { method: "download" };
}

export function downloadPhoto(blob, filename = `cabina-${Date.now()}.jpg`) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fallbackPage(network, text) {
  if (network === "instagram") return "https://www.instagram.com/";
  if (network === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(text)}`;
  return "";
}
