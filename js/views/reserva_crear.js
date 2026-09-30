const ViewReservaCrear = (() => {
  const elEstado = () => document.getElementById("nueva-reserva-estado");
  const elContent = () => document.getElementById("nueva-reserva-content");

  let listenersAttached = false;
  let unidadesDisponibles = [];
  let paquetesDisponibles = [];
  let resultadosBusqueda = [];

  let modoEdicion = false;
  let reservaEditId = null;
  let unidadIdAnterior = null;
  let paqueteActual = null;

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    elContent().addEventListener("submit", async (ev) => {
      const form = ev.target.closest("#reserva-crear-form");
      if (!form) return;
      ev.preventDefault();
      await handleSubmit(form);
    });

    elContent().addEventListener("change", (ev) => {
      if (ev.target.id === "reserva-tipo-unidad") {
        actualizarOpcionesUnidad();
        actualizarOpcionesPaquete();
      }
    });

    elContent().addEventListener("click", (ev) => {
      if (ev.target.id === "reserva-buscar-btn") {
        handleBuscar();
        return;
      }
      if (ev.target.id === "reserva-edicion-cancelar") {
        salirModoEdicion();
        return;
      }
      const item = ev.target.closest(".reserva-buscar-item");
      if (item) {
        cargarReservaParaEditar(item.dataset.id);
      }
    });

    elContent().addEventListener("keydown", (ev) => {
      if (ev.target.id === "reserva-buscar-nombre" && ev.key === "Enter") {
        ev.preventDefault();
        handleBuscar();
      }
    });
  }

  function actualizarOpcionesUnidad() {
    const tipoSel = document.getElementById("reserva-tipo-unidad");
    const unidadSel = document.getElementById("reserva-unidad");
    if (!tipoSel || !unidadSel) return;
    const tipo = tipoSel.value;
    const valorPrevio = unidadSel.value || unidadIdAnterior || "";
    let opciones = unidadesDisponibles.filter(u => u.estado === "Lista" && u.tipo === tipo);
    if (unidadIdAnterior && !opciones.some(u => u.id === unidadIdAnterior)) {
      const actual = unidadesDisponibles.find(u => u.id === unidadIdAnterior && u.tipo === tipo);
      if (actual) opciones = [actual, ...opciones];
    }
    unidadSel.innerHTML = `<option value="">Sin asignar (elegir después)</option>` +
      opciones.map(u => `<option value="${Utils.escapeHtml(u.id)}">${Utils.escapeHtml(u.nombre)}</option>`).join("");
    if (opciones.some(u => u.id === valorPrevio)) unidadSel.value = valorPrevio;
  }

  function actualizarOpcionesPaquete() {
    const tipoSel = document.getElementById("reserva-tipo-unidad");
    const paqueteSel = document.getElementById("reserva-paquete");
    if (!tipoSel || !paqueteSel) return;
    const tipo = tipoSel.value;
    const valorPrevio = paqueteSel.value || paqueteActual || "";
    const opciones = paquetesDisponibles.map(p => {
      const precio = tipo === "cuarto" ? p.precio_cuarto : p.precio_suite;
      const etiqueta = precio ? `${p.nombre} — ${Utils.formatMonto(precio)}` : p.nombre;
      return { nombre: p.nombre, etiqueta };
    });
    if (paqueteActual && !opciones.some(o => o.nombre === paqueteActual)) {
      opciones.unshift({ nombre: paqueteActual, etiqueta: `${paqueteActual} (inactivo)` });
    }
    paqueteSel.innerHTML = `<option value="">Sin paquete</option>` +
      opciones.map(o => `<option value="${Utils.escapeHtml(o.nombre)}">${Utils.escapeHtml(o.etiqueta)}</option>`).join("");
    if (opciones.some(o => o.nombre === valorPrevio)) paqueteSel.value = valorPrevio;
  }

  async function handleBuscar() {
    const input = document.getElementById("reserva-buscar-nombre");
    const cont = document.getElementById("reserva-buscar-resultados");
    if (!input || !cont) return;
    const nombre = input.value.trim();
    if (nombre.length < 2) {
      cont.innerHTML = `<p class="reserva-buscar-msg">Ingresá al menos 2 caracteres.</p>`;
      return;
    }
    cont.innerHTML = `<p class="reserva-buscar-msg">Buscando…</p>`;
    try {
      const res = await Api.buscarReservas(nombre);
      if (!res.ok) throw new Error(res.error || "No se pudo buscar.");
      resultadosBusqueda = res.reservas || [];
      if (!resultadosBusqueda.length) {
        cont.innerHTML = `<p class="reserva-buscar-msg">Sin resultados.</p>`;
        return;
      }
      cont.innerHTML = resultadosBusqueda.map(r => `
        <button type="button" class="reserva-buscar-item" data-id="${Utils.escapeHtml(r.id)}">
          <strong>${Utils.escapeHtml(r.nombre)}</strong> — ${Utils.escapeHtml(Utils.tipoUnidadLabel(r.tipo_unidad) || "—")} ·
          ${Utils.rangoFechas(r.checkin, r.checkout)} · ${Utils.escapeHtml(r.estado)}
        </button>`).join("");
    } catch (err) {
      cont.innerHTML = `<p class="reserva-buscar-msg error">${Utils.escapeHtml(err.message)}</p>`;
    }
  }

  function cargarReservaParaEditar(id) {
    const reserva = resultadosBusqueda.find(r => r.id === id);
    const form = document.getElementById("reserva-crear-form");
    if (!reserva || !form) return;

    modoEdicion = true;
    reservaEditId = reserva.id;
    unidadIdAnterior = reserva.unidad_id || null;
    paqueteActual = reserva.paquete || null;

    const tipoNorm = reserva.tipo_unidad && reserva.tipo_unidad.trim().toLowerCase().includes("cuarto") ? "cuarto" : "suite";

    form.querySelector("#reserva-nombre").value = reserva.nombre || "";
    form.querySelector("#reserva-tipo-unidad").value = tipoNorm;
    form.querySelector("#reserva-checkin").value = reserva.checkin || "";
    form.querySelector("#reserva-checkout").value = reserva.checkout || "";
    form.querySelector("#reserva-adultos").value = reserva.adultos || 2;
    form.querySelector("#reserva-estado").value = reserva.estado || "Pendiente";
    form.querySelector("#reserva-telefono").value = reserva.telefono || "";
    form.querySelector("#reserva-tipo-cama").value = reserva.tipo_cama || "";
    form.querySelector("#reserva-costo").value = reserva.costo != null ? reserva.costo : "";
    form.querySelector("#reserva-sena").value = reserva.monto_sena != null ? reserva.monto_sena : "";
    form.querySelector("#reserva-observaciones").value = reserva.observaciones || "";

    actualizarOpcionesUnidad();
    actualizarOpcionesPaquete();

    document.getElementById("reserva-edicion-nombre").textContent = reserva.nombre;
    document.getElementById("reserva-edicion-banner").hidden = false;
    form.querySelector(".btn-crear-reserva").textContent = "Guardar cambios";

    document.getElementById("reserva-buscar-resultados").innerHTML = "";
    document.getElementById("reserva-buscar-nombre").value = "";

    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function salirModoEdicion() {
    modoEdicion = false;
    reservaEditId = null;
    unidadIdAnterior = null;
    paqueteActual = null;

    const banner = document.getElementById("reserva-edicion-banner");
    if (banner) banner.hidden = true;

    const form = document.getElementById("reserva-crear-form");
    if (form) {
      form.reset();
      form.querySelector(".btn-crear-reserva").textContent = "Crear reserva";
      actualizarOpcionesUnidad();
      actualizarOpcionesPaquete();
    }

    const resultados = document.getElementById("reserva-buscar-resultados");
    if (resultados) resultados.innerHTML = "";
  }

  async function handleSubmit(form) {
    const btn = form.querySelector(".btn-crear-reserva");
    const editando = modoEdicion;

    const nombre = form.querySelector("#reserva-nombre").value.trim();
    const tipo_unidad = form.querySelector("#reserva-tipo-unidad").value;
    const checkin = form.querySelector("#reserva-checkin").value;
    const checkout = form.querySelector("#reserva-checkout").value;
    const adultos = parseInt(form.querySelector("#reserva-adultos").value, 10);
    const estado = form.querySelector("#reserva-estado").value;
    const telefono = form.querySelector("#reserva-telefono").value.trim();
    const tipo_cama = form.querySelector("#reserva-tipo-cama").value.trim();
    const paquete = form.querySelector("#reserva-paquete").value.trim();
    const costoRaw = form.querySelector("#reserva-costo").value;
    const senaRaw = form.querySelector("#reserva-sena").value;
    const observaciones = form.querySelector("#reserva-observaciones").value.trim();
    const unidadSel = form.querySelector("#reserva-unidad");
    const unidad_id = unidadSel.value;

    if (!nombre || !checkin || !checkout || !adultos || adultos < 1) {
      alert("Completá nombre, ingreso, salida y adultos.");
      return;
    }
    if (checkout <= checkin) {
      alert("La salida debe ser posterior al ingreso.");
      return;
    }

    const unidadTexto = unidad_id ? unidadSel.options[unidadSel.selectedIndex].textContent : "sin asignar";
    const resumen = `Huésped: ${nombre}\n` +
      `Unidad: ${tipo_unidad === "suite" ? "Suite Premium" : "Suite Estándar"} (${unidadTexto})\n` +
      `Fechas: ${Utils.rangoFechas(checkin, checkout)}\n` +
      `Adultos: ${adultos}\n` +
      `Estado: ${estado}`;
    const pregunta = editando ? "¿Confirmás guardar los cambios de esta reserva?" : "¿Confirmás crear esta reserva?";
    if (!confirm(`${pregunta}\n\n${resumen}`)) return;

    const datosBase = {
      nombre, tipo_unidad, checkin, checkout, adultos, estado,
      telefono: telefono || undefined,
      tipo_cama: tipo_cama || undefined,
      paquete: paquete || undefined,
      costo: costoRaw !== "" ? Number(costoRaw) : undefined,
      monto_sena: senaRaw !== "" ? Number(senaRaw) : undefined,
      observaciones: observaciones || undefined,
      unidad_id: unidad_id || undefined
    };

    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = editando ? "Guardando…" : "Creando…";
    try {
      let res;
      if (editando) {
        res = await Api.editarReserva({
          ...datosBase,
          reserva_id: reservaEditId,
          unidad_id_anterior: unidadIdAnterior || ""
        });
      } else {
        res = await Api.crearReserva(datosBase);
      }
      if (!res.ok) throw new Error(res.error || (editando ? "No se pudo guardar la reserva." : "No se pudo crear la reserva."));

      let msg = editando ? "Reserva actualizada correctamente." : "Reserva creada correctamente.";
      if (editando) {
        if (res.unidad_actualizada === false) {
          msg += " " + (res.error || "No se pudo actualizar la unidad asignada, revisá el estado manualmente.");
        }
      } else if (unidad_id && !res.unidad_asignada) {
        msg += " " + (res.error || "No se pudo marcar la unidad como ocupada, revisá el estado de la unidad manualmente.");
      }
      alert(msg);
      salirModoEdicion();
      form.reset();
      await render();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = editando ? "Guardar cambios" : textoOriginal;
    }
  }

  function formHtml() {
    return `
      <div class="reserva-buscar">
        <div class="reserva-buscar-fila">
          <div class="form-field">
            <label for="reserva-buscar-nombre">Buscar reserva existente (por nombre)</label>
            <input type="text" id="reserva-buscar-nombre" placeholder="Ej: Juan Pérez">
          </div>
          <button type="button" id="reserva-buscar-btn" class="btn-secundario">Buscar</button>
        </div>
        <div id="reserva-buscar-resultados" class="reserva-buscar-resultados"></div>
      </div>

      <div id="reserva-edicion-banner" class="reserva-edicion-banner" hidden>
        <span>Editando la reserva de <strong id="reserva-edicion-nombre"></strong></span>
        <button type="button" id="reserva-edicion-cancelar" class="btn-secundario">Cancelar edición / Nueva reserva</button>
      </div>

      <form id="reserva-crear-form" class="reserva-form">
        <div class="form-field">
          <label for="reserva-nombre">Nombre del huésped *</label>
          <input type="text" id="reserva-nombre" required>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="reserva-tipo-unidad">Tipo de unidad *</label>
            <select id="reserva-tipo-unidad" required>
              <option value="suite">Suite Premium</option>
              <option value="cuarto">Suite Estándar</option>
            </select>
          </div>
          <div class="form-field">
            <label for="reserva-unidad">Unidad (opcional)</label>
            <select id="reserva-unidad">
              <option value="">Sin asignar (elegir después)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="reserva-checkin">Ingreso *</label>
            <input type="date" id="reserva-checkin" required>
          </div>
          <div class="form-field">
            <label for="reserva-checkout">Salida *</label>
            <input type="date" id="reserva-checkout" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="reserva-adultos">Adultos *</label>
            <input type="number" id="reserva-adultos" inputmode="numeric" min="1" value="2" required>
          </div>
          <div class="form-field">
            <label for="reserva-estado">Estado *</label>
            <select id="reserva-estado" required>
              <option value="Pendiente">Pendiente</option>
              <option value="Confirmada" selected>Confirmada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label for="reserva-telefono">Teléfono</label>
          <input type="tel" id="reserva-telefono" placeholder="Ej: 5493876123456">
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="reserva-tipo-cama">Tipo de cama</label>
            <input type="text" id="reserva-tipo-cama" placeholder="Ej: matrimonial">
          </div>
          <div class="form-field">
            <label for="reserva-paquete">Paquete</label>
            <select id="reserva-paquete">
              <option value="">Sin paquete</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="reserva-costo">Costo</label>
            <input type="number" id="reserva-costo" inputmode="numeric" min="0" placeholder="$">
          </div>
          <div class="form-field">
            <label for="reserva-sena">Seña</label>
            <input type="number" id="reserva-sena" inputmode="numeric" min="0" placeholder="$">
          </div>
        </div>

        <div class="form-field">
          <label for="reserva-observaciones">Observaciones</label>
          <textarea id="reserva-observaciones"></textarea>
        </div>

        <button type="submit" class="btn-crear-reserva">Crear reserva</button>
      </form>`;
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    modoEdicion = false;
    reservaEditId = null;
    unidadIdAnterior = null;
    paqueteActual = null;
    resultadosBusqueda = [];
    try {
      const [limpieza, paquetes] = await Promise.all([Api.limpieza(), Api.paquetes()]);
      unidadesDisponibles = limpieza.unidades || [];
      paquetesDisponibles = paquetes.paquetes || [];
      elEstado().textContent = "";
      elContent().innerHTML = formHtml();
      actualizarOpcionesUnidad();
      actualizarOpcionesPaquete();
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
