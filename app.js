//CONFIG
const API = "http://localhost:3000/api";

//ESTADO
let usuarioActual = null;
let fechaActual = new Date();
let eventosMes = {};
let editandoVehiculoId = null;
let clientesCache = [];
let repuestosCache = [];
let trabajoEnEdicion = { idVehiculo:null, items:[] };

//HELPERS
const $ = (s)=>document.querySelector(s);
const $all = (s)=>document.querySelectorAll(s);

const POST = (obj)=>({method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(obj)});
const PUT  = (obj)=>({method:"PUT",  headers:{"Content-Type":"application/json"}, body:JSON.stringify(obj)});

async function apiGET(u){ const r=await fetch(u); const d=await r.json().catch(()=>({})); return {httpOk:r.ok, ...d}; }
async function apiPOST(u,b){ const r=await fetch(u,POST(b)); const d=await r.json().catch(()=>({})); return {httpOk:r.ok, ...d}; }
async function apiPUT(u,b){ const r=await fetch(u,PUT(b)); const d=await r.json().catch(()=>({})); return {httpOk:r.ok, ...d}; }
async function apiDELETE(u){ const r=await fetch(u,{method:"DELETE"}); const d=await r.json().catch(()=>({})); return {httpOk:r.ok, ...d}; }

function parseIdFromDatalist(value, cache, prop="nombre"){
  if(!value) return null;
  if(/^\d+$/.test(value)) return Number(value);
  const m=value.match(/^(\d+)\s*-/); if(m) return Number(m[1]);
  const f = cache.find(c=> (c[prop]||"").toLowerCase()===value.toLowerCase());
  return f?.id ?? null;
}

/*LOGIN*/
$("#btn-ingresar").addEventListener("click", async ()=>{
  const usuario=$("#usuario").value.trim();
  const contrasenia=$("#contrasenia").value.trim();
  if(!usuario || !contrasenia) return $("#msj-login").textContent="Completá usuario y contraseña";
  const res=await apiPOST(`${API}/login`,{usuario, contrasena:contrasenia});
  if(!res.httpOk || !res.ok){ $("#msj-login").textContent=res.msg||"Error autenticando"; return; }
  usuarioActual=res.data;
  $("#inicio-sesion").classList.add("oculto");
  $("#app").classList.remove("oculto");
  $("#usuario-activo").textContent=usuarioActual.nombre;
  $("#usuario-rol").textContent=usuarioActual.rol;
  cambiarVista("calendario");
});
$("#btn-salir").onclick=()=>{ usuarioActual=null; $("#app").classList.add("oculto"); $("#inicio-sesion").classList.remove("oculto"); };

/*SIDEBAR*/
$("#btn-toggle-barra").onclick=()=> $("#barra").classList.toggle("colapsado");
$all(".item[data-vista]").forEach(b=> b.onclick=()=> cambiarVista(b.getAttribute("data-vista")));

function cambiarVista(v){
  $all(".vista").forEach(el=> el.classList.add("oculto"));
  $("#titulo-vista").textContent = {calendario:"Calendario", vehiculos:"Vehículos", repuestos:"Repuestos", facturacion:"Facturación", historial:"Historial"}[v] || "";
  $(`#vista-${v}`).classList.remove("oculto");
  if(v==="calendario") renderCalendario();
  if(v==="vehiculos")  cargarVehiculos();
  if(v==="repuestos")  cargarRepuestos();
  if(v==="facturacion"){ cargarFacturacion(); cargarTotalFacturado(); }
  if(v==="historial")  cargarHistorial();
}

/*CALENDARIO*/
$("#btn-mes-anterior").onclick=()=>{ fechaActual.setMonth(fechaActual.getMonth()-1); renderCalendario(); };
$("#btn-mes-siguiente").onclick=()=>{ fechaActual.setMonth(fechaActual.getMonth()+1); renderCalendario(); };

