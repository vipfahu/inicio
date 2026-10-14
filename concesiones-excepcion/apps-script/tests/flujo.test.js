// Prueba de punta a punta con el simulador: instalación, migración, recepción, tramitación, correos, archivos y permisos.
// Datos sintéticos que imitan los problemas reales de la planilla (folio como fecha, folio duplicado, sin folio,
// tres columnas de estado en conflicto, «En trámite», tipos en texto libre).
const test = require('node:test');
const assert = require('node:assert/strict');
const { fila, preparar, instalar } = require('./escenario');

const tabla = (env, n) => {
  const h = env.libro.getSheetByName(n);
  const [enc, ...filas] = h.getDataRange().getValues();
  return filas.filter(f => f.some(x => x !== '')).map(f => Object.fromEntries(enc.map((k, j) => [k, f[j]])));
};

test('instalación y migración', () => {
  const env = instalar(preparar());
  const s = tabla(env, 'Solicitudes');
  assert.equal(s.length, 6);
  assert.deepEqual(s.map(x => x.folio), ['01/2026', '02/2026', '03/2026', '05/2026', '04/2026', '06/2026']);
  assert.deepEqual(s.map(x => x.estado), ['resuelto', 'no_procede', 'aceptada', 'programa', 'rechazada', 'recibida']);
  assert.deepEqual(s.map(x => x.revisar), ['', '', 'SÍ', 'SÍ', 'SÍ', 'SÍ']);
  assert.equal(s[0].analista, 'analista.uno@usach.cl');
  assert.equal(s[3].semestre, 'Semestre I');
  assert.equal(s[2].tipo_texto_libre, 'Matrícula fuera de plazo');
  // Folio canónico escrito en la columna A de las respuestas
  assert.equal(env.hoja.datos[1][0], '01/2026');
  assert.equal(env.hoja.datos[4][0], '05/2026');
  // Notas antiguas separadas en la bitácora
  const b = tabla(env, 'Bitácora').filter(x => x.folio === '01/2026' && x.tipo === 'nota');
  assert.equal(b.length, 2);
  // Columnas antiguas ocultas (desde «Estado de Presentación»)
  assert.ok(env.hoja.ocultas.includes(16));
  // Disparadores y atajo al adjunto del Formulario
  assert.deepEqual(env.estado.triggers.map(t => t.getHandlerFunction()).sort(), ['alRecibirFormulario', 'tareaDiaria']);
  assert.ok(Object.values(env.estado.carpetas).some(c => c.atajos.includes('adjFormularioUno1234')));
  assert.equal(env.estado.correos.length, 0, 'la migración no debe enviar correos');
});

test('paso 2 exige correos en Cuentas', () => {
  const env = preparar();
  env.estado.usuario = env.estado.duenia;
  env.ctx.instalarPaso1();
  assert.throws(() => env.ctx.instalarPaso2(), /Faltan correos/);
});

test('la instalación solo la ejecuta la cuenta dueña', () => {
  const env = preparar();
  env.estado.usuario = 'intruso@usach.cl';
  assert.throws(() => env.ctx.instalarPaso1(), /cuenta dueña/);
});

test('recepción desde el formulario: folio, analista, correos automáticos', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  hoja.appendRow(fila('', new Date(2026, 9, 7), 7, ['', '', ''], { programa: 'Magíster en Prueba A', analista: '' }).slice(0, 15));
  const r = hoja.getLastRow();
  estado.usuario = '';
  ctx.alRecibirFormulario({ range: hoja.getRange(r, 1) });
  const s = tabla(env, 'Solicitudes').pop();
  assert.equal(s.folio, '07/2026');
  assert.equal(s.estado, 'recibida');
  assert.equal(s.analista, 'analista.uno@usach.cl');
  assert.equal(estado.correos.length, 3);
  assert.equal(estado.correos[0].to, 'est7@usach.cl');
  assert.match(estado.correos[0].subject, /07\/2026/);
  assert.match(estado.correos[0].body, /\?v=seguimiento/);
  assert.equal(estado.correos[0].replyTo, 'analista.uno@usach.cl');
  // Aviso al equipo: Vicedecano/a + todas las analistas con cuenta activa
  assert.match(estado.correos[1].subject, /Nueva solicitud CAE · 07\/2026/);
  assert.equal(estado.correos[1].to, 'analista.uno@usach.cl,vice@usach.cl,consulta@usach.cl', 'todas las cuentas con acceso al panel; no Registro Curricular (sin acceso)');
  assert.match(estado.correos[1].body, /Analista: Analista Uno/);
  // Aviso de asignación a la analista asignada
  assert.equal(estado.correos[2].to, 'analista.uno@usach.cl');
  assert.match(estado.correos[2].subject, /asignada/);
  // Idempotente: la misma fila no se procesa dos veces
  ctx.alRecibirFormulario({ range: hoja.getRange(r, 1) });
  assert.equal(tabla(env, 'Solicitudes').length, 7);
  // Desde el panel no se puede invocar (no hay objeto Range)
  assert.throws(() => ctx.alRecibirFormulario({ range: { row: 2 } }), /inválida/);
});

test('permisos: sin cuenta, consulta, edición', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'desconocido@usach.cl';
  assert.equal(ctx.api_inicio().acceso, false);
  assert.throws(() => ctx.api_bandeja(), /SIN_ACCESO/);
  estado.usuario = '';
  assert.throws(() => ctx.api_bandeja(), /SIN_IDENTIDAD/);
  estado.usuario = 'consulta@usach.cl';
  assert.equal(ctx.api_bandeja().length, 6);
  const e = ctx.api_expediente('01/2026');
  assert.equal(e.verDetalle, false);
  assert.equal(e.fundamentacion, undefined);
  assert.equal(e.run, '');
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'revision', {}), /SIN_ACCESO/);
  assert.throws(() => ctx.api_cuentas(), /SIN_ACCESO/);
  estado.usuario = 'analista.uno@usach.cl';
  const e2 = ctx.api_expediente('01/2026');
  assert.equal(e2.verDetalle, true);
  assert.match(e2.fundamentacion, /confidencial/);
  assert.throws(() => ctx.api_cuentas(), /SIN_ACCESO/);
});

test('tramitación: vista previa, campos obligatorios, envío y orden seguro', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'resuelto', {}), /cambió de estado|no permitida/);
  // recibida → revisión: sin correo
  assert.equal(ctx.api_cambiarEstado('06/2026', 'revision', {}).conCorreo, false);
  // revisión → rechazada exige motivo
  const pv = ctx.api_previsualizar('06/2026', 'rechazada', {});
  assert.deepEqual([...pv.requeridos], ['motivo']);
  assert.equal(pv.correo.para[0], 'est6@usach.cl');
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'rechazada', { campos: {} }), /motivo/);
  // si el correo falla, el estado no cambia
  estado.fallaCorreo = true;
  assert.throws(() => ctx.api_cambiarEstado('06/2026', 'rechazada', { campos: { motivo: 'Fuera de plazo' } }), /Fallo simulado/);
  assert.equal(tabla(env, 'Solicitudes').find(s => s.folio === '06/2026').estado, 'revision');
  estado.fallaCorreo = false;
  // texto editado por la analista queda registrado
  const c = ctx.api_previsualizar('06/2026', 'rechazada', { motivo: 'Fuera de plazo' }).correo;
  ctx.api_cambiarEstado('06/2026', 'rechazada', { campos: { motivo: 'Fuera de plazo' }, asunto: c.asunto, cuerpo: c.cuerpo + '\nPD: editado' });
  const m = estado.correos.pop();
  assert.match(m.body, /Motivo: Fuera de plazo/);
  assert.match(m.body, /PD: editado/);
  assert.match(m.cc, /dir\d+@usach\.cl/);
  const ultima = tabla(env, 'Bitácora').pop();
  assert.equal(ultima.estado_nuevo, 'rechazada');
  assert.equal(ultima.editado, 'SÍ');
  // devolver al programa (vía STD) desde el V°B°: sin correo, pero exige y guarda la observación
  const s = tabla(env, 'Solicitudes').find(x => x.folio === '05/2026');
  assert.equal(s.estado, 'programa');
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger con condiciones' } });
  assert.match(estado.correos.pop().to, /vice@usach\.cl/);
  estado.usuario = 'vice@usach.cl'; // el V°B° (también la devolución) lo registra el Vicedecano/a
  const pvDev = ctx.api_previsualizar('05/2026', 'programa', {});
  assert.equal(pvDev.conCorreo, false);
  assert.deepEqual([...pvDev.requeridos], ['observacion']);
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'programa', { campos: {} }), /observacion/);
  const enviados = estado.correos.length;
  assert.equal(ctx.api_cambiarEstado('05/2026', 'programa', { campos: { observacion: 'Precisar condiciones' } }).conCorreo, false);
  assert.equal(estado.correos.length, enviados, 'la devolución va por STD: no sale correo');
  const s2 = tabla(env, 'Solicitudes').find(x => x.folio === '05/2026');
  assert.equal(s2.estado, 'programa');
  assert.equal(s2.obs_vicedecano, 'Precisar condiciones');
  assert.match(tabla(env, 'Bitácora').pop().texto, /Observación: Precisar condiciones/);
});

test('informe → programa: la analista registra la solicitud vía STD, sin correo, y el estudiante la ve', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  // Sin N° STD registrado no se pasa a Informe de Registro Curricular.
  assert.throws(() => ctx.api_cambiarEstado('03/2026', 'informe_rc', {}), /registre el N° STD/);
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '03/2026').estado, 'aceptada');
  ctx.api_guardarGestion('03/2026', { n_std: 'STD-2026-0099' });
  const r = ctx.api_cambiarEstado('03/2026', 'informe_rc', {});
  // Antes de Informe RC se genera el PDF del formulario y queda en el expediente, ofrecido para descarga.
  assert.match(r.pdfSolicitud.nombre, /^Solicitud CAE 03-2026 \(formulario\)\.pdf$/);
  const fpdf = ctx.api_expediente('03/2026').archivos.find(a => a.id === r.pdfSolicitud.id);
  assert.equal(fpdf.categoria, 'Formulario de solicitud (PDF)');
  const html = estado.pdfs[estado.pdfs.length - 1];
  assert.match(html, /Solicitud de Concesión Académica de Excepción/);
  assert.match(html, /Folio<\/th><td>03\/2026/);
  assert.match(html, /IV\. Fundamentación/);
  assert.match(html, /generado el .* por analista\.uno@usach\.cl/);
  assert.ok(tabla(env, 'Bitácora').some(b => b.folio === '03/2026' && /PDF del formulario de solicitud generado \(automático/.test(b.texto)));
  const pv = ctx.api_previsualizar('03/2026', 'programa', {});
  assert.equal(pv.conCorreo, false);
  assert.match(pv.haciaEtiqueta, /vía STD/);
  const antes = estado.correos.length;
  assert.equal(ctx.api_cambiarEstado('03/2026', 'programa', {}).conCorreo, false);
  assert.equal(estado.correos.length, antes, 'no se notifica a nadie');
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '03/2026').estado, 'programa');
  const b = tabla(env, 'Bitácora').pop();
  assert.equal(b.estado_nuevo, 'programa');
  assert.equal(b.evento, '');
});

