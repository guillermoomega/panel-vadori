const Utils = (() => {
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function fechaLarga(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return `${DIAS[date.getDay()]} ${d} de ${MESES[m - 1]}`;
  }

  function fechaCorta(iso) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  function addDays(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d + n);
    const y2 = date.getFullYear();
    const m2 = String(date.getMonth() + 1).padStart(2, "0");
    const d2 = String(date.getDate()).padStart(2, "0");
    return `${y2}-${m2}-${d2}`;
  }

  // Estado real de la reserva de suite: Pendiente (espera pago de seña), Confirmada (seña pagada
  // o salteada con vvs272) o Cancelada. Se muestra tal cual viene de Airtable, sin estados derivados.
  function estadoReservaSuite(reserva) {
    return reserva.estado;
  }

  const BADGE_RESERVA = {
    "Confirmada": "badge-ok",
    "Recibida": "badge-ok",
    "Pendiente": "badge-warn",
    "Cancelada": "badge-neutral"
  };

  function badgeClaseReserva(estado) {
    return BADGE_RESERVA[estado] || "badge-neutral";
  }

  const BADGE_LIMPIEZA = {
    "Lista": "badge-ok",
    "ocupada": "badge-neutral",
    "desocupada": "badge-warn",
    "fuera de servicio": "badge-bad"
  };

  function badgeClaseLimpieza(estado) {
    return BADGE_LIMPIEZA[estado] || "badge-neutral";
  }

  const CLASE_LIMPIEZA_CARD = {
    "Lista": "estado-lista",
    "ocupada": "estado-ocupada",
    "desocupada": "estado-desocupada",
    "fuera de servicio": "estado-fuera"
  };

  function claseCardLimpieza(estado) {
    return CLASE_LIMPIEZA_CARD[estado] || "";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function formatMonto(n) {
    return `$${Number(n).toLocaleString("es-AR")}`;
  }

  // Normaliza Tipo_unidad de Airtable ("cuarto ", "Suites", etc.) a una etiqueta prolija.
  function tipoUnidadLabel(tipo) {
    if (!tipo) return null;
    const t = tipo.trim().toLowerCase();
    if (t === "cuarto") return "Cuarto";
    if (t === "suite" || t === "suites") return "Suites";
    return tipo.trim();
  }

  return {
    todayISO, addDays, fechaLarga, fechaCorta,
    estadoReservaSuite, badgeClaseReserva,
    badgeClaseLimpieza, claseCardLimpieza,
    escapeHtml, formatMonto, tipoUnidadLabel
  };
})();