async function renderCalendario(){
  const anio=fechaActual.getFullYear(), mes=fechaActual.getMonth();
  $("#etiqueta-mes").textContent=fechaActual.toLocaleString("es-ES",{month:"long", year:"numeric"});
  try{
    const res=await apiGET(`${API}/eventos/${anio}/${mes+1}`);
    eventosMes={}; if(res.ok) (res.data||[]).forEach(e=> eventosMes[e.fecha]=e.texto);
  }catch{ eventosMes={}; }
  const g=$("#grilla-calendario"); g.innerHTML="";
  ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].forEach(d=>{ const c=document.createElement("div"); c.className="cab"; c.textContent=d; g.appendChild(c); });
  const first=new Date(anio,mes,1).getDay(), last=new Date(anio,mes+1,0).getDate();
  for(let i=0;i<first;i++) g.appendChild(document.createElement("div"));
  for(let d=1; d<=last; d++){
    const k=`${anio}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const cel=document.createElement("div");
    cel.className="dia"; cel.innerHTML=`<strong>${d}</strong><span>${eventosMes[k]||""}</span>`;
    cel.onclick=()=> abrirModalEvento(k, eventosMes[k]||"");
    g.appendChild(cel);
  }
}
function abrirModalEvento(fechaISO,texto){
  $("#texto-dia").textContent=fechaISO;
  $("#inp-evento").value=texto||"";
  const btnEliminar=$("#btn-eliminar-evento");
  btnEliminar.style.display = texto && texto.trim() ? "inline-block" : "none";

  $("#modal-evento").showModal();

  $("#btn-guardar-evento").onclick=async ()=>{
    const valor=$("#inp-evento").value.trim();
    const r=await apiPUT(`${API}/eventos`,{fecha:fechaISO, texto:valor});
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo guardar");
    $("#modal-evento").close(); renderCalendario();
  };
  $("#btn-eliminar-evento").onclick=async ()=>{
    const r=await apiPUT(`${API}/eventos`,{fecha:fechaISO, texto:""});
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo eliminar");
    $("#modal-evento").close(); renderCalendario();
  };
  $("#btn-cancelar-evento").onclick=()=> $("#modal-evento").close();
}

/*CLIENTES*/
async function cargarClientesDatalist(){
  const r=await apiGET(`${API}/clientes`);
  if(!r.httpOk || !r.ok) return;
  clientesCache=r.data||[];
  $("#dl-clientes").innerHTML=clientesCache.map(c=> `<option value="${c.id} - ${c.nombre}"></option>`).join("");
}
function abrirModalCliente(){
  const dlg=$("#modal-cliente");
  $("#cli-nombre").value=""; $("#cli-telefono").value=""; $("#cli-email").value="";
  $("#cli-cancelar").onclick=()=> dlg.close();
  $("#cli-guardar").onclick=async ()=>{
    const nombre=$("#cli-nombre").value.trim();
    const telefono=$("#cli-telefono").value.trim();
    const email=$("#cli-email").value.trim();
    if(!nombre) return alert("Ingresá el nombre");
    const r=await apiPOST(`${API}/clientes`,{nombre, telefono:telefono||null, email:email||null});
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo crear el cliente");
    await cargarClientesDatalist();
    $("#inp-idcliente").value=`${r.data.id} - ${nombre}`;
    dlg.close();
  };
  dlg.showModal();
}

/*REPUESTOS*/
async function cargarRepuestos(){
  const r=await apiGET(`${API}/repuestos`);
  repuestosCache=r.ok ? (r.data||[]) : [];
  $("#dl-repuestos").innerHTML = repuestosCache.map(x=> `<option value="${x.id} - ${x.nombre}"></option>`).join("");
  const tbody=$("#tabla-repuestos"); tbody.innerHTML="";
  if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo cargar");
  repuestosCache.forEach(x=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${x.nombre}</td><td>$ ${Number(x.precioLista||0).toFixed(2)}</td>
                  <td class="acc"><button class="btn" data-e="edit">Editar</button>
                  <button class="btn peligro" data-e="del">Borrar</button></td>`;
    tr.querySelector('[data-e="edit"]').onclick=()=> abrirModalRepuesto(x);
    tr.querySelector('[data-e="del"]').onclick=async ()=>{
      if(!confirm("¿Borrar repuesto?")) return;
      const rr=await apiDELETE(`${API}/repuestos/${x.id}`);
      if(!rr.httpOk || !rr.ok) return alert(rr.msg||"No se pudo borrar");
      cargarRepuestos();
    };
    tbody.appendChild(tr);
  });
}
$("#btn-agregar-repuesto").onclick=()=> abrirModalRepuesto();
function abrirModalRepuesto(rep=null){
  const dlg=$("#modal-repuesto");
  $("#rep-nombre").value = rep?.nombre||"";
  $("#rep-precio").value = rep?.precioLista||"";
  $("#rep-cancelar").onclick=()=> dlg.close();
  $("#rep-guardar").onclick=async ()=>{
    const nombre=$("#rep-nombre").value.trim();
    const precio=$("#rep-precio").value? Number($("#rep-precio").value): null;
    if(!nombre) return alert("Ingresá nombre");
    let r;
    if(rep?.id) r = await apiPUT(`${API}/repuestos/${rep.id}`, {nombre, precioLista:precio});
    else       r = await apiPOST(`${API}/repuestos`, {nombre, precioLista:precio});
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo guardar");
    dlg.close(); cargarRepuestos();
  };
  dlg.showModal();
}

