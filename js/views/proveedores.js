const ViewProveedores = (() => {
  const elEstado = () => document.getElementById("proveedores-estado");
  const elContent = () => document.getElementById("proveedores-content");

  const NEGOCIOS = ["Gran Vadori", "Villa Vadori Suites"];

  let listenersAttached = false;
  let items = [];
  let editId = null;
  let filtro = "";

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    elContent().addEventListener("input", (ev) => {
      if (ev.target.id !== "proveedores-filtro") return;
      filtro = ev.target.value.trim().toLowerCase();
      renderTodo();
    });

    elContent().addEventListener("submit", async (ev) => {
      const form = ev.target.closest("#proveedores-form");
      if (!form) return;
      ev.preventDefault();
      await handleSubmit(form);
    });

    elContent().addEventListener("click", async (ev) => {
      const btnEditar = ev.target.closest(".prov-btn-editar");
      if (btnEditar) {
        editId = btnEditar.dataset.id;
        renderTodo();
        document.getElementById("proveedores-form").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const btnCancelar = ev.target.closest(".prov-btn-cancelar");
      if (btnCancelar) {
        editId = null;
        renderTodo();
        return;
      }
      const btnBorrar = ev.target.closest(".prov-btn-borrar");
      if (btnBorrar) {
        await handleBorrar(btnBorrar.dataset.id);
        return;
      }
    });
  }

  function campoTexto(id, name, label, valor, opts = {}) {
    const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
    return `
      <div class="form-field">
        <label for="${id}">${label}${opts.required ? " *" : ""}</label>
        <input type="${opts.type || "text"}" id="${id}" name="${name}" value="${val}" ${opts.step ? `step="${opts.step}"` : ""} ${opts.required ? "required" : ""}>
      </div>`;
  }

  function campoSelect(id, name, label, valor) {
    const val = valor || "";
    const opts = [""].concat(NEGOCIOS);
    return `
      <div class="form-field">
        <label for="${id}">${label}</label>
        <select id="${id}" name="${name}">
          ${opts.map(o => `<option value="${Utils.escapeHtml(o)}"${o === val ? " selected" : ""}>${o === "" ? "" : Utils.escapeHtml(o)}</option>`).join("")}
        </select>
      </div>`;
  }

  function campoTextarea(id, name, label, valor) {
    const val = valor !== undefined && valor !== null ? Utils.escapeHtml(valor) : "";
    return `
      <div class="form-field form-field-wide">
        <label for="${id}">${label}</label>
        <textarea id="${id}" name="${name}">${val}</textarea>
      </div>`;
  }

  function formHtml(item) {
    const editando = !!item;
    return `
      <form id="proveedores-form" class="reserva-form">
        <div class="form-row">
          ${campoTexto("prov-nombre", "Nombre", "Nombre", item ? item.Nombre : "", { required: true })}
          ${campoTexto("prov-alias", "alias", "Alias", item ? item.alias : "")}
          ${campoTexto("prov-plazo", "Plazo_pago_dias", "Plazo de pago (días)", item ? item.Plazo_pago_dias : "", { type: "number", step: "1" })}
          ${campoSelect("prov-negocio", "Negocio_habitual", "Negocio habitual", item ? item.Negocio_habitual : "")}
          ${campoTextarea("prov-notas", "Notas", "Notas", item ? item.Notas : "")}
        </div>
        <div class="reserva-buscar-fila">
          <button type="submit" class="btn-crear-reserva">${editando ? "Guardar cambios" : "Agregar proveedor"}</button>
          ${editando ? `<button type="button" class="btn-secundario prov-btn-cancelar">Cancelar edición</button>` : ""}
        </div>
      </form>`;
  }

  function filaResumen(item) {
    const titulo = item.alias ? `${item.Nombre || "(sin nombre)"} (${item.alias})` : (item.Nombre || "(sin nombre)");
    const subPartes = [];
    if (item.Negocio_habitual) subPartes.push(item.Negocio_habitual);
    if (item.Plazo_pago_dias !== undefined) subPartes.push(`Pago a ${item.Plazo_pago_dias} días`);
    if (item.Notas) subPartes.push(item.Notas);
    return { titulo, sub: subPartes.join(" · ") };
  }

  function itemsFiltrados() {
    if (!filtro) return items;
    return items.filter(i => {
      const texto = `${i.Nombre || ""} ${i.alias || ""}`.toLowerCase();
      return texto.includes(filtro);
    });
  }

  function listaHtml() {
    const filtrados = itemsFiltrados();
    if (!filtrados.length) return `<div class="empty-msg">Sin proveedores que coincidan.</div>`;
    return filtrados.map(item => {
      const { titulo, sub } = filaResumen(item);
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-main">
              <div class="card-title">${Utils.escapeHtml(titulo)}</div>
              ${sub ? `<div class="card-sub">${Utils.escapeHtml(sub)}</div>` : ""}
            </div>
          </div>
          <div class="card-asignar">
            <button type="button" class="btn-secundario prov-btn-editar" data-id="${Utils.escapeHtml(item.id)}">Editar</button>
            <button type="button" class="btn-peligro prov-btn-borrar" data-id="${Utils.escapeHtml(item.id)}">Borrar</button>
          </div>
        </div>`;
    }).join("");
  }

  function renderTodo() {
    const item = editId ? items.find(i => i.id === editId) : null;
    elContent().innerHTML = `
      <div class="section-title">Proveedores · ${items.length}</div>
      <div class="form-field">
        <label for="proveedores-filtro">Buscar por nombre o alias</label>
        <input type="text" id="proveedores-filtro" placeholder="Ej: Frutty" value="${Utils.escapeHtml(filtro)}">
      </div>
      <div class="config-lista">${listaHtml()}</div>
      ${formHtml(item)}`;
  }

  async function cargarProveedores() {
    const res = await Api.configListar("proveedores");
    if (!res.ok) throw new Error(res.error || "No se pudo cargar proveedores.");
    items = (res.items || []).filter(i => i.Nombre);
  }

  function leerFormulario(form) {
    const out = {};
    const nombre = form.querySelector('[name="Nombre"]').value.trim();
    if (nombre) out.Nombre = nombre;
    const alias = form.querySelector('[name="alias"]').value.trim();
    if (alias) out.alias = alias;
    const plazo = form.querySelector('[name="Plazo_pago_dias"]').value.trim();
    if (plazo !== "") {
      const n = Number(plazo);
      if (!Number.isNaN(n)) out.Plazo_pago_dias = n;
    }
    const negocio = form.querySelector('[name="Negocio_habitual"]').value;
    if (negocio) out.Negocio_habitual = negocio;
    const notas = form.querySelector('[name="Notas"]').value.trim();
    if (notas) out.Notas = notas;
    return out;
  }

  async function handleSubmit(form) {
    const datos = leerFormulario(form);
    const btn = form.querySelector(".btn-crear-reserva");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = editId ? "Guardando…" : "Agregando…";
    try {
      const res = editId
        ? await Api.configEditar("proveedores", { ...datos, id: editId })
        : await Api.configCrear("proveedores", datos);
      if (!res.ok) throw new Error(res.error || "No se pudo guardar el proveedor.");
      editId = null;
      await cargarProveedores();
      renderTodo();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }

  async function handleBorrar(id) {
    const item = items.find(i => i.id === id);
    const nombre = item ? (item.Nombre || "este proveedor") : "este proveedor";
    if (!confirm(`¿Confirmás borrar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await Api.configBorrar("proveedores", id);
      if (!res.ok) throw new Error(res.error || "No se pudo borrar el proveedor.");
      if (editId === id) editId = null;
      await cargarProveedores();
      renderTodo();
    } catch (err) {
      alert(err.message);
    }
  }

  async function render() {
    attachListeners();
    elEstado().textContent = "Cargando…";
    elEstado().classList.remove("error");
    editId = null;
    filtro = "";
    try {
      await cargarProveedores();
      elEstado().textContent = "";
      renderTodo();
    } catch (err) {
      elEstado().textContent = err.message;
      elEstado().classList.add("error");
    }
  }

  return { render };
})();