test('resolución: CAE admisible y CAE rechazada notifican al estudiante; el cierre no envía correo', () => {
  for (const [folio, hacia, etiqueta, frase] of [['05/2026', 'resolucion', /CAE admisible/, /ha sido declarada admisible/], ['05/2026', 'rechazo_vb', /CAE rechazada/, /no ha sido acogida/]]) {
    const env = instalar(preparar());
    const { ctx, estado } = env;
    estado.usuario = 'analista.uno@usach.cl';
    ctx.api_cambiarEstado(folio, 'vb', { campos: { propuesta_comite: 'Propuesta' } });
    estado.usuario = 'vice@usach.cl';
    if (hacia === 'resolucion') {
      // V°B° CAE admisible: primero se registra la notificación a Registro Curricular, sin correo al estudiante.
      const previo0 = estado.correos.length;
      ctx.api_cambiarEstado(folio, 'aviso_rc', {});
      estado.usuario = 'analista.uno@usach.cl';
      assert.throws(() => ctx.api_cambiarEstado(folio, 'resolucion', {}), /cambió de estado|no permitida/, 'no se avisa al estudiante antes de notificar a RC');
      assert.throws(() => ctx.api_cambiarEstado(folio, 'rc_notificado', {}), /Falta completar/);
      ctx.api_cambiarEstado(folio, 'rc_notificado', { campos: { notificacion_rc: 'STD 2026-123 del 12-10-2026' } });
      assert.equal(estado.correos.length, previo0, 'notificar a RC no envía correo al estudiante');
      assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === folio).notificacion_rc, 'STD 2026-123 del 12-10-2026');
      assert.ok(tabla(env, 'Bitácora').some(b => /Notificación a Registro Curricular: STD 2026-123/.test(b.texto)));
    }
    const pv = ctx.api_previsualizar(folio, hacia, {});
    assert.equal(pv.conCorreo, true);
    assert.deepEqual([...pv.requeridos], []);
    assert.match(pv.haciaEtiqueta, etiqueta);
    assert.match(pv.haciaEtiqueta, /resolución en tramitación/);
    const previo = estado.correos.length;
    ctx.api_cambiarEstado(folio, hacia, {});
    const enviados = estado.correos.slice(previo);
    assert.equal(enviados.length, 1, 'un correo, solo al estudiante (no a Registro Curricular)');
    assert.equal(enviados[0].to, 'est4@usach.cl');
    assert.match(enviados[0].subject, etiqueta);
    assert.match(enviados[0].body, frase);
    assert.match(enviados[0].body, /resolución correspondiente se encuentra en elaboración, para su distribución desde la Unidad de Registro Curricular/);
    const antes = estado.correos.length;
    // El estudiante ve el nuevo estado en su seguimiento
    estado.usuario = 'est4@usach.cl';
    const mis = ctx.api_misSolicitudes().solicitudes.find(x => x.folio === folio);
    assert.equal(mis.estado, hacia);
    assert.ok(mis.hitos.some(h => h.estado === hacia));
    // Ve todos los pasos de su ruta, con el actual marcado
    assert.equal(mis.ruta.filter(p => p.situacion === 'actual').map(p => p.id)[0], hacia);
    assert.equal(mis.ruta[mis.ruta.length - 1].id, hacia === 'resolucion' ? 'resuelto' : 'negado');
    // Cierre: sin correo y sin campos obligatorios; comentario opcional que queda en la bitácora
    estado.usuario = 'analista.uno@usach.cl';
    const pvc = ctx.api_previsualizar(folio, 'negado', {});
    assert.equal(pvc.conCorreo, false);
    assert.deepEqual([...pvc.requeridos], []);
    // Se puede cargar el archivo de la resolución (categoría «Resolución») antes de cerrar
    ctx.api_subirArchivo(folio, 'resolucion.pdf', 'application/pdf', Buffer.from('%PDF').toString('base64'), 'resolucion');
    ctx.api_cambiarEstado(folio, 'negado', { campos: { comentario: 'Enviada a Registro Curricular por STD' } });
    assert.ok(ctx.api_expediente(folio).archivos.some(a => a.nombre === 'resolucion.pdf' && a.categoria === 'Resolución'));
    assert.equal(estado.correos.length, antes);
    assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === folio).estado, 'negado');
    assert.ok(tabla(env, 'Bitácora').some(b => b.folio === folio && /Comentario: Enviada a Registro Curricular por STD/.test(b.texto)));
  }
});

test('archivos: subida con límite, adjunto en correo, descarga o acceso puntual', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  const b64 = Buffer.alloc(1024, 1).toString('base64');
  ctx.api_subirArchivo('03/2026', 'informe.pdf', 'application/pdf', b64, 'informe_academico');
  assert.throws(() => ctx.api_subirArchivo('03/2026', 'x.pdf', 'application/pdf', Buffer.alloc(21 * 1048576).toString('base64'), 'otro'), /máximo es 20/);
  assert.throws(() => ctx.api_subirArchivo('03/2026', 'x.pdf', 'application/pdf', b64, 'antecedentes_formulario'), /Categoría/);
  const exp = ctx.api_expediente('03/2026');
  assert.equal(exp.archivos.length, 1);
  assert.throws(() => ctx.api_subirArchivo('03/2026', 'x.pdf', 'application/pdf', b64, 'formulario_solicitud'), /Categoría/, 'ese PDF lo genera la plataforma');
  ctx.api_guardarGestion('03/2026', { n_std: 'STD-1' });
  ctx.api_cambiarEstado('03/2026', 'informe_rc', {});
  ctx.api_cambiarEstado('03/2026', 'programa', {});
  ctx.api_cambiarEstado('03/2026', 'vb', { campos: { propuesta_comite: 'Acoger' }, adjuntos: [exp.archivos[0].id, 'idAjeno'] });
  const m = estado.correos.pop();
  assert.equal(m.attachments.length, 1, 'solo se adjuntan archivos del propio expediente');
  // Antecedentes del Formulario de 90 MB: acceso de lectura puntual, registrado
  const grande = ctx.api_expediente('01/2026').archivos.find(a => /antecedentes/.test(a.nombre));
  const r = ctx.api_descargarArchivo('01/2026', grande.id);
  assert.equal(r.modo, 'enlace');
  assert.deepEqual(estado.archivos.adjFormularioUno1234.viewers, ['analista.uno@usach.cl']);
  assert.throws(() => ctx.api_descargarArchivo('03/2026', grande.id), /no pertenece/);
});

test('cuentas: crear, editar, desactivar con efecto inmediato y salvaguardas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'Nueva@usach.cl', nombre: 'Nueva Analista', rol: 'Analista', nivel: 'edicion', programas: 'Magíster en Prueba A', activo: 'SÍ', recibe_eventos: 'asignacion' }, true);
  assert.throws(() => ctx.api_guardarCuenta({ correo: 'x@gmail.com', nombre: 'X', rol: 'Analista', nivel: 'edicion', activo: 'SÍ' }, true), /usach/);
  assert.throws(() => ctx.api_guardarCuenta({ correo: 'vice@usach.cl', nombre: 'Vice Decano', rol: 'Vicedecano/a', nivel: 'edicion', activo: 'SÍ' }, false), /al menos una/);
  estado.usuario = 'nueva@usach.cl';
  assert.equal(ctx.api_bandeja().length, 6);
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'nueva@usach.cl', nombre: 'Nueva Analista', rol: 'Analista', nivel: 'edicion', programas: 'Otro programa', activo: 'SÍ' }, false);
  estado.usuario = 'nueva@usach.cl';
  assert.equal(ctx.api_bandeja().length, 0, 'el alcance por programa rige en la siguiente llamada');
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'nueva@usach.cl', nombre: 'Nueva Analista', rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'NO' }, false);
  estado.usuario = 'nueva@usach.cl';
  assert.throws(() => ctx.api_bandeja(), /SIN_ACCESO/);
  const reg = tabla(env, 'Bitácora').filter(b => b.tipo === 'cuenta');
  assert.equal(reg.length, 3);
  assert.match(reg[1].texto, /programas: «Magíster en Prueba A» → «Otro programa»/);
});

test('cuentas con recibe_eventos reciben copia; sin correo de dirección, el correo al estudiante sale igual', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  assert.equal(estado.correos.pop().cc, 'consulta@usach.cl');
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: '', analista: 'analista.uno@usach.cl', activo: 'SÍ' }, false);
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  const pv = ctx.api_previsualizar('06/2026', 'aceptada', {});
  assert.deepEqual([...pv.correo.faltantes], []);
  assert.match(pv.correo.omitidos[0], /dirección de «Magíster en Prueba A»/);
  ctx.api_cambiarEstado('06/2026', 'aceptada', {});
  const m = estado.correos.pop();
  assert.match(m.to, /est6@usach\.cl/);
  assert.ok(!m.cc, 'sale sin la copia a la dirección de programa');
  assert.match(m.body, /por especial encargo de Vice Decano, Vicedecano/, 'nombre sin grado → «de»');
  // Con grado en el nombre de la cuenta → «del».
  const cu = env.libro.getSheetByName('Cuentas');
  const fv = cu.datos.findIndex(r => r[0] === 'vice@usach.cl');
  cu.datos[fv][1] = 'Dr. Vice Decano';
  const sol = tabla(env, 'Solicitudes').find(x => x.folio === '06/2026');
  assert.match(ctx.componer_('aceptada', sol, {}).cuerpo, /por especial encargo del Dr\. Vice Decano, Vicedecano/);
  cu.datos[fv][1] = 'Dra. Vice Decana';
  assert.match(ctx.componer_('cae_admisible', sol, {}).cuerpo, /por especial encargo de la Dra\. Vice Decana, /);
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '06/2026').estado, 'aceptada');
});

test('tarea diaria: recordatorios con plazo y aviso de compartición', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.tareaDiaria(), /reservada/);
  // El caso 05/2026 está en «programa» desde la migración (hoy): no corresponde recordatorio aún.
  estado.usuario = '';
  const antes = estado.correos.length;
  ctx.tareaDiaria();
  const recordatorios = estado.correos.slice(antes).filter(m => /Recordatorio/.test(m.subject));
  assert.equal(recordatorios.length, 0, 'los plazos corren desde la migración (hoy)');
  const aviso = estado.correos.slice(antes).find(m => /accesos no autorizados/.test(m.subject));
  assert.ok(aviso, 'avisa del editor antiguo con acceso directo');
  assert.match(aviso.body, /editor\.antiguo@usach\.cl/);
  // Simula plazo vencido
  const h = env.libro.getSheetByName('Solicitudes');
  const enc = h.datos[0];
  const f = h.datos.findIndex(r => r[0] === '05/2026');
  h.datos[f][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  const g = h.datos.findIndex(r => r[0] === '06/2026'); // «Recibida», sin analista
  h.datos[g][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  const n = estado.correos.length;
  ctx.tareaDiaria();
  const r = estado.correos.slice(n).filter(m => /Recordatorio · Solicitud CAE 05/.test(m.subject));
  assert.equal(r.length, 1);
  const adm = estado.correos.slice(n).filter(m => /06\/2026 · admisibilidad pendiente/.test(m.subject));
  assert.equal(adm.length, 1, 'recordatorio de admisibilidad del caso sin revisión');
  assert.match(adm[0].body, /asignar analista y abrir la revisión/);
  assert.match(adm[0].to, /analista\.uno@usach\.cl/);
  assert.ok(!/est6@usach\.cl/.test(adm[0].to + (adm[0].cc || '')), 'es interno: no se escribe al estudiante');
  assert.equal(h.datos[g][enc.indexOf('recordatorios')], 1);
  // Al asignar analista, el contador se reinicia para que ella reciba sus propios recordatorios
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_guardarGestion('06/2026', { analista: 'analista.uno@usach.cl' });
  assert.equal(Number(h.datos[g][enc.indexOf('recordatorios')]), 0);
  estado.usuario = '';
  assert.match(r[0].to, /^dir\d+@usach\.cl$/, 'el recordatorio va a la dirección de programa');
  assert.equal(r[0].cc, 'analista.uno@usach.cl', 'con copia a la analista del caso');
  assert.match(r[0].body, /Estimado\/a Director\/a/);
  assert.match(r[0].body, /a través del Sistema de Trazabilidad Documental \(STD\)/);
  assert.match(r[0].body, /El plazo de 2 días hábiles para responder venció el \S+\./);
  assert.equal(r[0].replyTo, 'analista.uno@usach.cl', 'las respuestas llegan a la analista');
  assert.equal(h.datos[f][enc.indexOf('recordatorios')], 1);
  // El mismo aviso de compartición no se repite
  assert.ok(!estado.correos.slice(n).some(m => /accesos no autorizados/.test(m.subject)));
});