/*VEHÍCULOS*/
$("#btn-agregar-vehiculo").onclick=()=> abrirModalVehiculo();
async function cargarVehiculos(){
  const r=await apiGET(`${API}/vehiculos`);
  const tbody=$("#tabla-vehiculos"); tbody.innerHTML="";
  if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo cargar la lista de vehículos");
  (r.data||[]).forEach(v=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${v.patente||""}</td>
      <td>${v.modelo||""}</td>
      <td>${v.preAnalisis ? v.preAnalisis.slice(0,60) : "—"}</td>
      <td class="acc">
        <button class="btn" data-a="trab">Trabajo</button>
        <button class="btn" data-a="edit">Editar</button>
        <button class="btn peligro" data-a="del">Eliminar</button>
      </td>`;
    tr.querySelector('[data-a="edit"]').onclick=()=> abrirModalVehiculo(v);
    tr.querySelector('[data-a="del"]').onclick = async()=> {
      if(!confirm("¿Eliminar vehículo?")) return;
      const rr=await apiDELETE(`${API}/vehiculos/${v.id}`);
      if(!rr.httpOk || !rr.ok) return alert(rr.msg||"No se pudo eliminar");
      cargarVehiculos();
    };
    tr.querySelector('[data-a="trab"]').onclick = ()=> abrirModalTrabajo(v);
    tbody.appendChild(tr);
  });
}
function abrirModalVehiculo(v=null){
  editandoVehiculoId = v?.id ?? null;
  $("#titulo-modal-vehiculo").textContent = editandoVehiculoId? "Editar vehículo" : "Nuevo vehículo";
  $("#inp-idvehiculo").value = v?.id ?? "";
  $("#inp-marca").value = v?.marca ?? "";
  $("#inp-modelo").value = v?.modelo ?? "";
  $("#inp-anio").value = v?.anio ?? "";
  $("#inp-patente").value = v?.patente ?? "";
  $("#inp-color").value = v?.color ?? "";
  $("#inp-fechaIngreso").value = v?.fechaIngreso ?? "";
  $("#inp-fechaEntrega").value = v?.fechaEntrega ?? "";
  $("#inp-idcliente").value  = v?.id_cliente ? `${v.id_cliente}` : "";
  $("#inp-preAnalisis").value= v?.preAnalisis ?? "";
  cargarClientesDatalist();
  $("#btn-nuevo-cliente").onclick=()=> abrirModalCliente();

  $("#modal-vehiculo").showModal();
  $("#btn-cancelar-vehiculo").onclick=()=> $("#modal-vehiculo").close();
  $("#btn-guardar-vehiculo").onclick=async ()=>{
    const payload = {
      marca: $("#inp-marca").value.trim()||null,
      modelo: $("#inp-modelo").value.trim(),
      anio: $("#inp-anio").value? Number($("#inp-anio").value): null,
      patente: $("#inp-patente").value.trim(),
      color: $("#inp-color").value.trim()||null,
      fechaIngreso: $("#inp-fechaIngreso").value||null,
      fechaEntrega: $("#inp-fechaEntrega").value||null,
      preAnalisis: $("#inp-preAnalisis").value.trim()||null,
      id_cliente: parseIdFromDatalist($("#inp-idcliente").value.trim(), clientesCache, "nombre")
    };
    if(!payload.patente || !payload.modelo) return alert("Completá patente y modelo");
    let r;
    if(editandoVehiculoId) r=await apiPUT(`${API}/vehiculos/${editandoVehiculoId}`, payload);
    else                   r=await apiPOST(`${API}/vehiculos`, payload);
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo guardar");
    $("#modal-vehiculo").close(); cargarVehiculos();
  };
}

/*TRABAJO*/
async function abrirModalTrabajo(v){
  trabajoEnEdicion = { idVehiculo: v.id, items:[] };
  $("#trab-desc").value = "";
  $("#trab-mano").value = "";
  $("#tabla-trabajo-items").innerHTML = "";
  $("#modal-trabajo").showModal();

  await cargarRepuestos();

  $("#btn-add-tr-item").onclick = ()=>{
    $("#tr-rep").value=""; $("#tr-cant").value=""; $("#tr-precio").value="";
    $("#modal-tr-item").showModal();
  };
  $("#tr-cancelar").onclick=()=> $("#modal-tr-item").close();
  $("#tr-aceptar").onclick=()=>{
    const id = parseIdFromDatalist($("#tr-rep").value.trim(), repuestosCache, "nombre");
    const cant = Number($("#tr-cant").value||0);
    let precio = $("#tr-precio").value? Number($("#tr-precio").value): null;
    if(!precio){
      const rep = repuestosCache.find(x=> x.id===id);
      precio = rep ? Number(rep.precioLista||0) : 0;
    }
    if(!id || !cant) return alert("Elegí repuesto y cantidad");
    const rep = repuestosCache.find(x=> x.id===id);
    trabajoEnEdicion.items.push({ idRepuesto:id, nombre:rep?.nombre||id, cantidad:cant, precioUnitario:precio });
    renderItemsTrabajo();
    $("#modal-tr-item").close();
  };

  $("#trab-cancelar").onclick=()=> $("#modal-trabajo").close();
  $("#trab-guardar").onclick=async ()=>{
    const descripcion = $("#trab-desc").value.trim() || "Trabajo";
    const manoObra = $("#trab-mano").value? Number($("#trab-mano").value): 0;

    const r = await apiPOST(`${API}/trabajos`, {
      idVehiculo: trabajoEnEdicion.idVehiculo,
      descripcion,
      costoMO: manoObra,
      repuestos: trabajoEnEdicion.items
    });
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo crear el trabajo");
    alert("Trabajo guardado y agregado a la factura");
    $("#modal-trabajo").close();
  };
}
function renderItemsTrabajo(){
  const tb=$("#tabla-trabajo-items"); tb.innerHTML="";
  trabajoEnEdicion.items.forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${it.nombre}</td><td>${it.cantidad}</td><td>${Number(it.precioUnitario).toFixed(2)}</td>
                  <td class="acc"><button class="btn peligro" data-i="${idx}">Quitar</button></td>`;
    tr.querySelector("button").onclick=()=>{ trabajoEnEdicion.items.splice(idx,1); renderItemsTrabajo(); };
    tb.appendChild(tr);
  });
}

