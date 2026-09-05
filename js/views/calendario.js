const ViewCalendario = (() => {
  let calendar = null;
  const elEstado = () => document.getElementById("calendario-estado");

  function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function claseEstadoReserva(estado) {
    const map = {
      "Confirmada": "estado-confirmada",
      "Recibida": "estado-confirmada",
      "Señada": "estado-senada",
      "Pendiente": "estado-pendiente",
      "Cancelada": "estado-cancelada"
    };
    return map[estado] || "estado-pendiente";
  }

  function eventosDeSuites(suites) {
    return suites.map(r => {
      const estado = Utils.estadoReservaSuite(r);
      const unidad = r.sin_asignar ? (r.tipo_unidad || "sin asignar") : (r.unidad || "?");
      return {
        id: "suite-" + r.id,
        title: `${r.huesped || "Sin nombre"} · ${unidad}`,
        start: r.checkin,
        end: r.checkout,
        allDay: true,
        classNames: [claseEstadoReserva(estado)]
      };
    });
  }

  function eventosDeMesas(mesas) {
    return mesas.map(m => ({
      id: "mesa-" + m.id,
      title: `Mesa: ${m.nombre || "Sin nombre"} (${m.personas ?? "?"}p) ${m.hora || ""}`,
      start: m.fecha,
      allDay: true,
      classNames: [claseEstadoReserva(m.estado), "tipo-mesa"]
    }));
  }

  async function cargarRango(info, successCallback, failureCallback) {
    const desde = toISO(info.start);
    // FullCalendar's range end is exclusive; pedimos un día antes para no pasarnos.
    const hastaDate = new Date(info.end);
    hastaDate.setDate(hastaDate.getDate() - 1);
    const hasta = toISO(hastaDate);

    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const data = await Api.ocupacion(desde, hasta);
      elEstado().textContent = "";
      successCallback([...eventosDeSuites(data.suites), ...eventosDeMesas(data.mesas)]);
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
      failureCallback(err);
    }
  }

  function init() {
    if (calendar) return;
    const el = document.getElementById("calendar");
    calendar = new FullCalendar.Calendar(el, {
      initialView: "dayGridMonth",
      height: "auto",
      headerToolbar: { left: "prev,next today", center: "title", right: "" },
      locale: "es",
      firstDay: 1,
      events: cargarRango,
      eventDisplay: "block"
    });
    calendar.render();
  }

  function render() {
    init();
    calendar.refetchEvents();
  }

  return { render };
})();