test('seguimiento: cada estudiante ve solo lo suyo y sin notas internas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'est1@usach.cl';
  const r = ctx.api_misSolicitudes();
  assert.equal(r.solicitudes.length, 1);
  assert.equal(r.solicitudes[0].folio, '01/2026');
  assert.equal(JSON.stringify(r).indexOf('confidencial'), -1);
  assert.equal(JSON.stringify(r).indexOf('Enviado a RC'), -1);
  estado.usuario = 'otro@usach.cl';
  assert.equal(ctx.api_misSolicitudes().solicitudes.length, 0);
});

test('paso 2 exige el panel publicado (sin enlace de seguimiento no se instala)', () => {
  const env = preparar();
  const url = env.estado.url;
  env.estado.url = '';
  env.estado.usuario = env.estado.duenia;
  env.ctx.instalarPaso1();
  const cu = env.libro.getSheetByName('Cuentas');
  cu.set(2, 1, 'analista.uno@usach.cl');
  cu.appendRow(['vice@usach.cl', 'Vice Decano', 'Vicedecano/a', 'administracion', 'todos', 'SÍ', '', '', '', '']);
  assert.throws(() => env.ctx.instalarPaso2(), /Primero publique el panel/);
  env.estado.url = url;
  env.ctx.instalarPaso2();
  assert.equal(tabla(env, 'Solicitudes').length, 6);
});

test('todo correo al estudiante lleva el enlace de seguimiento', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const plantillas = tabla(env, 'Plantillas');
  plantillas.filter(p => /Estudiante/.test(p.para)).forEach(p => assert.match(p.cuerpo, /\{enlace\}/, p.evento));
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  ctx.api_cambiarEstado('06/2026', 'no_procede', {});
  const m = estado.correos.pop();
  assert.equal(m.to, 'est6@usach.cl');
  assert.match(m.body, /cuenta USACH con que envió el formulario, en: https:\/\/script\.google\.com\/.*\?v=seguimiento/);
});

test('si un correo automático falla, se avisa de inmediato a la analista y a la administración', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  hoja.appendRow(fila('', new Date(2026, 9, 8), 8, ['', '', ''], { analista: '' }).slice(0, 15));
  estado.usuario = '';
  estado.fallaCorreo = m => /est8@usach\.cl/.test(m.to); // falla solo el correo al estudiante
  ctx.alRecibirFormulario({ range: hoja.getRange(hoja.getLastRow(), 1) });
  const aviso = estado.correos.find(m => /no se envió un correo automático/.test(m.subject));
  assert.ok(aviso);
  assert.match(aviso.subject, /07\/2026/);
  assert.match(aviso.to, /analista\.uno@usach\.cl/);
  assert.match(aviso.to, /vice@usach\.cl/);
  assert.match(aviso.to, /institucional@usach\.cl/);
  assert.match(aviso.body, /recepcion/);
  assert.equal(aviso.body.indexOf('Fundamentación'), -1, 'el aviso no incluye datos del expediente');
  // La solicitud quedó registrada y el error en la bitácora
  assert.equal(tabla(env, 'Solicitudes').pop().folio, '07/2026');
  assert.ok(tabla(env, 'Bitácora').some(b => /ERROR · no se envió «recepcion»/.test(b.texto)));
  // La asignación (otro destinatario) sí salió
  assert.ok(estado.correos.some(m => /Nueva solicitud CAE asignada · 07\/2026/.test(m.subject)));
});

test('nueva solicitud sin analista en el programa: aviso al equipo, sin asignación; reasignar envía aviso', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja, libro } = env;
  // Una segunda analista con cuenta y el programa sin analista asignada
  libro.getSheetByName('Cuentas').appendRow(['analista.dos@usach.cl', 'Analista Dos', 'Analista', 'edicion', 'todos', 'SÍ', '', '', '', '']);
  libro.getSheetByName('Cuentas').appendRow(['analista.tres@usach.cl', 'Analista Tres', 'Analista', 'edicion', 'todos', 'NO', '', '', '', '']);
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: '', activo: 'SÍ' }, false);
  hoja.appendRow(fila('', new Date(2026, 9, 9), 9, ['', '', ''], { analista: '' }).slice(0, 15));
  estado.usuario = '';
  const n = estado.correos.length;
  ctx.alRecibirFormulario({ range: hoja.getRange(hoja.getLastRow(), 1) });
  const nuevos = estado.correos.slice(n);
  assert.equal(nuevos.length, 2, 'recepción + aviso al equipo, sin asignación');
  const equipo = nuevos.find(m => /Nueva solicitud CAE/.test(m.subject));
  assert.equal(equipo.to, 'analista.uno@usach.cl,vice@usach.cl,consulta@usach.cl,analista.dos@usach.cl', 'sin la cuenta inactiva ni Registro Curricular');
  assert.match(equipo.body, /sin asignar \(asígnela desde el expediente\)/);
  const s = tabla(env, 'Solicitudes').pop();
  assert.equal(s.analista, '');
  // Asignar desde el panel envía el aviso a la analista asignada
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_guardarGestion(s.folio, { analista: 'analista.dos@usach.cl' });
  const m = estado.correos.pop();
  assert.equal(m.to, 'analista.dos@usach.cl');
  assert.match(m.subject, /asignada · 07\/2026/);
  // No se puede asignar a una cuenta inactiva ni a quien no es Analista
  assert.throws(() => ctx.api_guardarGestion(s.folio, { analista: 'analista.tres@usach.cl' }), /rol Analista/);
  assert.throws(() => ctx.api_guardarGestion(s.folio, { analista: 'vice@usach.cl' }), /rol Analista/);
});

test('asignación automática solo hacia cuentas activas con rol Analista', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'sin.cuenta@usach.cl', activo: 'SÍ' }, false);
  hoja.appendRow(fila('', new Date(2026, 9, 9), 9, ['', '', ''], { analista: '' }).slice(0, 15));
  estado.usuario = '';
  ctx.alRecibirFormulario({ range: hoja.getRange(hoja.getLastRow(), 1) });
  assert.equal(tabla(env, 'Solicitudes').pop().analista, '');
  assert.ok(!estado.correos.some(m => m.to === 'sin.cuenta@usach.cl'));
  assert.ok(tabla(env, 'Bitácora').some(b => /sin\.cuenta@usach\.cl.*no tiene una cuenta activa/.test(b.texto)));
});

test('actualizar instalación agrega plantillas nuevas sin tocar las editadas', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const h = libro.getSheetByName('Plantillas');
  const i = h.datos.findIndex(r => r[0] === 'nueva_solicitud');
  h.datos.splice(i, 1); // instalación anterior, sin la plantilla nueva
  const j = h.datos.findIndex(r => r[0] === 'recepcion');
  h.datos[j][5] = 'Texto editado por el equipo {enlace}';
  estado.usuario = estado.duenia;
  ctx.actualizarInstalacion();
  assert.ok(tabla(env, 'Plantillas').some(t => t.evento === 'nueva_solicitud'));
  assert.equal(tabla(env, 'Plantillas').find(t => t.evento === 'recepcion').cuerpo, 'Texto editado por el equipo {enlace}');
});

test('código nuevo: la planilla se actualiza sola, una sola vez, y repara estados que ya no existen', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const h = libro.getSheetByName('Plantillas');
  h.appendRow(['decision', 'obsoleta', 'Analista', '', 'a', 'b', 'a', 'b', '', '']);
  const sh = libro.getSheetByName('Solicitudes');
  const enc = sh.datos[0];
  sh.datos[2][enc.indexOf('estado')] = 'autorizada';
  sh.datos[3][enc.indexOf('estado')] = 'vb_informe';
  delete estado.props.huella_estructura; // como si se acabara de subir código nuevo
  ctx.actualizarSiCorresponde_();
  assert.ok(!h.datos.some(r => r[0] === 'decision'), 'retira plantillas que el flujo vigente no usa');
  assert.ok(!h.datos.some(r => ['vb_informe', 'programa', 'devolucion'].indexOf(r[0]) >= 0), 'el programa va por STD: sin plantillas de correo');
  assert.equal(sh.datos[2][enc.indexOf('estado')], 'vb');
  assert.equal(sh.datos[3][enc.indexOf('estado')], 'informe_rc', 'un caso esperando V°B° al informe queda listo para registrar el envío al programa');
  assert.equal(sh.datos[2][enc.indexOf('revisar')], 'SÍ');
  const n = () => tabla(env, 'Bitácora').filter(b => /Actualización automática/.test(b.texto)).length;
  assert.equal(n(), 1);
  ctx.actualizarSiCorresponde_();
  assert.equal(n(), 1);
});

test('feriados automáticos: oficial primero, respaldo, caché y sin carga manual', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const anio = new Date().getFullYear();
  const d = (m, dia) => new Date(Date.UTC(anio, m - 1, dia));
  // Sin calendario disponible: lista vacía (lunes a viernes) y queda constancia del error
  estado.fallaCalendario = true;
  assert.deepEqual([...ctx.feriados_()], []);
  assert.match(ctx.cacheFeriados_().error, /no disponible/);
  // Solo el calendario general (con conmemoraciones): se filtran
  estado.fallaCalendario = false;
  estado.calendarios = { 'es.cl#holiday@group.v.calendar.google.com': [
    { inicio: d(9, 18), fin: d(9, 19), titulo: 'Fiestas Patrias', descripcion: 'Feriado público' },
    { inicio: d(5, 10), fin: d(5, 11), titulo: 'Día de la Madre', descripcion: 'Celebración' }
  ] };
  let c = ctx.actualizarFeriados_(true);
  assert.deepEqual([...c.fechas], [anio + '-09-18']);
  assert.equal(c.fuente, 'es.cl#holiday@group.v.calendar.google.com');
  // Si existe el oficial, se prefiere
  estado.calendarios['es.cl.official#holiday@group.v.calendar.google.com'] = [{ inicio: d(1, 1), fin: d(1, 2), titulo: 'Año Nuevo' }];
  c = ctx.actualizarFeriados_(true);
  assert.equal(c.fuente, 'es.cl.official#holiday@group.v.calendar.google.com');
  // Reciente: no vuelve a consultar
  estado.fallaCalendario = true;
  assert.equal(ctx.actualizarFeriados_(false).fuente, 'es.cl.official#holiday@group.v.calendar.google.com');
  // Falla al forzar: conserva la lista anterior y anota el error
  c = ctx.actualizarFeriados_(true);
  assert.deepEqual([...c.fechas], [anio + '-01-01']);
  assert.ok(c.error);
  // Configuración lo muestra (solo lectura)
  estado.usuario = 'vice@usach.cl';
  const cfg = ctx.api_config();
  assert.equal(cfg.feriados.total, 1);
  assert.ok(cfg.feriados.error);
});

test('correos se leen bien con y sin analista asignada', () => {
  const env = instalar(preparar());
  const { ctx } = env;
  const base = tabla(env, 'Solicitudes').find(s => s.folio === '06/2026');
  const con = Object.assign({}, base, { analista: 'analista.uno@usach.cl', estado: 'programa', estado_desde: new Date(2026, 9, 1) });
  const sin = Object.assign({}, con, { analista: '' });
  const nombre = ctx.nombreDe_('analista.uno@usach.cl', tabla(env, 'Cuentas'));

  const a1 = ctx.componer_('aceptada', con).cuerpo;
  assert.match(a1, new RegExp('La analista a cargo, ' + nombre + ', podrá contactarle'));
  assert.match(a1, new RegExp('Atentamente,\\n' + nombre + '\\nVicedecanato de Investigación y Postgrado · FAHU$'));
  const a2 = ctx.componer_('aceptada', sin).cuerpo;
  assert.match(a2, /El equipo del Vicedecanato podrá contactarle/);
  assert.doesNotMatch(a2, /analista a cargo/);
  assert.match(a2, /Atentamente,\nVicedecanato de Investigación y Postgrado · FAHU$/);

  assert.match(ctx.componer_('recordatorio', con).cuerpo, new RegExp('llegará a la analista a cargo, ' + nombre + '\\.'));
  assert.match(ctx.componer_('recordatorio', sin).cuerpo, /llegará al equipo del Vicedecanato\./);
  [a1, a2].forEach(c => assert.doesNotMatch(c, /\{\w+\}/));
});

