# Panel Vadori

App interna de solo lectura para el equipo de Gran Vadori / Villa Vadori Suites: Calendario, Hoy y Limpieza. Reemplaza los comandos de WhatsApp del staff (`/mesas`, `/turnos`, `/suites`); WhatsApp queda exclusivo para clientes.

Vanilla HTML/CSS/JS, sin build. Backend: 3 webhooks n8n (ver `../n8n vadori/docs/API.md` en el repo de Coco para el contrato completo).

## Setup local

1. `js/config.js` ya está commiteado con el valor real (ver nota de seguridad más abajo — se decidió subirlo). Si hace falta regenerarlo desde cero, copiar `js/config.example.js` y completar `panelKey`.
2. Servir la carpeta con cualquier servidor estático (no funciona con `file://` por CORS/fetch). Por ejemplo:
   ```
   npx serve .
   ```
3. Abrir `http://localhost:<puerto>`.

## Arquitectura

- `index.html` — shell con 3 vistas y tabbar inferior.
- `js/api.js` — wrapper de `fetch` que agrega el header `X-Panel-Key` a cada request.
- `js/utils.js` — formateo de fechas y mapeo de estados a badges/colores.
- `js/views/*.js` — un módulo por vista (`hoy`, `limpieza`, `calendario`).
- `js/main.js` — router simple entre tabs, recuerda la última vista en `localStorage`.
- Calendario usa [FullCalendar](https://fullcalendar.io/) por CDN.

Sin service worker de caché de datos a propósito: mostrar información de reservas/limpieza desactualizada es peor que no tener modo offline. El `manifest.json` solo habilita "agregar a inicio" (icono + pantalla completa), no cachea las llamadas a la API.

## Deploy

- Hosting: GitHub Pages (`panel.granvadori.com.ar`).
- Auth de acceso: Cloudflare Access delante del dominio (gatea quién puede *abrir* la app, login por One-time PIN al email del staff).
- `js/config.js` está commiteado al repo público con el valor real de `panelKey`. Decisión 2026-08-15: como el repo es público, cualquiera que mire el código fuente en GitHub puede ver la clave — pero como el sitio desplegado ya está detrás de Cloudflare Access, el header `X-Panel-Key` solo es una segunda capa en el backend (n8n rechaza con 403 si falta), no la barrera principal. El trade-off aceptado es el mismo de siempre: no protege contra el staff, dificulta que alguien la encuentre sin buscarla a propósito en el repo.
- Íconos: `icons/icon.svg` es un placeholder (letra "V" sobre fondo teal, sin isologotipo — decisión v1 de identidad minimalista neutra). `apple-touch-icon` en iOS requiere PNG para funcionar de verdad en pantalla de inicio; si se quiere una instalación prolija en iPhone, generar `icon-192.png` / `icon-512.png` antes del deploy.

## Fuera de v1

Ver `project_panel_vadori` en memoria: sin escritura (confirmar reservas, marcar limpieza, asignar unidad — eso sigue por `/asignar` en WhatsApp), sin vista Caja (no hay tabla de pagos en Airtable todavía).
