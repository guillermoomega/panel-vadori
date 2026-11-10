const ViewEquipo = (() => {
  const elEstado = () => document.getElementById("equipo-estado");
  const elContent = () => document.getElementById("equipo-content");

  const AREAS = ["General", "Cocina", "Salon"];
  const ROLES = ["Administrador", "Supervisor", "usuario"];

  let listenersAttached = false;
  let personas = [];
  let categorias = [];
  let editPersonaId = null;
  let editCategoriaId = null;
  let filtro = "";

  // Mismo criterio que el backend: el teléfono se guarda sin espacios/guiones/paréntesis.
  const normTel = (t) => String(t || "").replace(/[\s\-().]/g, "");

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    elContent().addEventListener("input", (ev) => {
      if (ev.target.id !== "equipo-filtro") return;
      filtro = ev.target.value.trim().toLowerCase();
      renderTodo();
      const input = document.getElementById("equipo-filtro");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });

    elContent().addEventListener("submit", async (ev) => {
      const formPersona = ev.target.closest("#equipo-form");
      const formCategoria = ev.target.closest("#categoria-form");
      if (!formPersona && !formCategoria) return;
      ev.preventDefault();
      if (formPersona) await guardarPersona(formPersona);
      else await guardarCategoria(formCategoria);
    });

    elContent().addEventListener("click", async (ev) => {
      const b = ev.target.closest("button[data-accion]");
      if (!b) return;
      const { accion, id } = b.dataset;
      if (accion === "editar-persona") {
        editPersonaId = id;
        renderTodo();
        document.getElementById("equipo-form").scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (accion === "cancelar-persona") {
        editPersonaId = null;
        renderTodo();
      } else if (accion === "borrar-persona") {
        await borrarPersona(id);
      } else if (accion === "editar-categoria") {
        editCategoriaId = id;
        renderTodo();
        document.getElementById("categoria-form").scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (accion === "cancelar-categoria") {
        editCategoriaId = null;
        renderTodo();
      } else if (accion === "borrar-categoria") {
        await borrarCategoria(id);
      }
    });
  }

  function campoTexto(id, name, label, valor, opts = {}) {
    const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
    return `
      <div class="form-field">
        <label for="${id}">${label}${opts.required ? " *" : ""}</label>
        <input type="${opts.type || "text"}" id="${id}" name="${name}" value="${val}" ${opts.placeholder ? `placeholder="${Utils.escapeHtml(opts.placeholder)}"` : ""} ${opts.step ? `step="${opts.step}"` : ""} ${opts.min !== undefined ? `min="${opts.min}"` : ""} ${opts.required ? "required" : ""}>
      </div>`;
  }

  function campoSiNo(id, name, label, valor) {
    return `
      <div class="form-field">
        <label for="${id}">${label}</label>
        <select id="${id}" name="${name}">
          <option value="false"${!valor ? " selected" : ""}>No</option>
          <option value="true"${valor ? " selected" : ""}>Sí</option>
        </select>
      </div>`;
  }

  function campoChecks(name, label, opciones, valores) {
    const boxes = opciones.map(o => `
      <label class="checkbox-inline">
        <input type="checkbox" name="${name}" value="${Utils.escapeHtml(o)}"${(valores || []).includes(o) ? " checked" : ""}>
        ${Utils.escapeHtml(o === "Salon" ? "Salón" : o)}
      </label>`).join("");
    return `
      <div class="form-field form-field-wide">
        <label>${label}</label>
        <div class="checkbox-group">${boxes}</div>
      </div>`;
  }

  function campoCategoria(valor) {
    const opts = categorias.map(c => `<option value="${Utils.escapeHtml(c.id)}"${c.id === valor ? " selected" : ""}>${Utils.escapeHtml(c.Categoria)}${c.Jornal_hora ? ` · ${Utils.formatMonto(c.Jornal_hora)}/h` : ""}</option>`).join("");
    return `
      <div class="form-field">
        <label for="equipo-categoria">Categoría</label>
        <select id="equipo-categoria" name="Categoria">
          <option value="">(sin categoría)</option>
          ${opts}
        </select>
      </div>`;
  }

  const nombreCategoria = (id) => (categorias.find(c => c.id === id) || {}).Categoria || "";

  // ---------- Categorías ----------

  function categoriasHtml() {
    const item = editCategoriaId ? categorias.find(c => c.id === editCategoriaId) : null;
    const lista = categorias.length ? categorias.map(c => {
      const uso = [];
      uso.push(c.Area ? (c.Area === "Salon" ? "Salón" : c.Area) : "sin área (sus jornales no aparecen al pagar)");
      uso.push(c.personas === 1 ? "1 persona" : `${c.personas} personas`);
      if (c.fichajes) uso.push(c.fichajes === 1 ? "1 jornal cargado" : `${c.fichajes} jornales cargados`);
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(c.Categoria)} · ${c.Jornal_hora ? Utils.formatMonto(c.Jornal_hora) + " por hora" : "sin jornal"}</div>
              <div class="card-sub">${Utils.escapeHtml(uso.join(" · "))}</div>
            </div>
          </div>
          <div class="card-asignar">
            <button type="button" class="btn-secundario" data-accion="editar-categoria" data-id="${Utils.escapeHtml(c.id)}">Editar</button>
            <button type="button" class="btn-peligro" data-accion="borrar-categoria" data-id="${Utils.escapeHtml(c.id)}">Borrar</button>
          </div>
        </div>`;
    }).join("") : `<div class="empty-msg">No hay categorías cargadas.</div>`;

    return `
      <div class="section-title">Categorías · ${categorias.length}</div>
      <div class="config-lista">${lista}</div>
      <form id="categoria-form" class="reserva-form">
        <div class="form-row">
          ${campoTexto("categoria-nombre", "Categoria", "Nombre de la categoría", item ? item.Categoria : "", { required: true, placeholder: "Ej: Cocina A" })}
          ${campoTexto("categoria-jornal", "Jornal_hora", "Jornal por hora ($)", item ? item.Jornal_hora : "", { type: "number", step: "1", min: 1, required: true })}
          <div class="form-field">
            <label for="categoria-area">Área *</label>
            <select id="categoria-area" name="Area" required>
              <option value=""${item && item.Area ? "" : " selected"}></option>
              <option value="Cocina"${item && item.Area === "Cocina" ? " selected" : ""}>Cocina</option>
              <option value="Salon"${item && item.Area === "Salon" ? " selected" : ""}>Salón</option>
            </select>
          </div>
          <div class="form-aviso">El jornal por hora se usa para calcular lo que cobra cada persona en Horas. Si lo cambiás, las horas se recalculan con el valor nuevo. El área define en qué área (Cocina o Salón) aparecen para pagar los jornales cargados con esta categoría.</div>
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">${item ? "Guardar cambios" : "Agregar categoría"}</button>
          ${item ? `<button type="button" class="btn-secundario" data-accion="cancelar-categoria">Cancelar edición</button>` : ""}
        </div>
      </form>`;
  }

  async function guardarCategoria(form) {
    const datos = {
      Categoria: form.querySelector('[name="Categoria"]').value.trim(),
      Jornal_hora: Number(form.querySelector('[name="Jornal_hora"]').value),
      Area: form.querySelector('[name="Area"]').value
    };
    const repetida = categorias.find(c => c.id !== editCategoriaId && c.Categoria.trim().toLowerCase() === datos.Categoria.toLowerCase());
    if (repetida) {
      alert(`Ya existe la categoría "${repetida.Categoria}".`);
      return;
    }
    const actual = editCategoriaId ? categorias.find(c => c.id === editCategoriaId) : null;
    if (actual && actual.Jornal_hora !== datos.Jornal_hora && (actual.personas || actual.fichajes)) {
      if (!confirm(`El jornal de "${actual.Categoria}" pasa de ${Utils.formatMonto(actual.Jornal_hora)} a ${Utils.formatMonto(datos.Jornal_hora)} por hora. Las horas de las personas de esta categoría se van a calcular con el valor nuevo. ¿Confirmás?`)) return;
    }
    await enviar(form, editCategoriaId ? "Guardando…" : "Agregando…", async () => {
      const res = editCategoriaId
        ? await Api.configEditar("categorias", { ...datos, id: editCategoriaId })
        : await Api.configCrear("categorias", datos);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar la categoría.");
      editCategoriaId = null;
    });
  }

  async function borrarCategoria(id) {
    const c = categorias.find(x => x.id === id);
    if (!c) return;
    if (c.personas || c.fichajes) {
      alert(`No se puede borrar "${c.Categoria}": la usan ${c.personas} persona(s)${c.fichajes ? ` y tiene ${c.fichajes} jornal(es) cargado(s)` : ""}. Pasá a esas personas a otra categoría primero.`);
      return;
    }
    if (!confirm(`¿Confirmás borrar la categoría "${c.Categoria}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await Api.configBorrar("categorias", id);
      if (!res.ok) throw new Error(res.error || "No se pudo borrar la categoría.");
      if (editCategoriaId === id) editCategoriaId = null;
      await cargar();
      renderTodo();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Personas ----------

  function personasFiltradas() {
    if (!filtro) return personas;
    return personas.filter(p => `${p.Nombre} ${p.Telefono} ${nombreCategoria(p.Categoria)}`.toLowerCase().includes(filtro));
  }

  function personasHtml() {
    const item = editPersonaId ? personas.find(p => p.id === editPersonaId) : null;
    const filtradas = personasFiltradas();
    const lista = filtradas.length ? filtradas.map(p => {
      const sub = [];
      sub.push(p.Telefono || "sin teléfono (no puede fichar por WhatsApp)");
      if (p.Area.length) sub.push(p.Area.map(a => a === "Salon" ? "Salón" : a).join(", "));
      sub.push(nombreCategoria(p.Categoria) || "sin categoría (sus horas no tienen tarifa)");
      if (p.Rol.length) sub.push(p.Rol.join(", "));
      const avisos = [];
      if (p.recibe_mensaje) avisos.push("recibe avisos");
      if (p.recibe_errores) avisos.push("recibe errores");
      if (avisos.length) sub.push(avisos.join(" y "));
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(p.Nombre)}</div>
              <div class="card-sub">${Utils.escapeHtml(sub.join(" · "))}</div>
            </div>
          </div>
          <div class="card-asignar">
            <button type="button" class="btn-secundario" data-accion="editar-persona" data-id="${Utils.escapeHtml(p.id)}">Editar</button>
            <button type="button" class="btn-peligro" data-accion="borrar-persona" data-id="${Utils.escapeHtml(p.id)}">Borrar</button>
          </div>
        </div>`;
    }).join("") : `<div class="empty-msg">Sin personas que coincidan.</div>`;

    return `
      <div class="section-title">Equipo · ${personas.length}</div>
      <div class="form-field">
        <label for="equipo-filtro">Buscar por nombre, teléfono o categoría</label>
        <input type="text" id="equipo-filtro" placeholder="Ej: Cocina" value="${Utils.escapeHtml(filtro)}">
      </div>
      <div class="config-lista">${lista}</div>
      <form id="equipo-form" class="reserva-form">
        <div class="form-row">
          ${campoTexto("equipo-nombre", "Nombre", "Nombre", item ? item.Nombre : "", { required: true })}
          ${campoTexto("equipo-telefono", "Telefono", "Teléfono (WhatsApp)", item ? item.Telefono : "", { type: "tel", placeholder: "+5493547123456" })}
          ${campoCategoria(item ? item.Categoria : "")}
          ${campoSiNo("equipo-recibe-mensaje", "recibe_mensaje", "Recibe avisos del equipo", item ? item.recibe_mensaje : false)}
          ${campoSiNo("equipo-recibe-errores", "recibe_errores", "Recibe avisos de errores", item ? item.recibe_errores : false)}
          ${campoChecks("Area", "Áreas", AREAS, item ? item.Area : [])}
          ${campoChecks("Rol", "Roles", ROLES, item ? item.Rol : [])}
          <div class="form-aviso">El teléfono tiene que ser exactamente el número de WhatsApp de la persona, con +549 adelante (ej: +5493547123456): con él se identifica al fichar entrada y salida.${item ? " Si cambiás el nombre, los fichajes anteriores quedan con el nombre viejo y no se suman a esta persona en Horas." : ""}</div>
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">${item ? "Guardar cambios" : "Agregar persona"}</button>
          ${item ? `<button type="button" class="btn-secundario" data-accion="cancelar-persona">Cancelar edición</button>` : ""}
        </div>
      </form>`;
  }

  async function guardarPersona(form) {
    const datos = {
      Nombre: form.querySelector('[name="Nombre"]').value.trim(),
      Telefono: normTel(form.querySelector('[name="Telefono"]').value),
      Categoria: form.querySelector('[name="Categoria"]').value,
      Area: [...form.querySelectorAll('[name="Area"]:checked')].map(i => i.value),
      Rol: [...form.querySelectorAll('[name="Rol"]:checked')].map(i => i.value),
      recibe_mensaje: form.querySelector('[name="recibe_mensaje"]').value === "true",
      recibe_errores: form.querySelector('[name="recibe_errores"]').value === "true"
    };
    if (datos.Telefono && !/^\+\d{10,15}$/.test(datos.Telefono)) {
      alert("El teléfono tiene que tener el formato +549 seguido del número, sin el 15 (ej: +5493547123456).");
      return;
    }
    const otros = personas.filter(p => p.id !== editPersonaId);
    const mismoNombre = otros.find(p => p.Nombre.trim().toLowerCase() === datos.Nombre.toLowerCase());
    if (mismoNombre) {
      alert(`Ya hay una persona llamada "${mismoNombre.Nombre}". Usá un nombre distinto (por ejemplo con el apellido): las horas se suman por nombre.`);
      return;
    }
    const mismoTel = datos.Telefono && otros.find(p => normTel(p.Telefono) === datos.Telefono);
    if (mismoTel) {
      alert(`El teléfono ${datos.Telefono} ya lo tiene "${mismoTel.Nombre}". Cada persona necesita su propio número para fichar.`);
      return;
    }
    const actual = editPersonaId ? personas.find(p => p.id === editPersonaId) : null;
    if (actual && actual.Nombre !== datos.Nombre) {
      if (!confirm(`Vas a cambiar el nombre de "${actual.Nombre}" a "${datos.Nombre}". Los fichajes anteriores quedan con el nombre viejo y no se van a sumar a esta persona en Horas. ¿Confirmás?`)) return;
    }
    if (!datos.Categoria && !confirm("La persona queda sin categoría: sus horas no van a tener tarifa. ¿Guardar igual?")) return;
    await enviar(form, editPersonaId ? "Guardando…" : "Agregando…", async () => {
      const res = editPersonaId
        ? await Api.configEditar("equipo", { ...datos, id: editPersonaId })
        : await Api.configCrear("equipo", datos);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar la persona.");
      editPersonaId = null;
    });
  }

  async function borrarPersona(id) {
    const p = personas.find(x => x.id === id);
    const nombre = p ? p.Nombre : "esta persona";
    if (!confirm(`¿Confirmás borrar a "${nombre}" del equipo? No va a poder fichar más ni recibir avisos. Sus fichajes anteriores no se borran.`)) return;
    try {
      const res = await Api.configBorrar("equipo", id);
      if (!res.ok) throw new Error(res.error || "No se pudo borrar la persona.");
      if (editPersonaId === id) editPersonaId = null;
      await cargar();
      renderTodo();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Común ----------

  async function enviar(form, textoEnviando, accion) {
    const btn = form.querySelector(".btn-crear-reserva");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = textoEnviando;
    try {
      await accion();
      await cargar();
      renderTodo();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }

  function renderTodo() {
    elContent().innerHTML = personasHtml() + categoriasHtml();
  }

  async function cargar() {
    const [resP, resC] = await Promise.all([Api.configListar("equipo"), Api.configListar("categorias")]);
    if (!resP.ok) throw new Error(resP.error || "No se pudo cargar el equipo.");
    if (!resC.ok) throw new Error(resC.error || "No se pudieron cargar las categorías.");
    personas = resP.items || [];
    categorias = resC.items || [];
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    editPersonaId = null;
    editCategoriaId = null;
    filtro = "";
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