test('analistas: se asignan o asignan a otra analista, y editan solo el correo de dirección de los programas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  // Asignarse a sí misma un caso sin analista (aviso de asignación incluido)
  estado.usuario = 'analista.uno@usach.cl';
  const n = estado.correos.length;
  ctx.api_guardarGestion('06/2026', { analista: 'analista.uno@usach.cl' });
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '06/2026').analista, 'analista.uno@usach.cl');
  assert.ok(estado.correos.slice(n).some(m => /asignada/.test(m.subject) && m.to === 'analista.uno@usach.cl'));
  // No se puede asignar a quien no es analista activa
  assert.throws(() => ctx.api_guardarGestion('06/2026', { analista: 'consulta@usach.cl' }), /rol Analista/);
  // Correo de dirección: la analista lo edita y queda en la bitácora
  ctx.api_guardarCorreoPrograma('Magíster en Prueba A', 'Nueva.Direccion@usach.cl');
  assert.equal(tabla(env, 'Programas').find(p => p.programa === 'Magíster en Prueba A').correo_direccion, 'nueva.direccion@usach.cl');
  assert.ok(tabla(env, 'Bitácora').some(b => /Correo de dirección de «Magíster en Prueba A»/.test(b.texto) && b.quien === 'analista.uno@usach.cl'));
  assert.throws(() => ctx.api_guardarCorreoPrograma('Magíster en Prueba A', 'no-es-correo'), /no válido/);
  assert.throws(() => ctx.api_guardarCorreoPrograma('Inexistente', 'a@usach.cl'), /no existe/);
  // Lo demás del programa sigue siendo de administración
  assert.throws(() => ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'x@usach.cl', analista: '', activo: 'NO' }, false), /nivel requerido/);
  // Nivel consulta no puede
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_guardarCorreoPrograma('Magíster en Prueba A', 'otra@usach.cl'), /nivel requerido/);
});

test('una analista asigna el caso a otra analista (y esta recibe el aviso)', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ correo: 'analista.dos@usach.cl', nombre: 'Analista Dos', rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'SÍ' }, true);
  estado.usuario = 'analista.uno@usach.cl';
  const n = estado.correos.length;
  ctx.api_guardarGestion('05/2026', { analista: 'analista.dos@usach.cl' });
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '05/2026').analista, 'analista.dos@usach.cl');
  assert.ok(estado.correos.slice(n).some(m => m.to === 'analista.dos@usach.cl' && /asignada/.test(m.subject)));
});

test('V°B°: solo el Vicedecano/a; la analista solo con «aprueba por otro medio» e indicando cuál', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'aviso_rc', {}), /lo registra el Vicedecano\/a/);
  assert.throws(() => ctx.api_cambiarEstado('05/2026', 'aviso_rc', { otroMedio: true, campos: {} }), /por qué medio/);
  const pv = ctx.api_previsualizar('05/2026', 'aviso_rc', {});
  assert.equal(pv.requiereVicedecano, true);
  assert.equal(pv.esVicedecano, false);
  ctx.api_cambiarEstado('05/2026', 'aviso_rc', { otroMedio: true, campos: { otro_medio: 'Correo del 10-10-2026' } });
  const b = tabla(env, 'Bitácora').filter(x => x.tipo === 'estado').pop();
  assert.match(b.texto, /por otro medio \(Correo del 10-10-2026\), registrado por analista\.uno@usach\.cl/);
  // El Vicedecano/a registra directo, sin marcar nada
  const env2 = instalar(preparar());
  env2.estado.usuario = 'analista.uno@usach.cl';
  env2.ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  env2.estado.usuario = 'vice@usach.cl';
  env2.ctx.api_cambiarEstado('05/2026', 'rechazo_vb', {});
  assert.match(tabla(env2, 'Bitácora').filter(x => x.tipo === 'estado').pop().texto, /registrado por el Vicedecano\/a/);
});

test('recordatorio de V°B° al Vicedecano/a, con copia a la analista', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('05/2026', 'vb', { campos: { propuesta_comite: 'Acoger' } });
  const h = env.libro.getSheetByName('Solicitudes'); const enc = h.datos[0];
  const f = h.datos.findIndex(r => r[0] === '05/2026');
  h.datos[f][enc.indexOf('estado_desde')] = new Date(Date.now() - 10 * 86400000);
  estado.usuario = '';
  const n = estado.correos.length;
  ctx.tareaDiaria();
  const r = estado.correos.slice(n).filter(m => /V°B° pendiente/.test(m.subject));
  assert.equal(r.length, 1);
  assert.equal(r[0].to, 'vice@usach.cl');
  assert.equal(r[0].cc, 'analista.uno@usach.cl');
  assert.match(r[0].body, /Propuesta del Comité: Acoger/);
});

test('el nombre del Vicedecano/a sale de su cuenta y Configuración solo lo muestra', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  assert.equal(typeof ctx.api_guardarVicedecano, 'undefined');
  assert.ok(!tabla(env, 'Parámetros').some(p => p.clave === 'vicedecano_nombre'));
  estado.usuario = 'analista.uno@usach.cl';
  const vd = ctx.api_config().vicedecano;
  const cuenta = tabla(env, 'Cuentas').find(c => c.rol === 'Vicedecano/a' && c.activo === 'SÍ');
  assert.deepEqual({ ...vd }, { nombre: cuenta.nombre, correo: cuenta.correo, activas: 1 });
  // Cambiar el nombre en «Cuentas» cambia el de los correos.
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarCuenta({ ...cuenta, nombre: 'Dra. Nueva Vicedecana' }, false);
  assert.equal(ctx.api_config().vicedecano.nombre, 'Dra. Nueva Vicedecana');
});

test('actualización: retira vicedecano_nombre y copia el nombre a la cuenta si estaba vacío', () => {
  const env = instalar(preparar());
  const { ctx } = env;
  const par = env.libro.getSheetByName('Parámetros');
  par.appendRow(['vicedecano_nombre', 'Dr. Antiguo Nombre', 'obsoleto']);
  const hc = env.libro.getSheetByName('Cuentas');
  const enc = hc.datos[0];
  const fila = hc.datos.findIndex(r => r[enc.indexOf('rol')] === 'Vicedecano/a');
  hc.datos[fila][enc.indexOf('nombre')] = '';
  const cambios = ctx.aplicarActualizacion_();
  assert.ok(cambios.some(c => /Parámetros retirados: vicedecano_nombre/.test(c)));
  assert.ok(!tabla(env, 'Parámetros').some(p => p.clave === 'vicedecano_nombre'));
  assert.equal(tabla(env, 'Cuentas').find(c => c.rol === 'Vicedecano/a').nombre, 'Dr. Antiguo Nombre');
});

test('visor: PDF tal cual, Word convertido a PDF (copia temporal borrada) y ZIP por documento', () => {
  const { crearZip } = require('./simulador');
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  const pdf = Buffer.from('%PDF-1.4 certificado');
  const docx = Buffer.from('PK-docx-simulado');
  const zip = crearZip([['docs/', ''], ['docs/certificado.pdf', pdf], ['docs/carta.docx', docx], ['__MACOSX/docs/._carta.docx', 'x'], ['docs/planilla.xlsx', 'xx']]);
  ctx.api_subirArchivo('05/2026', 'certificado.pdf', 'application/pdf', pdf.toString('base64'), 'otro');
  ctx.api_subirArchivo('05/2026', 'carta.docx', 'application/octet-stream', docx.toString('base64'), 'otro');
  ctx.api_subirArchivo('05/2026', 'antecedentes.zip', 'application/zip', zip.toString('base64'), 'otro');
  const arch = ctx.api_expediente('05/2026').archivos;
  const id = n => arch.find(a => a.nombre === n).id;
  assert.deepEqual([...arch.filter(a => a.vista).map(a => a.vista)].sort(), ['pdf', 'word', 'zip']);

  const vp = ctx.api_verArchivo('05/2026', id('certificado.pdf'));
  assert.equal(vp.tipo, 'pdf');
  assert.equal(Buffer.from(vp.base64, 'base64').toString(), '%PDF-1.4 certificado');

  const vw = ctx.api_verArchivo('05/2026', id('carta.docx'));
  assert.equal(vw.tipo, 'pdf'); assert.equal(vw.convertido, true); assert.equal(vw.nombre, 'carta.pdf');
  assert.equal(estado.convertidos.length, 1);
  assert.equal(estado.convertidos[0].mime, 'application/vnd.google-apps.document');
  assert.deepEqual([...estado.borrados], [estado.convertidos[0].id], 'la copia convertida se borra en el acto');

  const lista = ctx.api_verArchivo('05/2026', id('antecedentes.zip'));
  assert.equal(lista.modo, 'zip');
  assert.deepEqual([...lista.entradas].map(e => [e.nombre, e.vista]), [['docs/certificado.pdf', 'pdf'], ['docs/carta.docx', 'word'], ['docs/planilla.xlsx', '']]);
  const e0 = ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 0);
  assert.equal(e0.nombre, 'certificado.pdf');
  assert.equal(Buffer.from(e0.base64, 'base64').toString(), '%PDF-1.4 certificado');
  const e1 = ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 1);
  assert.equal(e1.tipo, 'pdf'); assert.equal(e1.convertido, true);
  assert.equal(estado.borrados.length, 2);
  assert.throws(() => ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 2), /no se puede mostrar/);
  assert.throws(() => ctx.api_verArchivo('05/2026', id('antecedentes.zip'), 9), /ya no está/);

  assert.throws(() => ctx.api_verArchivo('06/2026', id('certificado.pdf')), /no pertenece a este expediente/);
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_verArchivo('05/2026', id('certificado.pdf')), /nivel requerido/);
});

test('PDF del formulario a pedido: analistas y administración sí; consulta no; escapa el texto del estudiante', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const hs = env.libro.getSheetByName('Solicitudes');
  const enc = hs.datos[0], f = hs.datos.findIndex(x => x[0] === '05/2026');
  hs.datos[f][enc.indexOf('fundamentacion')] = 'Texto con <script>alert(1)</script> & símbolos';
  estado.usuario = 'analista.uno@usach.cl';
  const r = ctx.api_pdfSolicitud('05/2026');
  assert.ok(r.id);
  const html = estado.pdfs[estado.pdfs.length - 1];
  assert.ok(html.indexOf('<script>') < 0);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; símbolos/);
  assert.ok(!r.existente);
  const generados = estado.pdfs.length;
  // Se genera una sola vez: si se pide de nuevo, se informa el existente y no se elabora otro.
  estado.usuario = 'vice@usach.cl';
  const r2 = ctx.api_pdfSolicitud('05/2026');
  assert.equal(r2.existente, true); assert.equal(r2.id, r.id); assert.equal(r2.por, 'Analista Uno');
  assert.equal(estado.pdfs.length, generados);
  assert.equal(tabla(env, 'Archivos').filter(a => a.folio === '05/2026' && a.categoria === 'formulario_solicitud').length, 1);
  // Si el archivo se borró de Drive, se puede volver a generar.
  env.DriveApp.getFileById(r.id).setTrashed(true);
  const r3 = ctx.api_pdfSolicitud('05/2026');
  assert.ok(!r3.existente); assert.notEqual(r3.id, r.id);
  // Copias generadas antes de la regla «una sola vez» (o por una carrera): se conserva la original y se quitan las demás.
  estado.usuario = 'analista.uno@usach.cl';
  const hoja = env.libro.getSheetByName('Archivos');
  const fila = hoja.datos.find(x => x[1] === '05/2026' && x[4] === 'formulario_solicitud');
  [1, 2].forEach(k => { const c = env.archivo('pdfcopia' + k, fila[3], 1000, 'application/pdf'); estado.archivos['pdfcopia' + k] = c; const n = fila.slice(); n[0] = new Date(2026, 9, 13, 10, k); n[2] = 'pdfcopia' + k; hoja.appendRow(n); });
  const r4 = ctx.api_pdfSolicitud('05/2026');
  assert.equal(r4.existente, true); assert.equal(r4.id, r3.id, 'siempre la original'); assert.equal(r4.duplicados, 2);
  assert.equal(estado.pdfs.length, generados + 1, 'no se generó otro');
  assert.throws(() => ctx.api_quitarPdfDuplicados('05/2026'), /nivel requerido/, 'quitar copias: solo administración');
  estado.usuario = 'vice@usach.cl';
  const q = ctx.api_quitarPdfDuplicados('05/2026');
  assert.equal(q.quitados, 2);
  assert.ok(env.DriveApp.getFileById('pdfcopia1').isTrashed() && env.DriveApp.getFileById('pdfcopia2').isTrashed());
  assert.ok(!env.DriveApp.getFileById(r3.id).isTrashed(), 'la original sigue');
  assert.deepEqual(tabla(env, 'Archivos').filter(a => a.folio === '05/2026' && a.categoria === 'formulario_solicitud').map(a => a.archivo_id), [r.id, r3.id], 'quedan la borrada antes (histórica) y la original vigente');
  assert.equal(ctx.api_pdfSolicitud('05/2026').duplicados, 0);
  assert.ok(tabla(env, 'Bitácora').some(b => b.folio === '05/2026' && /se conservó el original/.test(b.texto)));
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_pdfSolicitud('05/2026'), /nivel requerido/);
});

