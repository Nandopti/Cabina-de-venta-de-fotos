# Cabina de retratos

Página web para tomar un retrato con la cámara, elegir un estilo, cobrar con un QR de CoDi y publicar la foto. Está pensada para el celular y también se usa en la computadora.

En el modo de demostración no se cobra dinero y el QR no es un pago real. El número de tarjeta no se escribe en esta página: eso lo hace el banco, en su propio sitio.

## Qué usa y por qué

| Pieza | Para qué | ¿Hace falta instalarla? |
| --- | --- | --- |
| [Vite](https://vite.dev) | Servir la página en desarrollo y generar la carpeta `dist/` | Sí, herramienta de desarrollo |
| [qrcode](https://github.com/soldair/node-qrcode) | Dibujar el QR a partir del texto que devuelve el pago | Sí |
| HTML, CSS y JavaScript | Toda la interfaz | No |
| `getUserMedia` | Abrir la cámara | No, viene en el navegador |
| Canvas | Recortar, filtrar y enmarcar el JPEG | No, viene en el navegador |
| Web Share API | Abrir Instagram, WhatsApp y otras apps en el celular | No, viene en el navegador |
| React, Vue o Angular | No se usan. El flujo es una sola página y se lee mejor sin framework | No |
| SDK de CoDi | No hay uno oficial para comercios. La llamada va en `server/codi.js` | La pone tu banco o procesador |

Las fuentes Fraunces y Outfit se cargan de Google Fonts. Si no hay red, la página usa Georgia y Segoe UI.

## Cómo correrla

Hace falta Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:5173

En el celular, misma red Wi-Fi, abre la dirección `Network` que imprime Vite, por ejemplo `http://192.168.1.20:5173`. Si la cámara no arranca (pasa seguido en iPhone por HTTP), entra con **Probar con foto de muestra** o sirve el sitio por HTTPS.

```bash
npm run build
npm run preview
```

`dist/` es la página estática. Las rutas `/api/codi/*` solo existen mientras corre Vite. Para cobrar de verdad hay que publicar `server/codi.js` en un backend.

## Recorrido

1. **Abrir la cámara** o usar la foto de muestra / subir una imagen.
2. Elegir estilo y marco. La lista sale de `src/looks.js`.
3. Disparar. Hay una cuenta de 3 si la fuente es la cámara. El JPEG se arma en `src/compose.js`.
4. **Generar QR y pagar.** El navegador llama a `POST /api/codi/cobros`.
5. En pantalla queda el QR (app del banco) y el botón **Pagar con tarjeta** (página del banco).
6. Cuando el cobro pasa a `aprobado`, se puede descargar o compartir.

En demostración, **Simular pago del QR** o **Simular pago aprobado** marcan el cobro sin mover dinero.

## Estructura

```text
cabina-de-retratos/
├── index.html                 Pantallas y comentarios de cada bloque
├── package.json               Vite y qrcode
├── vite.config.js             Servidor y rutas /api/codi
├── .env.example               Precio, modo y llaves. Cópialo a .env
├── README.md
├── server/
│   └── codi.js                AQUÍ se agrega la API de CoDi
└── src/
    ├── main.js                Arranque
    ├── app.js                 Pasa de una pantalla a otra
    ├── looks.js               Estilos y marcos
    ├── camera.js              getUserMedia
    ├── compose.js             JPEG final
    ├── photo-store.js         Guarda la foto antes de ir al banco
    ├── share.js               Instagram, WhatsApp y otras redes
    ├── styles.css
    └── payments/
        └── codi-client.js     fetch a /api/codi, sin llaves
```

Si más adelante el proyecto crece, estos son los lugares naturales, no carpetas que existan hoy:

```text
server/                webhook con firma, guardar cobros en base de datos
public/fondos/         marcos dibujados como imagen, si el canvas se queda corto
```

No hace falta separar componentes de React mientras siga siendo una sola cabina.

## Añadir un estilo

En `src/looks.js`, copia un objeto dentro de `styles`:

```js
{ id: "calido", name: "Cálido", css: "sepia(0.35) saturate(1.2)", canvas: "sepia(0.35) saturate(1.2)" }
```

`css` se ve en vivo. `canvas` queda grabado en el JPEG. Usa la misma sintaxis que un filtro CSS. El botón aparece solo.

Un marco nuevo se anota en `frames`, se dibuja en `drawFrame()` de `src/compose.js` y se imita en `.marco-...` dentro de `src/styles.css`.

## Conectar CoDi

CoDi es el cobro con QR de Banco de México. El cliente paga desde la app de su banco. Banxico no publica una API REST para que cualquier página genere ese QR: lo contratas con un banco participante o con un procesador, y ellos te dan URL, llave y el nombre de cada campo.

1. Copia `.env.example` a `.env`.
2. Pon `PAYMENT_MODE=live`.
3. Llena `CODI_API_BASE_URL`, `CODI_API_KEY` y, si aplica, `CODI_COMMERCE_ID`.
4. `PUBLIC_BASE_URL` es la dirección pública a la que el banco devuelve al cliente. Si la dejas vacía, en local se usa la dirección de la petición (así el QR sigue funcionando si Vite cambia de puerto).
5. Abre `server/codi.js` y ajusta `requestLiveCharge()` y `mapProviderResponse()` al PDF de tu proveedor. El resto de la cabina espera esto:

```json
{
  "id": "uuid-interno",
  "reference": "CAB-...",
  "amount": 49,
  "currency": "MXN",
  "concept": "Retrato digital — cabina",
  "status": "pendiente",
  "qrPayload": "texto exacto que se dibuja en el QR",
  "checkoutUrl": "https://banco-o-procesador/pagar/...",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "mode": "live"
}
```

`qrPayload` es lo que la app del banco escanea. `checkoutUrl` es a donde manda el botón **Pagar con tarjeta**. Si tu proveedor no tiene página de tarjeta, CoDi igual cobra por el QR; en ese caso puedes dejar `checkoutUrl` apuntando a las instrucciones de tu banco, pero no inventes un formulario de tarjeta en esta página.

El precio sale de `PRICE_MXN` en el servidor. El navegador no lo puede cambiar.

Los cobros de esta plantilla viven en memoria y se pierden al reiniciar el proceso. Para un local real, guarda el cobro en una base de datos dentro de `createCharge()` y `getCharge()`.

### Webhook

Si la persona paga el QR en el banco y no vuelve al navegador, el proveedor debe avisar a `POST /api/codi/webhook`. En modo `live` esa ruta responde 501 hasta que escribas la verificación de firma en `applyWebhook()`. Sin esa firma, cualquiera podría marcar un pago como hecho.

### La página del banco no viaja dentro de `dist/`

Ejemplo mínimo con Express, cuando ya quieras un servidor propio. Express no está instalado: es solo la forma de montar el mismo módulo.

```js
import express from "express";
import { createCharge, getCharge, getPrice } from "./server/codi.js";

const app = express();
app.use(express.json());
const env = process.env;

app.get("/api/codi/precio", (req, res) => res.json(getPrice(env)));
app.post("/api/codi/cobros", async (req, res, next) => {
  try { res.status(201).json(await createCharge(env)); } catch (error) { next(error); }
});
app.get("/api/codi/cobros/:id", async (req, res, next) => {
  try { res.json(await getCharge(req.params.id, env)); } catch (error) { next(error); }
});
```

## Instagram y WhatsApp

En el celular, **Publicar en Instagram**, **Enviar por WhatsApp** y **Otras redes** usan la hoja de compartir del sistema. Ahí aparecen las apps instaladas. La persona confirma la publicación; la cabina no puede publicar sola.

En la computadora, el sitio descarga el JPEG y abre Instagram o WhatsApp. Hay que adjuntar la foto a mano. Un enlace `wa.me` no acepta archivos, y Instagram no tiene un enlace para subir una foto local.

Publicar directo con la API de Meta (cuenta profesional, permiso `instagram_content_publish`) se hace en un servidor. Los pasos están comentados en `src/share.js`. El token no va en el frontend.

## Móvil

- Botones de al menos 48px y estilos en una fila que se desliza con el dedo.
- `100dvh` y `safe-area` para la barra del iPhone.
- Cámara frontal o trasera. La vista frontal va en espejo, y el JPEG también, para que coincida con lo que se vio.
- `playsinline` en el video para que iPhone no se lleve la cámara a pantalla completa.
- Se puede subir una foto desde la galería. En el celular, el selector del sistema también ofrece tomar una nueva.

## Lo que esta plantilla no hace

- No cobra pesos de verdad mientras `PAYMENT_MODE=mock`.
- No pide número de tarjeta, vencimiento ni CVV.
- No guarda clientes ni fotos en un servidor.
- No publica sola en Instagram.
