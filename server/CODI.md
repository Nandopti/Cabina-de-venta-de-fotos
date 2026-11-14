# Conectar la API de CoDi

Este archivo es la guía del espacio de pago. El código que se modifica está en [`codi.js`](codi.js). Las rutas HTTP están en [`http.js`](http.js) y no necesitan cambios si el navegador sigue llamando a `/api/codi`.

## Qué es cada cosa

**CoDi** (Cobro Digital) es el esquema de Banco de México para cobrar con un QR. La persona lo paga desde la app de un banco participante, por la vía de transferencias que CoDi usa. Banxico publica el esquema y las reglas; no publica una API REST abierta para que cualquier página genere cobros. La URL, la llave y el formato JSON te los da tu banco o el agregador con el que contrates.

**QR.** El banco devuelve una cadena (`qrPayload`). La librería `qrcode`, en el navegador, solo la dibuja. No hay que armar esa cadena a mano. El QR de demostración empieza con `CODI-DEMO` y ninguna app bancaria lo va a cobrar.

**Tarjeta.** «Cualquier tarjeta» no se cobra dentro de esta cabina. El procesador (el mismo banco u otro contratado) devuelve `checkoutUrl`. El botón **Pagar con tarjeta** abre esa dirección. Allá están el formulario, 3-D Secure y el cumplimiento de PCI. Por eso `http.js` rechaza campos como número de tarjeta, CVV o NIP: si llegan aquí, la integración está mal hecha.

Si el contrato de CoDi solo incluye el QR y no una página de tarjeta, genera el cobro con tarjeta en el procesador que contrates y asigna su URL a `checkoutUrl` dentro de `mapLivePayload`, antes de responder al navegador.

## Contrato que ya entiende la cabina

`POST /api/codi/cobros` responde:

```json
{
  "id": "id-del-banco-o-uuid",
  "reference": "CAB-…",
  "amount": 49,
  "currency": "MXN",
  "concept": "Retrato digital — Cabina",
  "status": "pendiente",
  "mode": "live",
  "qrPayload": "cadena-exacta-para-el-qr",
  "checkoutUrl": "https://pagos.tu-banco.example/checkout/…",
  "expiresAt": "2026-01-01T00:15:00.000Z",
  "paidAt": null
}
```

`status` solo usa tres valores: `pendiente`, `aprobado`, `vencido`.

Otras rutas:

| Método y ruta | Uso |
| --- | --- |
| `GET /api/codi/config` | Precio, moneda, concepto y modo. El precio sale de `PRICE_MXN`. |
| `GET /api/codi/cobros/:id` | Estado actual. En `live` consulta al banco si sigue pendiente. |
| `GET /api/codi/cobros?ref=` | El regreso del banco trae la referencia, no siempre el id. |
| `POST /api/codi/cobros/:id/simular-pago` | Solo `mock`. En `live` responde 403. |

El navegador manda el concepto, no el monto. Aunque alguien cambie el precio en JavaScript, `priceOf()` en el servidor es el que vale.

## Pasos para el modo live

1. Copia `.env.example` a `.env`.
2. Completa:

```bash
PAYMENT_MODE=live
PRICE_MXN=49
CODI_API_BASE_URL=https://api.tu-banco.example/codi
CODI_API_KEY=la-llave-que-te-den
CODI_COMMERCE_ID=el-id-de-comercio
PUBLIC_BASE_URL=https://cabina.tudominio.example
```

3. Abre `createLiveCobro` en `codi.js`. El cuerpo de ejemplo es:

```json
{
  "monto": 49,
  "moneda": "MXN",
  "concepto": "Retrato digital — Cabina",
  "referencia": "CAB-…",
  "idComercio": "…",
  "vigenciaMinutos": 15,
  "urlRetorno": "https://cabina.tudominio.example/?pago=retorno&ref=CAB-…"
}
```

Cambia la ruta (`/cobros`) y los nombres de campos por los del manual. El encabezado `Authorization: Bearer` también cambia si tu banco usa otro esquema.

4. Abre `mapLivePayload`. Ahí se leen, en este orden, las llaves más habituales:

- QR: `qrPayload`, `qr`, `cadenaQR`, `cadena`, `qrData`
- Tarjeta: `checkoutUrl`, `urlPago`, `paymentUrl`, `liga`
- Id: `id`, `idCobro`, `folio`
- Estado: `status`, `estado`

Si el manual usa otros nombres, déjalos mapeados a las propiedades de arriba y no toques `src/`.

5. `refreshIfLive` hace `GET {CODI_API_BASE_URL}/cobros/{id}` cada vez que la pantalla consulta un cobro pendiente. Si el banco consulta el estado en otra ruta, cambia solo esa función. Sin esto, **Ya pagué, verificar** no puede enterarse del pago real.

6. Reinicia `npm run dev`. Vite lee `.env` al arrancar.

`PUBLIC_BASE_URL` tiene que ser la URL pública HTTPS de la cabina, porque el banco redirige el navegador de la persona a:

```text
{PUBLIC_BASE_URL}/?pago=retorno&ref={referencia}
```

La cabina busca ese cobro y, si el estado ya es `aprobado` y el retrato sigue en el mismo navegador, muestra la pantalla para compartir.

## Qué no poner en el frontend

`src/payments/codi-client.js` solo llama a `/api/codi` de tu propio origen. No importes la llave ahí. En Vite, una variable `VITE_CODI_API_KEY` quedaría dentro del JavaScript que se descarga cualquier visita.

Tampoco agregues inputs de tarjeta en `index.html`. Un formulario propio convertiría esta cabina en una página que recoge datos de tarjeta sin ser el procesador.

## Publicar el backend fuera de Vite

`npm run dev` y `npm run preview` montan estas rutas en el mismo proceso para poder probar. Un hosting que solo sirve `dist/` no ejecuta `server/`. Hay que exponer `handleCodiApi` en un Node accesible por HTTPS y redirigir `/api` hacia él.

Ejemplo con Express, cuando lo agregues a tu servidor. No está instalado en esta plantilla:

```js
import express from "express";
import { handleCodiApi } from "./server/http.js";

const app = express();
const env = process.env;

app.use(async (req, res, next) => {
  const handled = await handleCodiApi(req, res, env);
  if (!handled) next();
});
```

No pongas `express.json()` antes de este manejador: `http.js` lee el cuerpo por su cuenta y, si el stream ya se consumió, el JSON llega vacío. El manejador también impone un tope de 20 KB.

En producción sustituye el `Map` de `codi.js` por una base de datos. Si no, un reinicio olvida cobros que el banco todavía puede completar, y dos instancias del servidor no comparten la memoria.

## Lista antes de cobrar de verdad

- [ ] `PAYMENT_MODE=live` y la llave solo en el servidor.
- [ ] Un cobro de prueba crea un QR que la app del banco sí reconoce.
- [ ] `checkoutUrl` abre la página HTTPS del procesador, no un formulario de esta web.
- [ ] Al pagar, el banco regresa a `PUBLIC_BASE_URL/?pago=retorno&ref=…`.
- [ ] `GET /api/codi/cobros/:id` pasa a `aprobado` cuando el banco liquida.
- [ ] Un cuerpo con `cardNumber` o `cvv` recibe 400.
- [ ] El certificado público es el del hosting, no el de `@vitejs/plugin-basic-ssl`.