test('panorama: Vicedecanato y Registro Curricular (Consulta) ven el avance; cada cuenta solo sus programas; sin datos sensibles', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const cu = env.libro.getSheetByName('Cuentas');
  cu.appendRow(['registradora@usach.cl', 'Registradora', 'Registro Curricular', 'consulta', 'todos', 'SÍ', '', '', '', '']);
  cu.appendRow(['rc.prog@usach.cl', 'RC Programa', 'Analista de Registro Curricular', 'consulta', 'Magíster en Prueba A', 'SÍ', '', '', '', '']);
  const hs = env.libro.getSheetByName('Solicitudes'); const enc = hs.datos[0];
  hs.datos[hs.datos.findIndex(x => x[0] === '06/2026')][enc.indexOf('programa')] = 'Doctorado en Prueba B';
  estado.usuario = 'registradora@usach.cl';
  const todos = ctx.api_panorama();
  assert.ok(todos.casos.length >= 5);
  const c = todos.casos.find(x => x.folio === '05/2026');
  assert.ok(c.ruta.some(p => p.situacion === 'actual'));
  assert.ok(c.fase);
  assert.equal(c.fundamentacion, undefined);
  assert.equal(c.run, undefined);
  estado.usuario = 'rc.prog@usach.cl';
  const propios = ctx.api_panorama().casos;
  assert.ok(propios.length > 0 && propios.every(x => x.programa === 'Magíster en Prueba A'));
  assert.ok(propios.length < todos.casos.length);
  estado.usuario = 'analista.uno@usach.cl';
  assert.ok(ctx.api_panorama().casos.length >= 5);
  estado.usuario = 'rc@usach.cl'; // Registro Curricular sin acceso: solo recibe copias
  assert.throws(() => ctx.api_panorama(), /nivel|acceso/i);
});

test('Configuración asigna analista y cuenta de Registro Curricular al programa; el correo al estudiante les llega en copia', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  const cu = env.libro.getSheetByName('Cuentas');
  cu.appendRow(['registradora@usach.cl', 'Registradora', 'Registro Curricular', 'consulta', 'todos', 'SÍ', '', '', '', '']);
  cu.appendRow(['rc.ana@usach.cl', 'Analista RC', 'Analista de Registro Curricular', 'sin_acceso', 'todos', 'SÍ', '', '', '', '']);
  cu.appendRow(['rc.maga@usach.cl', 'RC Magíster A', 'Cuenta de Registro Curricular del programa', 'sin_acceso', 'Magíster en Prueba A', 'SÍ', '', '', '', '']);
  estado.usuario = 'vice@usach.cl';
  const prog = { programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'analista.uno@usach.cl', activo: 'SÍ' };
  assert.throws(() => ctx.api_guardarPrograma({ ...prog, analista_rc: 'analista.uno@usach.cl' }, false), /rol «Analista de Registro Curricular»/);
  ctx.api_guardarPrograma({ ...prog, analista_rc: 'RC.Ana@usach.cl', cuenta_rc: 'rc.maga@usach.cl' }, false);
  const cfg = ctx.api_config();
  assert.deepEqual([...cfg.analistasRC].map(c => c.correo), ['rc.ana@usach.cl']);
  assert.deepEqual([...cfg.cuentasRC].map(c => c.correo), ['rc.maga@usach.cl']);
  assert.ok(cfg.parametros.some(p => p.clave === 'eventos_copia_rc'));
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  ctx.api_cambiarEstado('06/2026', 'aceptada', {});
  const m = estado.correos.pop();
  ['rc.ana@usach.cl', 'rc.maga@usach.cl', 'registradora@usach.cl'].forEach(c => assert.match(m.cc, new RegExp(c.replace('.', '\\.'))));
});

test('Configuración: «+ Añadir nueva…» crea la cuenta de RC del programa y la asigna', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  const prog = { programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'analista.uno@usach.cl', activo: 'SÍ' };
  assert.throws(() => ctx.api_guardarPrograma({ ...prog, nuevo_cuenta_rc: { nombre: 'RC MA', correo: 'rc@gmail.com' } }, false), /@usach\.cl/);
  assert.throws(() => ctx.api_guardarPrograma({ ...prog, nuevo_analista_rc: { nombre: 'X', correo: 'analista.uno@usach.cl' } }, false), /ya tiene una cuenta con rol «Analista»/);
  ctx.api_guardarPrograma({ ...prog, nuevo_analista_rc: { nombre: 'Analista RC', correo: 'RC.Ana@usach.cl' }, nuevo_cuenta_rc: { nombre: 'RC Magíster A', correo: 'rc.ma@usach.cl' } }, false);
  const c = tabla(env, 'Cuentas');
  const ana = c.find(x => x.correo === 'rc.ana@usach.cl'), cta = c.find(x => x.correo === 'rc.ma@usach.cl');
  assert.equal(ana.rol, 'Analista de Registro Curricular'); assert.equal(ana.nivel, 'sin_acceso'); assert.equal(ana.programas, 'Magíster en Prueba A');
  assert.equal(cta.rol, 'Cuenta de Registro Curricular del programa'); assert.equal(cta.activo, 'SÍ');
  const p = tabla(env, 'Programas').find(x => x.programa === 'Magíster en Prueba A');
  assert.equal(p.analista_rc, 'rc.ana@usach.cl'); assert.equal(p.cuenta_rc, 'rc.ma@usach.cl');
  // La misma analista de RC en otro programa: se reutiliza su cuenta y se le suma el programa
  ctx.api_guardarPrograma({ programa: 'Doctorado Nuevo', correo_direccion: '', analista: '', activo: 'SÍ' }, true);
  ctx.api_guardarPrograma({ programa: 'Doctorado Nuevo', correo_direccion: '', analista: '', activo: 'SÍ', nuevo_analista_rc: { nombre: '', correo: 'rc.ana@usach.cl' } }, false);
  assert.equal(tabla(env, 'Cuentas').filter(x => x.correo === 'rc.ana@usach.cl').length, 1);
  assert.equal(tabla(env, 'Cuentas').find(x => x.correo === 'rc.ana@usach.cl').programas, 'Magíster en Prueba A; Doctorado Nuevo');
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_guardarPrograma({ ...prog, nuevo_cuenta_rc: { nombre: 'X', correo: 'x@usach.cl' } }, false), /nivel requerido/);
});

test('«No enviar notificación»: el cambio queda hecho y registrado, sin correo ni copias', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  const antes = estado.correos.length;
  const r = ctx.api_cambiarEstado('06/2026', 'aceptada', { sinCorreo: true, motivoSinCorreo: 'Se informó en reunión presencial' });
  assert.equal(r.sinCorreo, true); assert.equal(r.conCorreo, false);
  assert.equal(estado.correos.length, antes, 'no sale ningún correo (ni copias)');
  assert.equal(tabla(env, 'Solicitudes').find(x => x.folio === '06/2026').estado, 'aceptada');
  const b = tabla(env, 'Bitácora').filter(x => x.folio === '06/2026' && x.tipo === 'estado').pop();
  assert.match(b.texto, /Sin notificación por correo \(decidido por analista\.uno@usach\.cl\): Se informó en reunión presencial/);
  assert.equal(b.asunto, '(no enviado)');
  // Los datos obligatorios del paso se siguen exigiendo (quedan en el expediente)
  const env2 = instalar(preparar());
  env2.estado.usuario = 'analista.uno@usach.cl';
  env2.ctx.api_cambiarEstado('06/2026', 'revision', {});
  const antes2 = env2.estado.correos.length;
  assert.throws(() => env2.ctx.api_cambiarEstado('06/2026', 'rechazada', { sinCorreo: true }), /Falta completar/);
  env2.ctx.api_cambiarEstado('06/2026', 'rechazada', { sinCorreo: true, campos: { motivo: 'Fuera de plazo' } });
  assert.equal(env2.estado.correos.length, antes2);
});

test('verificación de la migración: sin diferencias tras instalar; detecta celdas cambiadas y filas desplazadas', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  estado.usuario = 'vice@usach.cl';
  const v0 = ctx.api_verificarMigracion();
  assert.equal(v0.resumen.filas, 6); assert.equal(v0.resumen.migradas, 6); assert.equal(v0.resumen.nuevas, 0);
  assert.equal(v0.resumen.formulario, 0, JSON.stringify([...v0.diferencias]));
  assert.equal(v0.resumen.gestion, 0, JSON.stringify([...v0.diferencias]));
  assert.ok(env.libro.getSheetByName('Verificación migración'), 'deja el detalle en una hoja');
  assert.ok(tabla(env, 'Bitácora').some(b => /Verificación de la migración: 0 diferencia/.test(b.texto)));
  // Un dato del formulario cambiado en la planilla original
  const enc = hoja.datos[0];
  hoja.datos[1][enc.indexOf('Primer Apellido')] = 'ApellidoCambiado';
  const v1 = ctx.api_verificarMigracion();
  assert.equal(v1.resumen.formulario, 1);
  assert.deepEqual({ ...v1.diferencias[0] }, { fila: 2, folio: '01/2026', campo: 'apellido1', original: 'ApellidoCambiado', sistema: 'Apellido1', tipo: 'formulario', nota: '' });
  hoja.datos[1][enc.indexOf('Primer Apellido')] = 'Apellido1';
  // Un dato de gestión editado en el panel: se informa como «gestión», no como error del formulario
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_guardarGestion('01/2026', { n_std: 'STD-NUEVO' });
  estado.usuario = 'vice@usach.cl';
  const v2 = ctx.api_verificarMigracion();
  assert.equal(v2.resumen.formulario, 0); assert.equal(v2.resumen.gestion, 1); assert.equal(v2.diferencias[0].campo, 'n_std');
  // Filas desplazadas en la hoja de respuestas (como al ordenar): fundamentación de otra persona → alerta, nunca el texto ajeno
  const f2 = hoja.datos[2].slice(), f3 = hoja.datos[3].slice();
  hoja.datos[2] = f3; hoja.datos[3] = f2;
  const v3 = ctx.api_verificarMigracion();
  assert.ok(v3.resumen.formulario >= 4, 'nombres, apellidos y correos ya no cuadran en dos filas');
  estado.usuario = 'analista.uno@usach.cl';
  const e = ctx.api_expediente('02/2026');
  assert.equal(e.fundamentacion, '');
  assert.match(e.alertaFundamentacion, /ya no corresponde/);
  assert.throws(() => ctx.api_pdfSolicitud('02/2026'), /No se generó el PDF/);
  hoja.datos[2] = f2; hoja.datos[3] = f3;
  // Restaurado: el PDF del caso migrado incluye la fundamentación leída de su fila
  ctx.api_pdfSolicitud('02/2026');
  assert.match(estado.pdfs[estado.pdfs.length - 1], /Fundamentación confidencial 2/);
  // Solo Administración
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_verificarMigracion(), /nivel requerido/);
});