/*FACTURACIÓN*/
async function cargarTotalFacturado(){
  const r=await apiGET(`${API}/facturacion/total`);
  $("#total-facturado").textContent = "$ " + Number(r?.data?.total||0).toLocaleString("es-AR");
}
async function cargarFacturacion(){
  const r=await apiGET(`${API}/facturacion/vehiculos`);
  const tbody=$("#tabla-facturacion"); tbody.innerHTML="";
  if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo cargar");
  (r.data||[]).forEach(v=>{
    const tr=document.createElement("tr");
    const estadoFactura = v.tieneFactura ? (v.estadoFactura==='pagada' ? `Pagada (#${v.idFactura})` : `Emitida (#${v.idFactura})`) : "—";
    tr.innerHTML = `
      <td>${v.patente||""}</td><td>${v.modelo||""}</td><td>${v.cliente||"—"}</td>
      <td>${estadoFactura}</td>
      <td class="acc">
        ${v.tieneFactura ? `<button class="btn" data-a="pdf">Ver PDF</button>` : ""}
        ${v.tieneFactura ? `<button class="btn ok" data-a="pagar">Pagos</button>` : ""}
        ${v.tieneFactura ? `
          <button class="btn ok" data-a="terminar" ${v.estadoFactura==='pagada'?'':'disabled title="Requiere factura pagada"'}>Marcar terminado</button>
        ` : ""}
      </td>`;
    tr.querySelector('[data-a="pdf"]')?.addEventListener("click", ()=> window.open(`${API}/facturas/${v.idFactura}/pdf`, "_blank"));
    tr.querySelector('[data-a="pagar"]')?.addEventListener("click", ()=> abrirModalPagos(v.idFactura));
    tr.querySelector('[data-a="terminar"]')?.addEventListener("click", ()=> marcarTerminado(v.idFactura));
    tbody.appendChild(tr);
  });
}
async function abrirModalPagos(idFactura){
  const dlg=$("#modal-factura");
  async function load(){
    const r=await apiGET(`${API}/facturas/${idFactura}/pagos`);
    const tb=$("#tabla-pagos"); tb.innerHTML="";
    if(r.ok) (r.data||[]).forEach(p=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${p.fecha}</td><td>$ ${Number(p.monto).toFixed(2)}</td><td>${p.medio||"—"}</td>`;
      tb.appendChild(tr);
    });
  }
  $("#btn-add-pago").onclick=async ()=>{
    const fecha = prompt("Fecha (YYYY-MM-DD)", new Date().toISOString().slice(0,10)) || null;
    const monto = Number(prompt("Monto", "0")||0);
    const medio = prompt("Medio (efectivo, transferencia...)", "") || null;
    if(!fecha || !monto || !medio) return;
    const r=await apiPOST(`${API}/facturas/${idFactura}/pagos`, {fecha, monto, medio});
    if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo registrar el pago");
    await load(); cargarTotalFacturado(); cargarFacturacion();
  };
  $("#fac-cerrar").onclick=()=> dlg.close();
  await load(); dlg.showModal();
}

//TERMINADO
async function marcarTerminado(idFactura){
  const r = await apiPOST(`${API}/facturas/${idFactura}/terminar`, {});
  if(!r.httpOk || !r.ok){
    alert(r.msg || "No se pudo marcar como terminado");
    return;
  }
  alert("Vehículo marcado como terminado. Se agregó al Historial.");
  try { await cargarHistorial(); } catch {}
  try { await cargarFacturacion(); } catch {}
}

/*HISTORIAL*/
async function cargarHistorial(){
  const r=await apiGET(`${API}/historial`);
  const ul=$("#lista-historial"); ul.innerHTML="";
  if(!r.httpOk || !r.ok) return alert(r.msg||"No se pudo cargar historial");
  (r.data||[]).forEach(it=>{
    const li=document.createElement("li");
    li.textContent=`${it.fecha} - ${it.patente}: ${it.descripcion}`;
    ul.appendChild(li);
  });
}

/*REGISTRO*/
(function initRegistro(){
  const dlg = $("#modal-registro");
  const abrir = $("#btn-abrir-registro");
  const cancelar = $("#reg-cancelar");
  const guardar = $("#reg-guardar");

  if(!abrir || !dlg) return;

  abrir.onclick = ()=> {
    $("#reg-nombre").value="";
    $("#reg-usuario").value="";
    $("#reg-pass1").value="";
    $("#reg-pass2").value="";
    $("#reg-rol").value="empleado";
    dlg.showModal();
  };

  cancelar.onclick = ()=> dlg.close();

  guardar.onclick = async ()=> {
    const nombre = $("#reg-nombre").value.trim();
    const usuario = $("#reg-usuario").value.trim();
    const pass1 = $("#reg-pass1").value;
    const pass2 = $("#reg-pass2").value;
    const rol = ($("#reg-rol").value||"").toLowerCase();

    if(!nombre || !usuario || !pass1 || !pass2)
      return alert("Completá todos los campos");

    if(pass1 !== pass2)
      return alert("Las contraseñas no coinciden");

    if(!["dueño","empleado"].includes(rol))
      return alert("Rol inválido");

    const r = await apiPOST(`${API}/usuarios/registrar`, {
      nombre, usuario, contrasena: pass1, rol
    });

    if(!r.httpOk || !r.ok) return alert(r.msg || "No se pudo crear la cuenta");

    dlg.close();
    $("#usuario").value = usuario;
    $("#contrasenia").value = pass1;
    $("#msj-login").textContent = "Cuenta creada. Podés ingresar con tus credenciales.";
  };
})();
