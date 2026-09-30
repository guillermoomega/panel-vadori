const ViewConfigTarifas = (() => {
  const elEstado = () => document.getElementById("configuracion-estado");
  const elContent = () => document.getElementById("configuracion-content");

  const TABLAS = [
    {
      key: "tarifas",
      titulo: "Tarifas (paquetes)",
      ayuda: "ABM de la tabla Tarifas: precios base, precios por temporada, días habilitados y vigencia de cada paquete.",
      selector: true,
      campos: [
        { name: "Pack", label: "Paquete", type: "text", required: true, placeholder: "Nombre del paquete" },
        { name: "tipo", label: "Tipo", type: "select", required: true, opciones: ["Voucher", "Alojamiento", "Adicional", "Menu"] },
        { name: "Estado", label: "Estado", type: "select", required: true, opciones: ["Activo", "Inactivo"], default: "Activo" },
        { name: "Temporada", label: "Temporada", type: "select", opciones: ["Baja", "Media", "Alta", "Especial"] },
        { name: "Suite", label: "Precio Suite Premium", type: "number", step: "0.01" },
        { name: "Cuarto", label: "Precio Suite Estándar", type: "number", step: "0.01" },
        { name: "Restaurante", label: "Precio Restaurante", type: "number", step: "0.01" },
        { name: "Suite_Alta", label: "Precio Suite Premium (temporada alta)", type: "number", step: "0.01" },
        { name: "Suite_Baja", label: "Precio Suite Premium (temporada baja)", type: "number", step: "0.01" },
        { name: "Cuarto_Alta", label: "Precio Suite Estándar (temporada alta)", type: "number", step: "0.01" },
        { name: "Cuarto_Baja", label: "Precio Suite Estándar (temporada baja)", type: "number", step: "0.01" },
        { name: "Noches", label: "Noches", type: "number", step: "1" },
        { name: "Dias", label: "Días habilitados", type: "multiselect", opciones: ["miercoles", "jueves", "viernes", "sábado", "sabado", "Viernes", "domingo", "lunes", "martes"] },
        { name: "Validez desde", label: "Válido desde", type: "date" },
        { name: "Validez hasta", label: "Válido hasta", type: "date" },
        { name: "Descripcion", label: "Descripción", type: "textarea" },
        { name: "Notas", label: "Notas", type: "textarea" }
      ]
    },
    {
      key: "excepciones",
      oculto: true,
      titulo: "Excepciones de fechas",
      ayuda: "Habilita o deshabilita este paquete durante un rango de fechas que contenga el ingreso de la consulta.",
      campos: [
        { name: "Pack", type: "hidden" },
        { name: "Fecha_desde", label: "Desde", type: "date", required: true },
        { name: "Fecha_hasta", label: "Hasta", type: "date", required: true },
        { name: "Disponible", label: "Disponible en este rango", type: "checkbox", default: true },
        { name: "Motivo", label: "Motivo (opcional)", type: "text" }
      ]
    },
    {
      key: "temporadas",
      titulo: "Temporadas (precio alto / bajo)",
      ayuda: "Define un rango de fechas de temporada. El Nombre determina qué columnas de Tarifas se usan (por convención: \"Alta\" o \"Baja\"). Fuera de estos rangos se usa el precio base de Tarifas.",
      campos: [
        { name: "Nombre", label: "Nombre", type: "text", required: true, placeholder: "Ej: Alta" },
        { name: "Fecha_desde", label: "Desde", type: "date", required: true },
        { name: "Fecha_hasta", label: "Hasta", type: "date", required: true }
      ]
    },
    {
      key: "restricciones",
      titulo: "Restricción de noches por fecha",
      ayuda: "Restringe qué paquetes (por cantidad de noches) están disponibles durante un rango de fechas que contenga el ingreso.",
      campos: [
        { name: "Nombre", label: "Nombre", type: "text", required: true, placeholder: "Ej: Fin de semana largo Octubre" },
        { name: "Fecha_desde", label: "Desde", type: "date", required: true },
        { name: "Fecha_hasta", label: "Hasta", type: "date", required: true },
        { name: "Noches_permitidas", label: "Noches permitidas", type: "text", required: true, placeholder: "Ej: 2,3" },
        { name: "Motivo", label: "Motivo (opcional)", type: "text" }
      ]
    }
  ];

  let listenersAttached = false;
  let datos = { tarifas: [], excepciones: [], temporadas: [], restricciones: [] };
  let editIds = { tarifas: null, excepciones: null, temporadas: null, restricciones: null };

  function tablaConfig(key) {
    return TABLAS.find(t => t.key === key);
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    elContent().addEventListener("submit", async (ev) => {
      const form = ev.target.closest(".config-form");
      if (!form) return;
      ev.preventDefault();
      await handleSubmit(form);
    });

    elContent().addEventListener("click", async (ev) => {
      const btnEditar = ev.target.closest(".config-btn-editar");
      if (btnEditar) {
        cargarParaEditar(btnEditar.dataset.tabla, btnEditar.dataset.id);
        return;
      }
      const btnCancelar = ev.target.closest(".config-btn-cancelar");
      if (btnCancelar) {
        salirModoEdicion(btnCancelar.dataset.tabla);
        return;
      }
      const btnBorrar = ev.target.closest(".config-btn-borrar");
      if (btnBorrar) {
        await handleBorrar(btnBorrar.dataset.tabla, btnBorrar.dataset.id);
        return;
      }
    });

    elContent().addEventListener("change", (ev) => {
      const sel = ev.target.closest(".config-selector-editar");
      if (!sel) return;
      const tabla = sel.dataset.tabla;
      editIds[tabla] = sel.value || null;
      if (tabla === "tarifas") editIds.excepciones = null;
      renderTodo();
    });
  }

  function campoHtml(tabla, campo, valor, editando) {
    const id = `config-${tabla}-${campo.name}`.replace(/\s+/g, "_");
    if (campo.type === "hidden") {
      const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
      return `<input type="hidden" id="${id}" name="${campo.name}" value="${val}">`;
    }
    if (campo.type === "checkbox") {
      // Airtable omite el campo cuando el checkbox está destildado (no lo manda como false),
      // así que al editar, "valor undefined" significa false — el default solo aplica al crear.
      const checked = editando ? !!valor : (valor !== undefined ? !!valor : !!campo.default);
      return `
        <div class="form-field">
          <label for="${id}">${campo.label}</label>
          <select id="${id}" name="${campo.name}">
            <option value="true"${checked ? " selected" : ""}>Sí</option>
            <option value="false"${!checked ? " selected" : ""}>No</option>
          </select>
        </div>`;
    }
    if (campo.type === "select" || campo.type === "select-dynamic") {
      const opciones = campo.type === "select-dynamic" ? campo.opciones() : campo.opciones;
      const val = valor !== undefined && valor !== null && valor !== ""
        ? valor
        : (!editando && campo.default !== undefined ? campo.default : "");
      const opts = (campo.required ? [] : [""]).concat(opciones);
      if (val !== "" && !opts.includes(val)) opts.push(val); // preserva valores existentes que ya no están en las opciones
      return `
        <div class="form-field">
          <label for="${id}">${campo.label}${campo.required ? " *" : ""}</label>
          <select id="${id}" name="${campo.name}" ${campo.required ? "required" : ""}>
            ${opts.map(o => `<option value="${Utils.escapeHtml(o)}"${o === val ? " selected" : ""}>${o === "" ? "" : Utils.escapeHtml(o)}</option>`).join("")}
          </select>
        </div>`;
    }
    if (campo.type === "multiselect") {
      const seleccionados = Array.isArray(valor) ? valor : [];
      const boxes = campo.opciones.map((o, i) => {
        const cid = `${id}-${i}`;
        const checked = seleccionados.includes(o) ? " checked" : "";
        return `<label class="checkbox-inline" for="${cid}"><input type="checkbox" id="${cid}" data-multiselect="${campo.name}" value="${Utils.escapeHtml(o)}"${checked}>${Utils.escapeHtml(o)}</label>`;
      }).join("");
      return `
        <div class="form-field form-field-wide">
          <label>${campo.label}</label>
          <div class="checkbox-group">${boxes}</div>
        </div>`;
    }
    if (campo.type === "textarea") {
      const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
      return `
        <div class="form-field form-field-wide">
          <label for="${id}">${campo.label}${campo.required ? " *" : ""}</label>
          <textarea id="${id}" name="${campo.name}"
            ${campo.placeholder ? `placeholder="${Utils.escapeHtml(campo.placeholder)}"` : ""}
            ${campo.required ? "required" : ""}>${val}</textarea>
        </div>`;
    }
    const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
    const inputType = campo.type === "number" ? "number" : campo.type;
    return `
      <div class="form-field">
        <label for="${id}">${campo.label}${campo.required ? " *" : ""}</label>
        <input type="${inputType}" id="${id}" name="${campo.name}"
          ${campo.step ? `step="${campo.step}"` : ""}
          ${campo.placeholder ? `placeholder="${Utils.escapeHtml(campo.placeholder)}"` : ""}
          value="${val}" ${campo.required ? "required" : ""}>
      </div>`;
  }

  function formHtml(tabla, item) {
    const cfg = tablaConfig(tabla);
    const editando = !!item;
    return `
      <form class="reserva-form config-form" data-tabla="${tabla}">
        <div class="form-row">
          ${cfg.campos.map(c => campoHtml(tabla, c, item ? item[c.name] : undefined, editando)).join("")}
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">${editando ? "Guardar cambios" : "Agregar"}</button>
          ${editando ? `<button type="button" class="btn-secundario config-btn-cancelar" data-tabla="${tabla}">Cancelar edición</button>` : ""}
        </div>
      </form>`;
  }

  function filaResumen(tabla, item) {
    if (tabla === "excepciones") {
      const disponible = item.Disponible ? "Disponible" : "No disponible";
      return {
        titulo: item.Pack || "(sin nombre)",
        sub: `${Utils.rangoFechas(item.Fecha_desde, item.Fecha_hasta)} · ${disponible}${item.Motivo ? " · " + item.Motivo : ""}`
      };
    }
    if (tabla === "temporadas") {
      return {
        titulo: item.Nombre || "(sin nombre)",
        sub: Utils.rangoFechas(item.Fecha_desde, item.Fecha_hasta)
      };
    }
    if (tabla === "restricciones") {
      return {
        titulo: item.Nombre || "(sin nombre)",
        sub: `${Utils.rangoFechas(item.Fecha_desde, item.Fecha_hasta)} · Noches: ${item.Noches_permitidas || "-"}${item.Motivo ? " · " + item.Motivo : ""}`
      };
    }
    const precios = [];
    if (item.Suite !== undefined) precios.push(`Suite Premium ${Utils.formatMonto(item.Suite)}`);
    if (item.Cuarto !== undefined) precios.push(`Suite Estándar ${Utils.formatMonto(item.Cuarto)}`);
    return {
      titulo: `${item.Pack || "(sin nombre)"}${item.tipo ? " · " + item.tipo : ""}`,
      sub: `${item.Estado || "-"}${precios.length ? " · " + precios.join(" · ") : ""}${item.Temporada ? " · Temp. " + item.Temporada : ""}`
    };
  }

  function listaHtml(tabla) {
    const items = datos[tabla] || [];
    if (!items.length) return `<div class="empty-msg">Sin registros cargados.</div>`;
    return items.map(item => {
      const { titulo, sub } = filaResumen(tabla, item);
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(titulo)}</div>
              <div class="card-sub">${Utils.escapeHtml(sub)}</div>
            </div>
          </div>
          <div class="card-asignar">
            <button type="button" class="btn-secundario config-btn-editar" data-tabla="${tabla}" data-id="${Utils.escapeHtml(item.id)}">Editar</button>
            <button type="button" class="btn-peligro config-btn-borrar" data-tabla="${tabla}" data-id="${Utils.escapeHtml(item.id)}">Borrar</button>
          </div>
        </div>`;
    }).join("");
  }

  function selectorHtml(tabla) {
    const items = datos[tabla] || [];
    const editId = editIds[tabla];
    const opciones = items.map(item => {
      const { titulo } = filaResumen(tabla, item);
      return `<option value="${Utils.escapeHtml(item.id)}"${item.id === editId ? " selected" : ""}>${Utils.escapeHtml(titulo)}</option>`;
    }).join("");
    return `
      <div class="reserva-buscar-fila">
        <div class="form-field">
          <label for="config-selector-${tabla}">Paquete a editar</label>
          <select id="config-selector-${tabla}" class="config-selector-editar" data-tabla="${tabla}">
            <option value="">+ Nuevo paquete</option>
            ${opciones}
          </select>
        </div>
        ${editId ? `<button type="button" class="btn-peligro config-btn-borrar" data-tabla="${tabla}" data-id="${Utils.escapeHtml(editId)}">Borrar</button>` : ""}
      </div>`;
  }

  function excepcionesListaHtml(pack) {
    const items = (datos.excepciones || []).filter(e => e.Pack === pack);
    if (!items.length) return `<div class="empty-msg">Sin excepciones cargadas para este paquete.</div>`;
    return items.map(item => {
      const disponible = item.Disponible ? "Disponible" : "No disponible";
      const sub = `${Utils.rangoFechas(item.Fecha_desde, item.Fecha_hasta)} · ${disponible}${item.Motivo ? " · " + item.Motivo : ""}`;
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(sub)}</div>
            </div>
          </div>
          <div class="card-asignar">
            <button type="button" class="btn-secundario config-btn-editar" data-tabla="excepciones" data-id="${Utils.escapeHtml(item.id)}">Editar</button>
            <button type="button" class="btn-peligro config-btn-borrar" data-tabla="excepciones" data-id="${Utils.escapeHtml(item.id)}">Borrar</button>
          </div>
        </div>`;
    }).join("");
  }

  function excepcionesFormHtml(pack, item) {
    const cfg = tablaConfig("excepciones");
    const editando = !!item;
    const effectiveItem = item || { Pack: pack };
    return `
      <form class="reserva-form config-form" data-tabla="excepciones">
        <div class="form-row">
          ${cfg.campos.map(c => campoHtml("excepciones", c, effectiveItem[c.name], editando)).join("")}
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">${editando ? "Guardar cambios" : "Agregar excepción"}</button>
          ${editando ? `<button type="button" class="btn-secundario config-btn-cancelar" data-tabla="excepciones">Cancelar edición</button>` : ""}
        </div>
      </form>`;
  }

  function excepcionesSubseccionHtml(tarifaItem) {
    const cfg = tablaConfig("excepciones");
    const editId = editIds.excepciones;
    const item = editId ? (datos.excepciones || []).find(i => i.id === editId && i.Pack === tarifaItem.Pack) : null;
    return `
      <div class="config-subseccion" data-tabla="excepciones">
        <div class="section-title">${cfg.titulo}</div>
        <p class="reserva-buscar-msg">${cfg.ayuda}</p>
        <div class="config-lista">${excepcionesListaHtml(tarifaItem.Pack)}</div>
        ${excepcionesFormHtml(tarifaItem.Pack, item)}
      </div>`;
  }

  function seccionHtml(tabla) {
    const cfg = tablaConfig(tabla);
    const editId = editIds[tabla];
    const item = editId ? (datos[tabla] || []).find(i => i.id === editId) : null;
    return `
      <div class="config-section" data-tabla="${tabla}">
        <div class="section-title">${cfg.titulo}</div>
        <p class="reserva-buscar-msg">${cfg.ayuda}</p>
        ${cfg.selector ? selectorHtml(tabla) : `<div class="config-lista" id="config-lista-${tabla}">${listaHtml(tabla)}</div>`}
        ${formHtml(tabla, item)}
        ${tabla === "tarifas" && item ? excepcionesSubseccionHtml(item) : ""}
      </div>`;
  }

  function renderTodo() {
    elContent().innerHTML = TABLAS.filter(t => !t.oculto).map(t => seccionHtml(t.key)).join("");
  }

  function cargarParaEditar(tabla, id) {
    const item = (datos[tabla] || []).find(i => i.id === id);
    if (!item) return;
    editIds[tabla] = id;
    renderTodo();
    const seccion = document.querySelector(`.config-section[data-tabla="${tabla}"], .config-subseccion[data-tabla="${tabla}"]`);
    if (seccion) seccion.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function salirModoEdicion(tabla) {
    editIds[tabla] = null;
    if (tabla === "tarifas") editIds.excepciones = null;
    renderTodo();
  }

  async function handleBorrar(tabla, id) {
    const item = (datos[tabla] || []).find(i => i.id === id);
    const { titulo } = item ? filaResumen(tabla, item) : { titulo: "este registro" };
    if (!confirm(`¿Confirmás borrar "${titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await Api.configBorrar(tabla, id);
      if (!res.ok) throw new Error(res.error || "No se pudo borrar el registro.");
      if (editIds[tabla] === id) {
        editIds[tabla] = null;
        if (tabla === "tarifas") editIds.excepciones = null;
      }
      await cargarTabla(tabla);
      renderTodo();
    } catch (err) {
      alert(err.message);
    }
  }

  function leerFormulario(tabla, form) {
    const cfg = tablaConfig(tabla);
    const out = {};
    for (const c of cfg.campos) {
      if (c.type === "multiselect") {
        const checks = form.querySelectorAll(`[data-multiselect="${c.name}"]:checked`);
        out[c.name] = Array.from(checks).map(chk => chk.value);
        continue;
      }
      const input = form.querySelector(`[name="${c.name}"]`);
      if (!input) continue;
      if (c.type === "checkbox") {
        out[c.name] = input.value === "true";
      } else if (c.type === "number") {
        const v = input.value.trim();
        if (v !== "") {
          const n = Number(v);
          if (!Number.isNaN(n)) out[c.name] = n;
        }
      } else {
        const v = input.value.trim();
        if (v !== "") out[c.name] = v;
      }
    }
    return out;
  }

  async function handleSubmit(form) {
    const tabla = form.dataset.tabla;
    const editId = editIds[tabla];
    const datosForm = leerFormulario(tabla, form);
    const btn = form.querySelector(".btn-crear-reserva");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = editId ? "Guardando…" : "Agregando…";
    try {
      const res = editId
        ? await Api.configEditar(tabla, { ...datosForm, id: editId })
        : await Api.configCrear(tabla, datosForm);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar el registro.");
      editIds[tabla] = null;
      await cargarTabla(tabla);
      renderTodo();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }

  async function cargarTabla(tabla) {
    const res = await Api.configListar(tabla);
    if (!res.ok) throw new Error(res.error || `No se pudo cargar ${tabla}.`);
    datos[tabla] = res.items || [];
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    editIds = { excepciones: null, temporadas: null, restricciones: null, tarifas: null };
    try {
      await Promise.all(TABLAS.map(t => cargarTabla(t.key)));
      elEstado().textContent = "";
      renderTodo();
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