test('realinear filas migradas: una fila insertada en la hoja de respuestas desplaza todo; se corrige por identidad', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  // Se inserta una fila nueva en la posición 3 (como al pegar un caso antiguo u ordenar por fecha)
  const nueva = hoja.datos[1].slice(); nueva[0] = '09/2025'; nueva[2] = 'est9@usach.cl'; nueva[3] = 'Apellido9'; nueva[5] = 'Nombre9'; nueva[7] = 'est9@usach.cl';
  hoja.datos.splice(2, 0, nueva);
  estado.usuario = 'vice@usach.cl';
  const v1 = ctx.api_verificarMigracion();
  assert.ok(v1.resumen.formulario > 20, 'todo lo de la fila 3 en adelante aparece desplazado');
  estado.usuario = 'analista.uno@usach.cl';
  assert.match(ctx.api_expediente('02/2026').alertaFundamentacion || '', /ya no corresponde/);
  estado.usuario = 'vice@usach.cl';
  const r = ctx.api_realinearMigracion();
  assert.equal(r.realineadas.length, 5, 'las cinco solicitudes bajo la fila insertada');
  assert.equal(r.sinCambio, 1);
  assert.deepEqual([...r.pendientes], []);
  assert.deepEqual([...r.filasSinSolicitud], [3], 'la fila insertada no tiene solicitud en el sistema');
  const v2 = ctx.api_verificarMigracion();
  assert.equal(v2.resumen.formulario, 1);
  assert.equal(v2.diferencias[0].campo, 'solicitud'); assert.equal(v2.diferencias[0].fila, 3);
  assert.match(v2.diferencias[0].nota, /Ningún folio coincide/, 'estudiante desconocido: llegó después o nunca se importó');
  assert.equal(v2.resumen.gestion, 0);
  // Una fila huérfana del mismo estudiante que un folio existente se explica como posible envío repetido
  const repetida = hoja.datos[3].slice(); repetida[0] = '';
  hoja.datos.push(repetida);
  estado.usuario = 'vice@usach.cl';
  const v3 = ctx.api_verificarMigracion();
  const huerfanas = v3.diferencias.filter(d => d.campo === 'solicitud');
  assert.equal(huerfanas.length, 2);
  assert.match(huerfanas[1].nota, /Mismo estudiante que 02\/2026 \(fila 4, [a-z_]+\)/);
  estado.usuario = 'analista.uno@usach.cl';
  const e = ctx.api_expediente('02/2026');
  assert.equal(e.alertaFundamentacion, undefined);
  assert.equal(e.fundamentacion, 'Fundamentación confidencial 2');
  assert.ok(tabla(env, 'Bitácora').some(b => b.folio === '02/2026' && /realineada: 3 → 4/.test(b.texto)));
});

test('cuentas: el panel recibe el resumen efectivo de cada cuenta y puede calcularlo para un formulario sin guardar', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'analista.uno@usach.cl', activo: 'SÍ', nuevo_analista_rc: { nombre: 'Ana RC', correo: 'rc.ana@usach.cl' } }, false);
  const r = ctx.api_cuentas();
  const rcAna = r.resumenes['rc.ana@usach.cl'];
  assert.ok(rcAna, 'la cuenta creada desde Configuración tiene resumen');
  assert.ok(rcAna.copias.some(c => c.evento === 'cae_admisible' && /Configuración a «Magíster en Prueba A»/.test(c.origenes[0])));
  assert.ok(r.resumenes['analista.uno@usach.cl'].copias.some(c => c.evento === 'nueva_solicitud'));
  // Vista previa de un formulario: rol Registro Curricular, sin nada marcado → hereda lo de la analista de RC.
  const prev = ctx.api_resumenCuenta({ correo: 'nueva@usach.cl', rol: 'Registro Curricular', nivel: 'consulta', programas: 'todos', activo: 'SÍ', recibe_eventos: '' });
  assert.ok(prev.copias.some(c => c.evento === 'aceptada' && /analista de Registro Curricular/.test(c.origenes[0])));
  assert.match(prev.acceso, /consulta/);
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_resumenCuenta({}), /SIN_ACCESO/);
});

test('cuentas: un registro duplicado se detecta y se elimina por fila; no se elimina la dueña, la propia ni la última administración', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const hoja = libro.getSheetByName('Cuentas');
  // Duplicado tal como lo deja un doble clic: misma cuenta dos veces.
  hoja.appendRow(['consulta@usach.cl', 'Solo Consulta (repetida)', 'Consulta', 'consulta', 'todos', 'SÍ', '', '', '', '']);
  estado.usuario = 'vice@usach.cl';
  let r = ctx.api_cuentas();
  assert.deepEqual([...r.duplicadas], ['consulta@usach.cl']);
  const repetidas = r.cuentas.filter(c => c.correo === 'consulta@usach.cl');
  assert.equal(repetidas.length, 2);
  assert.ok(repetidas.every(c => Number(c.fila) >= 2), 'cada registro trae su fila');
  const sobrante = repetidas[1];
  assert.throws(() => ctx.api_eliminarCuenta('otro@usach.cl', sobrante.fila), /ya no está en esa fila/, 'fila y correo deben coincidir');
  const res = ctx.api_eliminarCuenta(sobrante.correo, sobrante.fila);
  assert.equal(res.quedan, 1);
  r = ctx.api_cuentas();
  assert.deepEqual([...r.duplicadas], []);
  assert.equal(r.cuentas.filter(c => c.correo === 'consulta@usach.cl').length, 1);
  assert.ok(tabla(env, 'Bitácora').some(b => b.tipo === 'cuenta' && /Cuenta eliminada: consulta@usach\.cl · Solo Consulta \(repetida\)/.test(b.texto)));
  // Salvaguardas
  const vice = r.cuentas.find(c => c.correo === 'vice@usach.cl');
  assert.throws(() => ctx.api_eliminarCuenta(vice.correo, vice.fila), /propia cuenta/);
  assert.throws(() => ctx.api_eliminarCuenta(estado.duenia, 2), /dueña/);
  estado.usuario = estado.duenia;
  assert.throws(() => ctx.api_eliminarCuenta(vice.correo, vice.fila), /al menos una cuenta activa con nivel Administración/);
  const consulta = r.cuentas.find(c => c.correo === 'consulta@usach.cl');
  ctx.api_eliminarCuenta(consulta.correo, consulta.fila);
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_cuentas(), /SIN_ACCESO/, 'eliminada: pierde el acceso de inmediato');
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_eliminarCuenta('vice@usach.cl', vice.fila), /SIN_ACCESO/);
});

test('hoja de respuestas protegida: la actualización la protege (solo la dueña edita) y el menú y el diagnóstico lo reflejan', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const hoja = libro.getSheets().find(h => h.getFormUrl());
  assert.ok(hoja, 'hay hoja de respuestas');
  // La instalación (paso 2) ya pasa por aplicarActualizacion_; la hoja debe quedar protegida.
  const p = hoja.getProtections('SHEET')[0];
  assert.ok(p, 'protegida');
  assert.equal(p.canDomainEdit(), false);
  assert.equal(p.isWarningOnly(), false);
  assert.deepEqual(p.getEditors().map(e => e.getEmail()), [estado.duenia], 'solo la cuenta dueña');
  assert.match(p.getDescription(), /No ordenar, insertar ni borrar filas/);
  // Idempotente desde el menú: no crea una segunda protección ni falla.
  estado.usuario = estado.duenia;
  ctx.protegerHojaRespuestas();
  assert.equal(hoja.getProtections('SHEET').length, 1);
  // Si alguien reabre la edición al dominio, la siguiente actualización la cierra y lo anota.
  p.setDomainEdit(true);
  const cambios = ctx.aplicarActualizacion_();
  assert.equal(p.canDomainEdit(), false);
  assert.ok(!cambios.some(c => /No se pudo proteger/.test(c)));
  estado.usuario = 'vice@usach.cl';
  assert.throws(() => ctx.protegerHojaRespuestas(), /dueña|SOLO_DUENIA|cuenta/i);
});

test('realinear filas migradas: un estudiante con dos envíos se desempata por fecha y tipo; no se asignan dos folios a la misma fila', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  // Antes de migrar no se puede; se simula después: dos filas nuevas del mismo estudiante (est2) insertadas al inicio, con fechas y tipos distintos,
  // y la solicitud 02/2026 (fecha 01-02-2026, Renuncia) debe quedar en la fila cuya fecha y tipo coinciden, no en la primera del estudiante.
  const base = hoja.datos[2].slice(); // fila 3 = 02/2026 (est2)
  const otra = base.slice(); otra[0] = '07/2026'; otra[1] = new Date(2026, 5, 1); otra[12] = 'Matrícula fuera de plazo';
  hoja.datos.splice(2, 0, otra); // ahora la fila 3 es el segundo envío de est2 y la original pasa a la 4
  estado.usuario = 'vice@usach.cl';
  const r = ctx.api_realinearMigracion();
  const dos = r.realineadas.find(x => x.folio === '02/2026');
  assert.ok(dos && dos.a === 4, '02/2026 va a la fila con su misma fecha y tipo (la 4), no a la 3: ' + JSON.stringify(dos));
  assert.deepEqual([...r.filasSinSolicitud], [3], 'el otro envío del estudiante queda sin solicitud');
  assert.deepEqual([...r.pendientes], []);
  const v = ctx.api_verificarMigracion();
  assert.ok(!v.diferencias.some(d => /misma fila/.test(d.nota)), 'ninguna fila con dos folios');
  assert.equal(v.diferencias.filter(d => d.tipo === 'formulario' && d.campo !== 'solicitud').length, 0);
  // Dos solicitudes del mismo estudiante cruzadas entre sí se destraban
  const sols = ctx.api_bandeja().map(s => s.folio);
  assert.ok(sols.indexOf('02/2026') >= 0);
  estado.usuario = 'vice@usach.cl';
  const r2 = ctx.api_realinearMigracion();
  assert.equal(r2.realineadas.length, 0, 'segunda pasada: estable');
});

test('importar filas sin solicitud: cada fila huérfana pasa a ser una solicitud «Por revisar», con folio nuevo si el suyo ya existe', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  // Segundo envío de est2 con el mismo folio en la columna A (como en la planilla real), al final de la hoja.
  const otra = hoja.datos[2].slice(); otra[1] = new Date(2026, 5, 1); otra[12] = 'Matrícula fuera de plazo'; otra[15] = 'Rechazado'; otra[16] = ''; otra[22] = '';
  hoja.datos.push(otra);
  estado.usuario = 'vice@usach.cl';
  let v = ctx.api_verificarMigracion();
  assert.equal(v.diferencias.filter(d => d.campo === 'solicitud').length, 1);
  const r = ctx.api_importarFilasSinSolicitud();
  assert.equal(r.importadas.length, 1);
  const imp = r.importadas[0];
  assert.equal(imp.fila, hoja.datos.length, 'la última fila');
  assert.equal(imp.folioPlanilla, '02/2026');
  assert.equal(imp.estado, 'rechazada');
  assert.match(imp.folio, /^07\/2026$/, 'siguiente folio libre del año');
  assert.match(imp.nota, /ya usado por otra solicitud; asignado 07\/2026/);
  assert.match(imp.nota, /Mismo estudiante que 02\/2026/);
  const s = tabla(env, 'Solicitudes').find(x => x.folio === '07/2026');
  assert.equal(s.revisar, 'SÍ'); assert.equal(s.tipo_texto_libre, 'Matrícula fuera de plazo'); assert.match(s.origen, /importada/);
  assert.equal(hoja.datos[hoja.datos.length - 1][0], '07/2026', 'folio canónico escrito en la columna A');
  const bit = tabla(env, 'Bitácora').filter(b => b.folio === '07/2026');
  assert.ok(bit.some(b => b.tipo === 'estado' && b.estado_nuevo === 'rechazada' && /migrado/.test(b.texto)));
  v = ctx.api_verificarMigracion();
  assert.equal(v.diferencias.filter(d => d.campo === 'solicitud').length, 0, 'ya no hay filas sin solicitud');
  assert.equal(v.diferencias.filter(d => d.tipo === 'formulario').length, 0, 'la importada coincide con su fila');
  // Segunda ejecución: nada que importar; estudiante ve ambas en seguimiento
  assert.equal(ctx.api_importarFilasSinSolicitud().importadas.length, 0);
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_importarFilasSinSolicitud(), /SIN_ACCESO/);
});

