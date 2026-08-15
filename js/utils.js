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

  // Estado de reserva de suite: deriva "Señada" sin que el backend invente el valor.
  function estadoReservaSuite(reserva) {
    if (reserva.estado === "Pendiente" && Number(reserva.monto_sena) > 0) return "Señada";
    return reserva.estado;
  }

  const BADGE_RESERVA = {
    "Confirmada": "badge-ok",
    "Recibida": "badge-ok",
    "Señada": "badge-warn",
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

  return {
    todayISO, addDays, fechaLarga, fechaCorta,
    estadoReservaSuite, badgeClaseReserva,
    badgeClaseLimpieza, claseCardLimpieza,
    escapeHtml, formatMonto
  };
})();
