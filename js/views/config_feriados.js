const ViewConfigFeriados = (() => {
  const elEstado = () => document.getElementById("feriados-estado");
  const elContent = () => document.getElementById("feriados-content");

  const DIAS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

  // Las dos secciones son la misma tabla Feriados, separadas por Tipo
  const BLOQUES = [
    {
      key: "feriados",
      titulo: "Feriados y vísperas",
      ayuda: "El agente toma estas fechas como el día que imitan (horarios, cupos y tarifas de suites).",
      tipos: ["Feriado", "Vispera"],
      campos: [
        { name: "Fecha", label: "Fecha", type: "date", required: true },
        { name: "Tipo", label: "Tipo", type: "select", required: true, opciones: ["Feriado", "Vispera"] },
        { name: "Dia_que_imita", label: "Día que imita", type: "select", opciones: DIAS },
        { name: "Descripcion", label: "Descripción (opcional)", type: "text", placeholder: "Ej: Día de la Soberanía" }
      ]
    },
    {
      key: "agenda",
      titulo: "Agenda (menús especiales y eventos)",
      ayuda: "El agente ofrece el menú o evento de esa fecha y cobra la seña por persona. Con \"Publicar en la web\" aparece en la agenda de granvadori.com.ar.",
      tipos: ["menu", "menu unico"],
      campos: [
        { name: "Fecha", label: "Fecha", type: "date", required: true },
        { name: "Tipo", label: "Tipo", type: "select", required: true, opciones: ["menu", "menu unico"] },
        { name: "Titulo", label: "Título", type: "text", placeholder: "Ej: Mulata" },
        { name: "Hora", label: "Hora", type: "text", placeholder: "Ej: 21:00" },
        { name: "Precio", label: "Precio (web)", type: "text", placeholder: "Ej: $35000" },
        { name: "seña", label: "Seña por persona", type: "number", step: "1" },
        { name: "Dia_que_imita", label: "Día que imita", type: "select", opciones: DIAS },
        { name: "Publicar_web", label: "Publicar en la web", type: "checkbox", default: false },
        { name: "Imagen", label: "Imagen (URL)", type: "text", placeholder: "https://granvadori.com.ar/img/eventos/..." },
        { name: "Descripcion", label: "Descripción", type: "textarea" }
      ]
    }
  ];

  let listenersAttached = false;
  let items = [];
  let editIds = { feriados: null, agenda: null };
  let soloProximos = true;

  const bloqueConfig = key => BLOQUES.find(b => b.key === key);
  const hoyARG = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
        cargarParaEditar(btnEditar.dataset.bloque, btnEditar.dataset.id);
        return;
      }
      const btnCancelar = ev.target.closest(".config-btn-cancelar");
      if (btnCancelar) {
        editIds[btnCancelar.dataset.bloque] = null;
        renderTodo();
        return;
      }
      const btnBorrar = ev.target.closest(".config-btn-borrar");
      if (btnBorrar) {
        await handleBorrar(btnBorrar.dataset.bloque, btnBorrar.dataset.id);
      }
    });

    elContent().addEventListener("change", (ev) => {
      if (ev.target.id !== "feriados-filtro") return;
      soloProximos = ev.target.value === "proximos";
      renderTodo();
    });
  }

  function fechaConAnio(iso) {
    if (!iso) return "(sin fecha)";
    return `${Utils.fechaAbrev(iso)} ${iso.slice(0, 4)}`;
  }

  function campoHtml(bloque, campo, valor, editando) {
    const id = `feriados-${bloque}-${campo.name}`;
    if (campo.type === "checkbox") {
      // Airtable omite el checkbox destildado: al editar, undefined = false
      const checked = editando ? !!valor : !!campo.default;
      return `
        <div class="form-field">
          <label for="${id}">${campo.label}</label>
          <select id="${id}" name="${campo.name}">
            <option value="true"${checked ? " selected" : ""}>Sí</option>
            <option value="false"${!checked ? " selected" : ""}>No</option>
          </select>
        </div>`;
    }
    if (campo.type === "select") {
      const val = valor !== undefined && valor !== null ? valor : "";
      const opts = (campo.required ? [] : [""]).concat(campo.opciones);
      if (val !== "" && !opts.includes(val)) opts.push(val);
      return `
        <div class="form-field">
          <label for="${id}">${campo.label}${campo.required ? " *" : ""}</label>
          <select id="${id}" name="${campo.name}" ${campo.required ? "required" : ""}>
            ${opts.map(o => `<option value="${Utils.escapeHtml(o)}"${o === val ? " selected" : ""}>${Utils.escapeHtml(o)}</option>`).join("")}
          </select>
        </div>`;
    }
    const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
    const placeholder = campo.placeholder ? `placeholder="${Utils.escapeHtml(campo.placeholder)}"` : "";
    if (campo.type === "textarea") {
      return `
        <div class="form-field form-field-wide">
          <label for="${id}">${campo.label}</label>
          <textarea id="${id}" name="${campo.name}" ${placeholder}>${val}</textarea>
        </div>`;
    }
    return `
      <div class="form-field">
        <label for="${id}">${campo.label}${campo.required ? " *" : ""}</label>
        <input type="${campo.type}" id="${id}" name="${campo.name}"
          ${campo.step ? `step="${campo.step}"` : ""} ${placeholder}
          value="${val}" ${campo.required ? "required" : ""}>
      </div>`;
  }

  function formHtml(bloque, item) {
    const cfg = bloqueConfig(bloque);
    const editando = !!item;
    return `
      <form class="reserva-form config-form" data-bloque="${bloque}">
        <div class="form-row">
          ${cfg.campos.map(c => campoHtml(bloque, c, item ? item[c.name] : undefined, editando)).join("")}
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">${editando ? "Guardar cambios" : "Agregar"}</button>
          ${editando ? `<button type="button" class="btn-secundario config-btn-cancelar" data-bloque="${bloque}">Cancelar edición</button>` : ""}
        </div>
      </form>`;
  }

  function resumen(bloque, item) {
    if (bloque === "feriados") {
      const partes = [item.Tipo === "Vispera" ? "Víspera" : (item.Tipo || "-")];
      if (item.Dia_que_imita) partes.push(`imita ${item.Dia_que_imita}`);
      if (item.Descripcion) partes.push(item.Descripcion);
      return { titulo: fechaConAnio(item.Fecha), sub: partes.join(" · ") };
    }
    const partes = [item.Tipo || "-"];
    if (item.Hora) partes.push(item.Hora);
    if (item.Precio) partes.push(item.Precio);
    if (item["seña"]) partes.push(`seña ${Utils.formatMonto(item["seña"])}`);
    partes.push(item.Publicar_web ? "en la web" : "no publicado");
    return {
      titulo: `${fechaConAnio(item.Fecha)}${item.Titulo ? " · " + item.Titulo : ""}`,
      sub: partes.join(" · ")
    };
  }

  function itemsDe(bloque) {
    const cfg = bloqueConfig(bloque);
    const hoy = hoyARG();
    return items.filter(i => cfg.tipos.includes(i.Tipo) && (!soloProximos || (i.Fecha || "") >= hoy));
  }

  function listaHtml(bloque) {
    const lista = itemsDe(bloque);
    if (!lista.length) return `<div class="empty-msg">${soloProximos ? "Sin fechas próximas cargadas." : "Sin registros cargados."}</div>`;
    return lista.map(item => {
      const { titulo, sub } = resumen(bloque, item);
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(titulo)}</div>
              <div class="card-sub">${Utils.escapeHtml(sub)}</div>
            </div>
          </div>
          <div class="card-asignar">
            <button type="button" class="btn-secundario config-btn-editar" data-bloque="${bloque}" data-id="${Utils.escapeHtml(item.id)}">Editar</button>
            <button type="button" class="btn-peligro config-btn-borrar" data-bloque="${bloque}" data-id="${Utils.escapeHtml(item.id)}">Borrar</button>
          </div>
        </div>`;
    }).join("");
  }

  function seccionHtml(bloque) {
    const cfg = bloqueConfig(bloque);
    const editId = editIds[bloque];
    const item = editId ? items.find(i => i.id === editId) : null;
    return `
      <div class="config-section" data-bloque="${bloque}">
        <div class="section-title">${cfg.titulo}</div>
        <p class="reserva-buscar-msg">${cfg.ayuda}</p>
        <div class="config-lista">${listaHtml(bloque)}</div>
        ${formHtml(bloque, item)}
      </div>`;
  }

  function renderTodo() {
    const ocultos = items.filter(i => (i.Fecha || "") < hoyARG()).length;
    elContent().innerHTML = `
      <div class="reserva-buscar-fila">
        <div class="form-field">
          <label for="feriados-filtro">Mostrar</label>
          <select id="feriados-filtro">
            <option value="proximos"${soloProximos ? " selected" : ""}>Desde hoy</option>
            <option value="todos"${!soloProximos ? " selected" : ""}>Todas (incluye ${ocultos} pasadas)</option>
          </select>
        </div>
      </div>
      ${BLOQUES.map(b => seccionHtml(b.key)).join("")}`;
  }

  function cargarParaEditar(bloque, id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    editIds[bloque] = id;
    renderTodo();
    const form = elContent().querySelector(`.config-form[data-bloque="${bloque}"]`);
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleBorrar(bloque, id) {
    const item = items.find(i => i.id === id);
    const { titulo } = item ? resumen(bloque, item) : { titulo: "este registro" };
    if (!confirm(`¿Confirmás borrar "${titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await Api.configBorrar("feriados", id);
      if (!res.ok) throw new Error(res.error || "No se pudo borrar el registro.");
      if (editIds[bloque] === id) editIds[bloque] = null;
      await cargar();
      renderTodo();
    } catch (err) {
      alert(err.message);
    }
  }

  // Al editar, los campos vacíos se mandan como null para que el backend los borre en Airtable
  function leerFormulario(bloque, form, editando) {
    const out = {};
    for (const c of bloqueConfig(bloque).campos) {
      const input = form.querySelector(`[name="${c.name}"]`);
      if (!input) continue;
      if (c.type === "checkbox") {
        out[c.name] = input.value === "true";
        continue;
      }
      const v = input.value.trim();
      if (v === "") {
        if (editando) out[c.name] = null;
        continue;
      }
      if (c.type === "number") {
        const n = Number(v);
        if (!Number.isNaN(n)) out[c.name] = n;
      } else {
        out[c.name] = v;
      }
    }
    return out;
  }

  async function handleSubmit(form) {
    const bloque = form.dataset.bloque;
    const editId = editIds[bloque];
    const datosForm = leerFormulario(bloque, form, !!editId);
    const btn = form.querySelector(".btn-crear-reserva");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = editId ? "Guardando…" : "Agregando…";
    try {
      const res = editId
        ? await Api.configEditar("feriados", { ...datosForm, id: editId })
        : await Api.configCrear("feriados", datosForm);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar el registro.");
      editIds[bloque] = null;
      await cargar();
      renderTodo();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }

  async function cargar() {
    const res = await Api.configListar("feriados");
    if (!res.ok) throw new Error(res.error || "No se pudieron cargar los feriados.");
    items = res.items || [];
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    editIds = { feriados: null, agenda: null };
    try {
      await cargar();
      elEstado().textContent = "";
      renderTodo();
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