test('volver a un paso anterior: solo a pasos ya recorridos, con motivo, sin correo; deshacer un V°B° requiere Vicedecano/a o administración', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'revision', {});
  ctx.api_cambiarEstado('06/2026', 'aceptada', { campos: {} , sinCorreo: true });
  let e = ctx.api_expediente('06/2026');
  assert.deepEqual([...e.anteriores].map(a => a.id), ['recibida', 'revision']);
  assert.throws(() => ctx.api_retroceder('06/2026', 'revision', ''), /motivo/);
  assert.throws(() => ctx.api_retroceder('06/2026', 'vb', 'x'), /ya pasó/);
  assert.throws(() => ctx.api_retroceder('06/2026', 'aceptada', 'x'), /ya está/);
  const correosAntes = estado.correos.length;
  const r = ctx.api_retroceder('06/2026', 'revision', 'Faltaba un antecedente');
  assert.equal(r.deshaceVb, false);
  assert.equal(estado.correos.length, correosAntes, 'sin correo');
  e = ctx.api_expediente('06/2026');
  assert.equal(e.estado, 'revision');
  assert.ok(e.bitacora.some(b => /Retroceso: Admisible para análisis → .*Motivo: Faltaba un antecedente/.test(b.texto) && b.estado_nuevo === 'revision'));
  assert.deepEqual([...e.siguientes].map(x => x.id).sort(), ['aceptada', 'no_procede', 'rechazada']);
  // Tras un V°B° (aviso_rc), volver a «vb» lo deshace: la analista no puede; el Vicedecano/a sí.
  ctx.api_guardarGestion('06/2026', { n_std: '123' });
  ctx.api_cambiarEstado('06/2026', 'aceptada', { sinCorreo: true });
  ctx.api_cambiarEstado('06/2026', 'informe_rc', {});
  ctx.api_cambiarEstado('06/2026', 'programa', {});
  estado.usuario = 'vice@usach.cl';
  ctx.api_cambiarEstado('06/2026', 'vb', { campos: { propuesta_comite: 'Aprobar' } });
  ctx.api_cambiarEstado('06/2026', 'aviso_rc', {});
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_retroceder('06/2026', 'vb', 'error'), /deshace el V°B°/);
  assert.throws(() => ctx.api_retroceder('06/2026', 'programa', 'error'), /deshace el V°B°/);
  estado.usuario = 'vice@usach.cl';
  const r2 = ctx.api_retroceder('06/2026', 'vb', 'Se revisará otra vez');
  assert.equal(r2.deshaceVb, true);
  assert.equal(ctx.api_expediente('06/2026').estado, 'vb');
  assert.ok(tabla(env, 'Bitácora').some(b => b.folio === '06/2026' && /Deshace el V°B° registrado/.test(b.texto)));
});

test('reparar importación: deshace la copia importada de un folio atascado, restaura el folio en la planilla y realinea; conserva importaciones legítimas', () => {
  const env = instalar(preparar());
  const { ctx, estado, hoja } = env;
  // Escenario real: est2 (02/2026) tiene un segundo envío insertado en la fila 3; 02/2026 queda atascado en la fila 4 (de est3) por desorden.
  const segundo = hoja.datos[2].slice(); segundo[0] = '02/2026'; segundo[1] = new Date(2026, 5, 1); segundo[12] = 'Matrícula fuera de plazo';
  hoja.datos.splice(2, 0, segundo);           // fila 3 = segundo envío de est2; est2 original pasa a la fila 4; est3 a la 5…
  // Además un envío legítimo de est9 (sin folio atascado) al final.
  const nueve = hoja.datos[3].slice(); nueve[0] = ''; nueve[2] = 'est9@usach.cl'; nueve[3] = 'Apellido9'; nueve[5] = 'Nombre9'; nueve[7] = 'est9@usach.cl'; nueve[1] = new Date(2026, 6, 1);
  hoja.datos.push(nueve);
  estado.usuario = 'vice@usach.cl';
  // Importación «a ciegas» (como ocurrió): sin realinear, cada fila sin solicitud se importa, incluidas las filas verdaderas de folios atascados.
  const imp = ctx.importarFilasSinSolicitud_('vice@usach.cl', { realinear: false });
  assert.ok(imp.importadas.length >= 2);
  // Realinear después: el folio atascado no puede ir a su fila (la ocupa la copia importada) y queda chocando con otro.
  const ra = ctx.realinearMigracion_('vice@usach.cl');
  assert.ok(ra.pendientes.length >= 1, 'folio atascado sin fila libre');
  let v = ctx.api_verificarMigracion();
  assert.ok(v.diferencias.some(d => d.campo === 'fila_respuesta' && /misma fila/.test(d.nota)), 'colisiones presentes');
  assert.throws(() => ctx.api_importarFilasSinSolicitud(), /No se importó nada/);
  const antes = tabla(env, 'Solicitudes').length;
  const r = ctx.api_repararImportacion();
  assert.ok(r.deshechas.length >= 1, 'se deshizo al menos una copia');
  assert.ok(r.deshechas.every(d => /^0[2-6]\/2026$/.test(d.duplicabaA)), 'cada una duplicaba un folio atascado');
  assert.equal(r.realineado.pendientes.length, 0);
  v = ctx.api_verificarMigracion();
  assert.equal(v.diferencias.filter(d => d.campo === 'fila_respuesta').length, 0, 'sin colisiones');
  assert.equal(v.diferencias.filter(d => d.tipo === 'formulario' && d.campo !== 'solicitud').length, 0, 'todo en su fila');
  const sols = tabla(env, 'Solicitudes');
  assert.equal(sols.length, antes - r.deshechas.length);
  assert.ok(sols.some(s => s.correo_verificado === 'est9@usach.cl' && /importada/.test(s.origen)), 'la importación legítima se conserva');
  const dos = sols.find(s => s.folio === '02/2026');
  assert.ok([3, 4].indexOf(Number(dos.fila_respuesta)) >= 0 && hoja.datos[Number(dos.fila_respuesta) - 1][2] === 'est2@usach.cl');
  assert.ok(tabla(env, 'Bitácora').some(b => b.tipo === 'sistema' && /Reparación de importación: eliminadas/.test(b.texto)));
  assert.ok(!tabla(env, 'Bitácora').some(b => r.deshechas.map(d => d.folio).indexOf(b.folio) >= 0), 'sin bitácora huérfana');
  // La fila del segundo envío de est2 queda sin solicitud y ahora sí se puede importar (realinea antes, sin colisiones)
  const r2 = ctx.api_importarFilasSinSolicitud();
  assert.equal(tabla(env, 'Solicitudes').filter(s => s.correo_verificado === 'est2@usach.cl').length, 2);
  assert.equal(ctx.api_verificarMigracion().diferencias.filter(d => d.tipo === 'formulario').length, 0, 'coherencia total: cada fila una solicitud');
  assert.equal(ctx.api_repararImportacion().deshechas.length, 0, 'nada que reparar');
});

test('folios guardados como fecha por Sheets se corrigen a texto en la actualización automática', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  const hs = libro.getSheetByName('Solicitudes');
  const f = hs.datos.findIndex(x => x[0] === '03/2026');
  hs.datos[f][0] = new Date(2026, 2, 1); // lo que Sheets hace con «03/2026» sin formato de texto
  estado.usuario = 'vice@usach.cl';
  assert.throws(() => ctx.api_expediente('03/2026'), /No existe/);
  const cambios = ctx.aplicarActualizacion_();
  assert.ok(cambios.some(c => /Folios guardados como fecha corregidos: 03\/2026/.test(c)));
  assert.equal(ctx.api_expediente('03/2026').folio, '03/2026');
  assert.ok(ctx.api_expediente('03/2026').bitacora.length > 0, 'la bitácora vuelve a enlazar');
});

test('eliminar registros: solo administración, con motivo y constancia (solicitud y archivo del expediente)', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  const b64 = Buffer.from('%PDF-1.4 prueba').toString('base64');
  ctx.api_subirArchivo('03/2026', 'informe.pdf', 'application/pdf', b64, 'informe_academico');
  const subido = ctx.api_expediente('03/2026').archivos.find(a => a.nombre === 'informe.pdf');
  const ante = ctx.api_expediente('01/2026').archivos.find(a => /antecedentes/i.test(a.categoria));
  assert.ok(ante, 'el caso migrado tiene antecedentes del formulario');
  // Edición no elimina nada
  assert.throws(() => ctx.api_eliminarArchivo('03/2026', subido.id, 'x'), /nivel requerido/);
  assert.throws(() => ctx.api_eliminarSolicitud('03/2026', 'x'), /nivel requerido/);
  estado.usuario = 'vice@usach.cl';
  assert.throws(() => ctx.api_eliminarArchivo('03/2026', subido.id, ''), /motivo/);
  assert.throws(() => ctx.api_eliminarArchivo('03/2026', 'noexiste', 'x'), /no está en este expediente/);
  ctx.api_eliminarArchivo('03/2026', subido.id, 'Subido por error');
  assert.ok(env.DriveApp.getFileById(subido.id).isTrashed(), 'archivo del equipo: a la papelera');
  assert.ok(!ctx.api_expediente('03/2026').archivos.some(a => a.id === subido.id));
  assert.ok(ctx.api_expediente('03/2026').bitacora.some(b => /Archivo eliminado por administración: «informe\.pdf».*Motivo: Subido por error/.test(b.texto)));
  // Antecedentes del Formulario: el archivo del estudiante no se toca
  ctx.api_eliminarArchivo('01/2026', ante.id, 'Duplicado');
  assert.ok(!env.DriveApp.getFileById(ante.id).isTrashed(), 'el original del estudiante sigue');
  assert.ok(ctx.api_expediente('01/2026').bitacora.some(b => /no se tocó/.test(b.texto)));
  // Solicitud
  assert.throws(() => ctx.api_eliminarSolicitud('03/2026', ''), /motivo/);
  const antes = ctx.api_bandeja().length;
  const r = ctx.api_eliminarSolicitud('03/2026', 'Ingresada dos veces');
  assert.equal(r.filaRespuesta, 4);
  assert.equal(ctx.api_bandeja().length, antes - 1);
  assert.throws(() => ctx.api_expediente('03/2026'), /No existe/);
  const bit = tabla(env, 'Bitácora').filter(b => b.folio === '03/2026');
  assert.ok(bit.length > 1, 'la bitácora del folio se conserva');
  assert.match(bit[bit.length - 1].texto, /SOLICITUD ELIMINADA por administración · Motivo: Ingresada dos veces .* fila de respuestas 4 \(conservada\)/);
  assert.equal(tabla(env, 'Archivos').filter(a => a.folio === '03/2026').length, 0);
  // La fila queda huérfana y se puede volver a importar
  const v = ctx.api_verificarMigracion();
  assert.ok(v.diferencias.some(d => d.campo === 'solicitud' && d.fila === 4));
});

