# Panel Vadori

App interna de solo lectura para el equipo de Gran Vadori / Villa Vadori Suites: Calendario, Hoy y Limpieza. Reemplaza los comandos de WhatsApp del staff (`/mesas`, `/turnos`, `/suites`); WhatsApp queda exclusivo para clientes.

Vanilla HTML/CSS/JS, sin build. Backend: 3 webhooks n8n (ver `../n8n vadori/docs/API.md` en el repo de Coco para el contrato completo).

## Setup local

1. Copiar `js/config.example.js` a `js/config.js` (gitignored, no se commitea) y completar `panelKey` con el valor real (pedirlo a Coco / ver memoria `project_panel_vadori`).
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

## Deploy (pendiente)

- Hosting: GitHub Pages.
- Auth de acceso: Cloudflare Access delante del dominio (gatea quién puede *abrir* la app).
- El header `X-Panel-Key` es una segunda capa en el backend (n8n rechaza con 403 si falta) — como el sitio es estático, ese secreto queda visible en el JS servido a cualquiera que pase el Access. Es un trade-off aceptado para v1: el riesgo real que cubre es que alguien encuentre la URL del webhook n8n sin pasar por el panel, no un actor malicioso dentro del staff.
- Íconos: `icons/icon.svg` es un placeholder (letra "V" sobre fondo teal, sin isologotipo — decisión v1 de identidad minimalista neutra). `apple-touch-icon` en iOS requiere PNG para funcionar de verdad en pantalla de inicio; si se quiere una instalación prolija en iPhone, generar `icon-192.png` / `icon-512.png` antes del deploy.

## Fuera de v1

Ver `project_panel_vadori` en memoria: sin escritura (confirmar reservas, marcar limpieza, asignar unidad — eso sigue por `/asignar` en WhatsApp), sin vista Caja (no hay tabla de pagos en Airtable todavía).
