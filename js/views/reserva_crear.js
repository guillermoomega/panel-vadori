const ViewReservaCrear = (() => {
  const elEstado = () => document.getElementById("nueva-reserva-estado");
  const elContent = () => document.getElementById("nueva-reserva-content");

  let listenersAttached = false;
  let unidadesDisponibles = [];

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
      if (ev.target.id === "reserva-tipo-unidad") actualizarOpcionesUnidad();
    });
  }

  function actualizarOpcionesUnidad() {
    const tipoSel = document.getElementById("reserva-tipo-unidad");
    const unidadSel = document.getElementById("reserva-unidad");
    if (!tipoSel || !unidadSel) return;
    const tipo = tipoSel.value;
    const valorPrevio = unidadSel.value;
    const opciones = unidadesDisponibles.filter(u => u.estado === "Lista" && u.tipo === tipo);
    unidadSel.innerHTML = `<option value="">Sin asignar (elegir después)</option>` +
      opciones.map(u => `<option value="${Utils.escapeHtml(u.id)}">${Utils.escapeHtml(u.nombre)}</option>`).join("");
    if (opciones.some(u => u.id === valorPrevio)) unidadSel.value = valorPrevio;
  }

  async function handleSubmit(form) {
    const btn = form.querySelector(".btn-crear-reserva");

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
      alert("Completá nombre, check-in, check-out y adultos.");
      return;
    }
    if (checkout <= checkin) {
      alert("El check-out debe ser posterior al check-in.");
      return;
    }

    const unidadTexto = unidad_id ? unidadSel.options[unidadSel.selectedIndex].textContent : "sin asignar";
    const resumen = `Huésped: ${nombre}\n` +
      `Unidad: ${tipo_unidad === "suite" ? "Suite" : "Cuarto"} (${unidadTexto})\n` +
      `Fechas: ${Utils.rangoFechas(checkin, checkout)}\n` +
      `Adultos: ${adultos}\n` +
      `Estado: ${estado}`;
    if (!confirm(`¿Confirmás crear esta reserva?\n\n${resumen}`)) return;

    const datos = {
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
    btn.textContent = "Creando…";
    try {
      const res = await Api.crearReserva(datos);
      if (!res.ok) throw new Error(res.error || "No se pudo crear la reserva.");
      let msg = "Reserva creada correctamente.";
      if (unidad_id && !res.unidad_asignada) {
        msg += " " + (res.error || "No se pudo marcar la unidad como ocupada, revisá el estado de la unidad manualmente.");
      }
      alert(msg);
      form.reset();
      await render();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }

  function formHtml() {
    return `
      <form id="reserva-crear-form" class="reserva-form">
        <div class="form-field">
          <label for="reserva-nombre">Nombre del huésped *</label>
          <input type="text" id="reserva-nombre" required>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="reserva-tipo-unidad">Tipo de unidad *</label>
            <select id="reserva-tipo-unidad" required>
              <option value="suite">Suite</option>
              <option value="cuarto">Cuarto</option>
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
            <label for="reserva-checkin">Check-in *</label>
            <input type="date" id="reserva-checkin" required>
          </div>
          <div class="form-field">
            <label for="reserva-checkout">Check-out *</label>
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
              <option value="Confirmada">Confirmada</option>
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
            <input type="text" id="reserva-paquete" placeholder="Ej: Noche simple">
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
    try {
      const limpieza = await Api.limpieza();
      unidadesDisponibles = limpieza.unidades || [];
      elEstado().textContent = "";
      elContent().innerHTML = formHtml();
      actualizarOpcionesUnidad();
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