test('recordatorio manual: vista previa y envío según el paso; cuenta para el máximo y queda en la bitácora', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  // 05/2026 está en «programa» (migrado): recordatorio a la dirección del programa con copia a la analista
  const e = ctx.api_expediente('05/2026');
  assert.equal(e.estado, 'programa');
  assert.equal(e.recordatorio.evento, 'recordatorio'); assert.equal(e.recordatorio.enviados, 0);
  const pv = ctx.api_previsualizarRecordatorio('05/2026');
  assert.match(pv.correo.para[0], /^dir\d+@usach\.cl$/, 'dirección del programa');
  assert.ok(pv.correo.cc.indexOf('analista.uno@usach.cl') >= 0);
  const antes = estado.correos.length;
  const r = ctx.api_enviarRecordatorio('05/2026', { cuerpo: pv.correo.cuerpo + '\n\nPD: urgente.' });
  assert.equal(estado.correos.length, antes + 1);
  assert.match(estado.correos[estado.correos.length - 1].body, /PD: urgente/);
  const e2 = ctx.api_expediente('05/2026');
  assert.equal(e2.recordatorio.enviados, 1); assert.ok(e2.recordatorio.ultimo);
  const b = e2.bitacora.find(x => /Recordatorio enviado a mano/.test(x.texto));
  assert.ok(b && b.evento === 'recordatorio' && b.editado === 'SÍ' && b.quien === 'analista.uno@usach.cl');
  // La tarea diaria no repite el recordatorio el mismo día (acaba de enviarse)
  assert.equal(ctx.recordatorioPendiente(ctx.buscarSolicitud_('05/2026'), new Date(), ctx.parametros_(), []), '');
  // Paso sin espera ajena: no hay recordatorio
  assert.equal(ctx.api_expediente('03/2026').recordatorio, undefined);
  assert.throws(() => ctx.api_previsualizarRecordatorio('03/2026'), /no se espera respuesta/);
  assert.throws(() => ctx.api_enviarRecordatorio('03/2026', {}), /no hay recordatorio/);
  // Informe de RC: plantilla nueva a la cuenta con rol Registro Curricular
  ctx.api_guardarGestion('03/2026', { n_std: '777' });
  ctx.api_cambiarEstado('03/2026', 'informe_rc', {});
  const pv2 = ctx.api_previsualizarRecordatorio('03/2026');
  assert.equal(pv2.evento, 'recordatorio_informe_rc');
  assert.deepEqual([...pv2.correo.para], ['rc@usach.cl']);
  assert.match(pv2.correo.cuerpo, /STD N° 777/);
  assert.ok(!/\{[a-z_]+\}/.test(pv2.correo.cuerpo), 'sin variables sin resolver');
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_enviarRecordatorio('05/2026', {}), /nivel requerido/);
});

test('listas desplegables de «Cuentas»: la actualización las renueva con los roles vigentes (crear analista de RC desde Configuración)', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  // Planilla instalada con la lista de roles antigua (sin los de Registro Curricular), como la real.
  const hc = libro.getSheetByName('Cuentas');
  const antigua = env.ctx.SpreadsheetApp.newDataValidation().requireValueInList(['Analista', 'Vicedecano/a', 'Registro Curricular', 'Consulta'], true).setAllowInvalid(false).build();
  hc.getRange(2, 3, 1000, 1).setDataValidation(antigua);
  estado.usuario = 'vice@usach.cl';
  const prog = { programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'analista.uno@usach.cl', activo: 'SÍ', nuevo_analista_rc: { nombre: 'Ana RC', correo: 'rc.ana@usach.cl' } };
  assert.throws(() => ctx.api_guardarPrograma(prog, false), /infringen las reglas de validación/);
  ctx.aplicarActualizacion_();
  ctx.api_guardarPrograma(prog, false);
  assert.ok(tabla(env, 'Cuentas').some(c => c.correo === 'rc.ana@usach.cl' && c.rol === 'Analista de Registro Curricular'));
  // Y la lista nueva sigue rechazando un rol inexistente
  assert.throws(() => hc.getRange(30, 3).setValue('Rol inventado'), /infringen/);
});

test('consulta no ve las plantillas de correo; edición sí', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'consulta@usach.cl';
  assert.throws(() => ctx.api_plantillas(), /nivel requerido/);
  assert.ok(ctx.api_bandeja().length > 0, 'la bandeja sigue disponible');
  estado.usuario = 'analista.uno@usach.cl';
  assert.ok(ctx.api_plantillas().length > 0);
});

test('programas: desactivar y reactivar desde Configuración; inactivo no se ofrece en el formulario web y sus casos siguen visibles', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'vice@usach.cl';
  const antes = ctx.api_config().programas.find(p => p.programa === 'Magíster en Prueba A');
  assert.equal(antes.activo, 'SÍ'); assert.ok(antes.en_curso >= 1, 'cuenta casos en curso');
  const r = ctx.api_activarPrograma('Magíster en Prueba A', 'NO');
  assert.equal(r.activo, 'NO'); assert.equal(r.enCurso, antes.en_curso);
  assert.equal(ctx.api_config().programas.find(p => p.programa === 'Magíster en Prueba A').activo, 'NO');
  estado.usuario = 'est1@usach.cl';
  assert.ok(ctx.api_inicioSolicitud().programas.indexOf('Magíster en Prueba A') < 0, 'el formulario web ya no lo ofrece');
  estado.usuario = 'vice@usach.cl';
  assert.ok(ctx.api_bandeja().some(s => s.programa === 'Magíster en Prueba A'), 'los casos siguen en la bandeja');
  assert.ok(tabla(env, 'Bitácora').some(b => /Programa desactivado: Magíster en Prueba A/.test(b.texto)));
  assert.equal(ctx.api_activarPrograma('Magíster en Prueba A', 'NO').sinCambios, true);
  ctx.api_activarPrograma('Magíster en Prueba A', 'SÍ');
  estado.usuario = 'est1@usach.cl';
  assert.ok(ctx.api_inicioSolicitud().programas.indexOf('Magíster en Prueba A') >= 0);
  estado.usuario = 'vice@usach.cl';
  assert.throws(() => ctx.api_activarPrograma('No existe', 'NO'), /no existe/);
  estado.usuario = 'analista.uno@usach.cl';
  assert.throws(() => ctx.api_activarPrograma('Magíster en Prueba A', 'NO'), /nivel requerido/);
});

test('correos que aluden a un envío por STD incluyen el número cuando está registrado y no dejan «N°» vacío cuando no', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  // 03/2026 (aceptada) sin STD: la vista previa de «aceptada» no menciona número
  const sinStd = ctx.componer_('aceptada', ctx.buscarSolicitud_('03/2026'), {});
  assert.ok(!/STD N°/.test(sinStd.cuerpo) && !/\(\)/.test(sinStd.cuerpo) && !/N°\s*[.,)]/.test(sinStd.cuerpo), sinStd.cuerpo);
  const rec0 = ctx.componer_('recordatorio_informe_rc', ctx.buscarSolicitud_('03/2026'), {});
  assert.match(rec0.cuerpo, /tramitada por STD\./);
  // Con STD registrado: aparece en admisible, CAE admisible, CAE rechazada y recordatorios
  ctx.api_guardarGestion('03/2026', { n_std: '4521' });
  const s = ctx.buscarSolicitud_('03/2026');
  assert.match(ctx.componer_('aceptada', s, {}).cuerpo, /Registro Curricular \(trámite STD N° 4521\) para la emisión/);
  assert.match(ctx.componer_('cae_admisible', s, {}).cuerpo, /en elaboración \(trámite STD N° 4521\), para su distribución/);
  assert.match(ctx.componer_('cae_rechazada', s, {}).cuerpo, /en elaboración \(trámite STD N° 4521\), para su distribución/);
  assert.match(ctx.componer_('recordatorio', s, {}).cuerpo, /Sistema de Trazabilidad Documental \(STD N° 4521\)/);
  assert.match(ctx.componer_('recordatorio_informe_rc', s, {}).cuerpo, /tramitada por STD N° 4521\./);
  assert.match(ctx.componer_('recordatorio_resolucion', s, {}).cuerpo, /\), STD N° 4521\./);
  // El número escrito en el mismo diálogo (campos) tiene prioridad sobre el guardado
  assert.match(ctx.componer_('cae_admisible', s, { n_std: '9999' }).cuerpo, /STD N° 9999/);
});

test('recordatorio al programa: copia a la analista de RC y la cuenta de RC del programa (y a Registro Curricular por la analista); la actualización agrega el evento al parámetro', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarPrograma({ programa: 'Magíster en Prueba A', correo_direccion: 'dir@usach.cl', analista: 'analista.uno@usach.cl', activo: 'SÍ',
    nuevo_analista_rc: { nombre: 'Ana RC', correo: 'rc.ana@usach.cl' }, nuevo_cuenta_rc: { nombre: 'RC Magíster A', correo: 'rc.magister@usach.cl' } }, false);
  // Planilla instalada con el valor antiguo del parámetro (sin «recordatorio»): la actualización lo agrega.
  const par = libro.getSheetByName('Parámetros');
  for (let f = 2; f <= par.getLastRow(); f++) if (par.datos[f - 1][0] === 'eventos_copia_rc') par.set(f, 2, 'aceptada, cae_admisible');
  const cambios = ctx.aplicarActualizacion_();
  assert.ok(cambios.some(c => /eventos_copia_rc: se agregó «recordatorio»/.test(c)));
  assert.equal(ctx.parametros_().eventos_copia_rc, 'aceptada, cae_admisible, recordatorio', 'conserva lo editado y suma el evento');
  assert.ok(!ctx.aplicarActualizacion_().some(c => /eventos_copia_rc/.test(c)), 'idempotente');
  // El recordatorio (manual o automático) lleva copia a ambas cuentas de RC del programa y a la registradora
  estado.usuario = 'analista.uno@usach.cl';
  const pv = ctx.api_previsualizarRecordatorio('05/2026');
  assert.equal(pv.evento, 'recordatorio');
  assert.deepEqual([...pv.correo.para], ['dir@usach.cl']);
  ['analista.uno@usach.cl', 'rc.ana@usach.cl', 'rc.magister@usach.cl', 'rc@usach.cl'].forEach(c => assert.ok(pv.correo.cc.indexOf(c) >= 0, 'cc ' + c + ' en ' + pv.correo.cc));
  // Lo mismo se refleja en «Lo que esta cuenta ve y recibe»
  estado.usuario = 'vice@usach.cl';
  const rs = ctx.api_cuentas().resumenes['rc.magister@usach.cl'];
  assert.ok(rs.copias.some(c => c.evento === 'recordatorio' && /Configuración/.test(c.origenes[0])));
});

test('bitácora: cada cambio en comentarios, observación, propuesta, resolución o STD queda con fecha, autor y contenido', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'analista.uno@usach.cl';
  const bitDe = () => ctx.api_expediente('03/2026').bitacora.filter(b => b.tipo === 'gestion');
  ctx.api_guardarGestion('03/2026', { comentarios_analista: 'Enviado a RC', n_std: '4521' });
  let b = bitDe();
  assert.equal(b.length, 2);
  assert.ok(b.every(x => x.fecha && x.quien === 'analista.uno@usach.cl'));
  assert.ok(b.some(x => x.texto === 'Comentarios analista: «Enviado a RC»'));
  assert.ok(b.some(x => x.texto === 'N° STD: «4521»'));
  // Agregar al final: solo lo agregado
  ctx.api_guardarGestion('03/2026', { comentarios_analista: 'Enviado a RC // 14.10 respuesta recibida' });
  assert.ok(bitDe().some(x => x.texto === 'Comentarios analista · agregado: «// 14.10 respuesta recibida»'));
  // Reescritura: antes → después; sin cambios: nada
  estado.usuario = 'vice@usach.cl';
  ctx.api_guardarGestion('03/2026', { obs_vicedecano: 'De acuerdo.', propuesta_comite: 'Aprobar' });
  ctx.api_guardarGestion('03/2026', { obs_vicedecano: 'Revisar atingencia.' });
  const n = bitDe().length;
  assert.ok(bitDe().some(x => x.texto === 'Observación Vicedecano/a: «De acuerdo.» → «Revisar atingencia.»' && x.quien === 'vice@usach.cl'));
  assert.equal(ctx.api_guardarGestion('03/2026', { obs_vicedecano: 'Revisar atingencia.' }).sinCambios, true);
  assert.equal(bitDe().length, n);
  // Analista y revisar siguen en la línea resumen, sin contenido
  ctx.api_guardarGestion('03/2026', { revisar: '' });
  const res = ctx.api_expediente('03/2026').bitacora.filter(x => /^Actualizado: /.test(x.texto));
  assert.ok(res.some(x => x.texto === 'Actualizado: revisar'));
});
