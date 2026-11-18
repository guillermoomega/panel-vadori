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
      "Pendiente": "estado-pendiente",
      "Cancelada": "estado-cancelada"
    };
    return map[estado] || "estado-pendiente";
  }

  function eventosDeSuites(suites) {
    return suites.map(r => {
      const estado = Utils.estadoReservaSuite(r);
      const unidad = r.sin_asignar
        ? (Utils.tipoUnidadLabel(r.tipo_unidad) || "Sin asignar")
        : (r.unidad || "?");
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

  // Feriados de la tabla Feriados (Tipo "Feriado"): día pintado de fondo con la descripción
  let feriados = null;
  async function cargarFeriados() {
    if (feriados) return feriados;
    const res = await Api.configListar("feriados");
    if (!res.ok) throw new Error(res.error || "No se pudieron cargar los feriados.");
    feriados = (res.items || []).filter(f => f.Tipo === "Feriado" && f.Fecha);
    return feriados;
  }

  function eventosDeFeriados(lista, desde, hasta) {
    return lista
      .filter(f => f.Fecha >= desde && f.Fecha <= hasta)
      .map(f => ({
        id: "feriado-" + f.id,
        title: f.Descripcion || "Feriado",
        start: f.Fecha,
        allDay: true,
        display: "background",
        classNames: ["dia-feriado"]
      }));
  }

  async function cargarRango(info, successCallback, failureCallback) {
    const hoy = Utils.todayISO();
    const desdeSolicitado = toISO(info.start);
    const desde = desdeSolicitado < hoy ? hoy : desdeSolicitado;
    // FullCalendar's range end is exclusive; pedimos un día antes para no pasarnos.
    const hastaDate = new Date(info.end);
    hastaDate.setDate(hastaDate.getDate() - 1);
    const hasta = toISO(hastaDate);

    if (desde > hasta) {
      successCallback([]);
      return;
    }

    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    try {
      const [data, listaFeriados] = await Promise.all([
        Api.ocupacion(desde, hasta),
        cargarFeriados().catch(() => []) // si falla, el calendario se muestra igual sin feriados
      ]);
      elEstado().textContent = "";
      successCallback([...eventosDeFeriados(listaFeriados, desde, hasta), ...eventosDeSuites(data.suites)]);
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
      validRange: { start: Utils.todayISO() },
      events: cargarRango,
      eventDisplay: "block"
    });
    calendar.render();
  }

  function render() {
    feriados = null; // releer por si se cargaron feriados nuevos
    init();
    calendar.refetchEvents();
  }

  return { render };
})();
