/**
 * Estilos y marcos de la cabina.
 *
 * No hace falta una librería de filtros: el navegador ya puede aplicar
 * filtros CSS en la vista previa y el mismo texto de filtro en un canvas
 * al guardar la foto (CanvasRenderingContext2D.filter).
 *
 * Para añadir un estilo, copia un objeto de esta lista.
 * - css:    se ve en vivo sobre el video.
 * - canvas: se graba en el JPEG. Usa la misma sintaxis que un filtro CSS.
 * Luego no toques el HTML: los botones se generan solos.
 */

export const styles = [
  { id: "original", name: "Original", css: "none", canvas: "none" },
  { id: "bn", name: "Blanco y negro", css: "grayscale(1) contrast(1.08)", canvas: "grayscale(1) contrast(1.08)" },
  { id: "sepia", name: "Sepia", css: "sepia(0.85) contrast(1.05)", canvas: "sepia(0.85) contrast(1.05)" },
  { id: "feria", name: "Feria", css: "saturate(1.45) contrast(1.12) brightness(1.04)", canvas: "saturate(1.45) contrast(1.12) brightness(1.04)" },
  { id: "noche", name: "Noche", css: "saturate(0.85) contrast(1.2) brightness(0.9) hue-rotate(8deg)", canvas: "saturate(0.85) contrast(1.2) brightness(0.9) hue-rotate(8deg)" },
  { id: "suave", name: "Suave", css: "saturate(0.8) contrast(0.92) brightness(1.08)", canvas: "saturate(0.8) contrast(0.92) brightness(1.08)" },
  { id: "cine", name: "Cine", css: "grayscale(0.35) contrast(1.25) saturate(0.9)", canvas: "grayscale(0.35) contrast(1.25) saturate(0.9)" },
];

/**
 * Marcos. El dibujo final está en src/compose.js (drawFrame).
 * La clase CSS `marco-*` en src/styles.css solo imita el marco en la vista previa.
 * Si agregas un marco, actualiza los tres lugares: esta lista, drawFrame() y el CSS.
 */
export const frames = [
  { id: "none", name: "Sin marco" },
  { id: "polaroid", name: "Polaroid" },
  { id: "feria", name: "Feria" },
  { id: "cine", name: "Cine" },
];

export function findStyle(id) {
  return styles.find((style) => style.id === id) || styles[0];
}

export function findFrame(id) {
  return frames.find((frame) => frame.id === id) || frames[0];
}
