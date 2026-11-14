/**
 * Estilos del retrato.
 *
 * Cada estilo es un filtro CSS. El mismo texto se aplica a la vista previa
 * (video o imagen) y al canvas al exportar, para que la foto guardada
 * coincida con lo que se vio en pantalla.
 *
 * Para añadir un estilo: copia un objeto, cambia id, name y css.
 * No hace falta otra librería. El navegador pinta grayscale, sepia, etc.
 * Si un teléfono muy viejo ignora ctx.filter al exportar, la alternativa
 * sería procesar píxeles (por ejemplo con glfx.js). Hoy no está instalada.
 */

export const filters = [
  { id: "natural", name: "Natural", css: "none" },
  { id: "bn", name: "Blanco y negro", css: "grayscale(1) contrast(1.08)" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.35) brightness(0.92)" },
  { id: "sepia", name: "Sepia", css: "sepia(0.85) contrast(1.05)" },
  { id: "calido", name: "Cálido", css: "sepia(0.28) saturate(1.25) contrast(1.04)" },
  { id: "frio", name: "Frío", css: "saturate(0.85) hue-rotate(18deg) contrast(1.06)" },
  { id: "vivo", name: "Vivo", css: "saturate(1.45) contrast(1.12)" },
  { id: "fade", name: "Desvanecido", css: "saturate(0.72) contrast(0.9) brightness(1.08)" },
];

export function findFilter(id) {
  return filters.find((filter) => filter.id === id) ?? filters[0];
}
