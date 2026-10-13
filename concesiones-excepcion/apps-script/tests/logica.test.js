// Pruebas de las reglas puras (Logica.gs). Ejecutar: node --test concesiones-excepcion/apps-script/tests/
// Solo datos sintéticos: este repositorio es público.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../Logica.gs');

test('transiciones: solo las declaradas', () => {
  assert.ok(L.transicionValida('recibida', 'revision'));
  assert.ok(!L.transicionValida('recibida', 'resuelto'));
  assert.ok(L.transicionValida('informe_rc', 'programa'), 'la analista registra directo el envío al programa');
  assert.ok(!L.transicionValida('informe_rc', 'vb_informe'), 'ya no existe el V°B° al informe');
  assert.ok(!L.transicionValida('resuelto', 'revision'));
  assert.ok(L.esCierre('negado') && !L.esCierre('vb'));
});

test('el programa se consulta por STD: registrar el envío o la devolución no genera correo', () => {
  assert.equal(L.eventoTransicion('informe_rc', 'programa'), '');
  assert.equal(L.eventoTransicion('vb', 'programa'), '');
  assert.deepEqual([...L.camposRequeridos('vb', 'programa')], ['observacion']);
  assert.deepEqual([...L.camposRequeridos('informe_rc', 'programa')], []);
  assert.deepEqual([...L.camposRequeridos('revision', 'rechazada')], ['motivo']);
  assert.equal(L.eventoTransicion('revision', 'aceptada'), 'aceptada');
  assert.equal(L.eventoTransicion('aceptada', 'informe_rc'), '');
});

test('folios: normalización y correlativo', () => {
  assert.equal(L.normalizarFolio('01 /2025'), '01/2025');
  assert.equal(L.normalizarFolio('8 / 2026'), '08/2026');
  assert.equal(L.normalizarFolio(new Date(2026, 0, 1)), '01/2026');
  assert.equal(L.normalizarFolio(null), '');
  assert.equal(L.siguienteFolio(['01/2026', '33/2026', '05/2025', 'basura'], 2026), '34/2026');
  assert.equal(L.siguienteFolio([], 2027), '01/2027');
});

test('migración: vale el último estado no vacío (derecha a izquierda)', () => {
  assert.deepEqual(L.estadoMigrado('Rechazado', 'Negado', 'NO PROCEDE').estado, 'no_procede');
  assert.equal(L.estadoMigrado('Rechazado', '', '').estado, 'rechazada');
  assert.equal(L.estadoMigrado('Aprobado', 'Resuelto', 'RESUELTO').estado, 'resuelto');
  assert.equal(L.estadoMigrado('', '', '').estado, 'recibida');
  const t = L.estadoMigrado('Aprobado', 'En trámite', 'En trámite');
  assert.equal(t.estado, 'aceptada'); assert.ok(t.revisar);
  const r = L.estadoMigrado('en revisión', 'En trámite', 'En trámite');
  assert.equal(r.estado, 'revision'); assert.ok(r.revisar);
  const rc = L.estadoMigrado('Rechazado', '', '', 'Debe ingresarse en la página web y enviada a RC.');
  assert.equal(rc.estado, 'rechazada'); assert.ok(rc.revisar);
});

test('tipos: catálogo vs texto libre', () => {
  const s = L.separarTipos('Prórroga de Periodo Lectivo, Matrícula fuera de plazo');
  assert.equal(s.catalogo, 'Prórroga de Periodo Lectivo');
  assert.equal(s.libre, 'Matrícula fuera de plazo');
});

test('plantillas: variables faltantes quedan visibles', () => {
  assert.equal(L.rellenar('Hola {nombre}, folio {folio}', { nombre: 'Ana' }), 'Hola Ana, folio {folio}');
  assert.deepEqual(L.variablesSinResolver('Hola Ana, folio {folio} {folio} {std}'), ['folio', 'std']);
});

const cuentas = [
  { correo: 'analista.a@usach.cl', nombre: 'A', rol: 'Analista', nivel: 'edicion', activo: 'SÍ', recibe_eventos: '' },
  { correo: 'vice@usach.cl', nombre: 'V', rol: 'Vicedecano/a', nivel: 'administracion', activo: 'SÍ', recibe_eventos: '' },
  { correo: 'vice.antiguo@usach.cl', nombre: 'V0', rol: 'Vicedecano/a', nivel: 'consulta', activo: 'NO', recibe_eventos: '' },
  { correo: 'rc@usach.cl', nombre: 'RC', rol: 'Registro Curricular', nivel: 'sin_acceso', activo: 'SÍ', recibe_eventos: '' },
  { correo: 'coord@usach.cl', nombre: 'C', rol: 'Consulta', nivel: 'consulta', activo: 'SÍ', recibe_eventos: 'vb, registro' }
];
const programas = [{ programa: 'Magíster X', correo_direccion: 'dir.x@usach.cl' }, { programa: 'Magíster Y', correo_direccion: 'COMPLETAR' }];
const sol = { correo: 'Est@usach.cl', analista: 'analista.a@usach.cl', programa: 'Magíster X' };

test('destinatarios: roles → correos, sin inactivos ni duplicados', () => {
  const d = L.resolverDestinatarios('Vicedecano/a', '', { solicitud: sol, cuentas, programas, evento: 'vb' });
  assert.deepEqual(d.para, ['vice@usach.cl']);
  assert.deepEqual(d.cc, ['coord@usach.cl']);
  assert.deepEqual(d.faltantes, []);
  const e = L.resolverDestinatarios('Estudiante', 'Dirección de programa, Analista', { solicitud: sol, cuentas, programas, evento: 'aceptada' });
  assert.deepEqual(e.para, ['est@usach.cl']);
  assert.deepEqual(e.cc, ['dir.x@usach.cl', 'analista.a@usach.cl']);
});

test('destinatarios: el estudiante recibe en la cuenta de inicio de sesión y en el correo del formulario (sin repetir)', () => {
  const dos = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: 'Ingreso@usach.cl', correo: 'otro@gmail.com' }, cuentas, programas });
  assert.deepEqual(dos.para, ['ingreso@usach.cl', 'otro@gmail.com']);
  const igual = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: 'est@usach.cl', correo: ' EST@usach.cl ' }, cuentas, programas });
  assert.deepEqual(igual.para, ['est@usach.cl']);
  const soloForm = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: '' }, cuentas, programas });
  assert.deepEqual(soloForm.para, ['est@usach.cl']);
  const ninguno = L.resolverDestinatarios('Estudiante', '', { solicitud: { ...sol, correo_verificado: '', correo: '' }, cuentas, programas });
  assert.equal(ninguno.faltantes.length, 1);
});

test('destinatarios: sin correo de dirección del programa, el correo al estudiante igual sale (se omite la copia)', () => {
  const d = L.resolverDestinatarios('Estudiante', 'Dirección de programa', { solicitud: { ...sol, programa: 'Magíster Y' }, cuentas, programas, evento: 'aceptada' });
  assert.deepEqual(d.para, ['est@usach.cl']);
  assert.deepEqual(d.cc, []);
  assert.deepEqual(d.faltantes, []);
  assert.equal(d.omitidos.length, 1);
  const sinPrograma = L.resolverDestinatarios('Estudiante', 'Dirección de programa', { solicitud: { ...sol, programa: 'Inexistente' }, cuentas, programas });
  assert.deepEqual(sinPrograma.faltantes, []);
});

test('destinatarios: un programa sin correo de dirección bloquea el envío cuando la dirección es destinataria principal', () => {
  const d = L.resolverDestinatarios('Dirección de programa', '', { solicitud: { ...sol, programa: 'Magíster Y' }, cuentas, programas });
  assert.equal(d.para.length, 0);
  assert.equal(d.faltantes.length, 1);
});

test('días hábiles: excluye fines de semana y feriados', () => {
  // vie 2026-09-11 → mar 2026-09-22, con 18 y 19 de septiembre feriados (vie y sáb)
  assert.equal(L.diasHabilesEntre(new Date(2026, 8, 11), new Date(2026, 8, 22), ['2026-09-18', '2026-09-19']), 6);
  assert.equal(L.diasHabilesEntre(new Date(2026, 8, 11), new Date(2026, 8, 11), []), 0);
});

test('recordatorios: tras vencer el plazo, cada N días hábiles, hasta el máximo', () => {
  const p = { plazo_programa_dias: 2, recordatorio_cada_dias: 2, recordatorios_max: 3 };
  const base = { estado: 'programa', estado_desde: new Date(2026, 9, 5), recordatorios: 0 }; // lun 05-10
  assert.ok(!L.necesitaRecordatorio(base, new Date(2026, 9, 7), p, []));   // 2 días: dentro del plazo
  assert.ok(L.necesitaRecordatorio(base, new Date(2026, 9, 8), p, []));    // 3 días: vencido
  const uno = { ...base, recordatorios: 1, ultimo_recordatorio: new Date(2026, 9, 8) };
  assert.ok(!L.necesitaRecordatorio(uno, new Date(2026, 9, 9), p, []));
  assert.ok(L.necesitaRecordatorio(uno, new Date(2026, 9, 12), p, []));
  assert.ok(!L.necesitaRecordatorio({ ...uno, recordatorios: 3 }, new Date(2026, 9, 30), p, []));
  assert.ok(!L.necesitaRecordatorio({ ...base, estado: 'resolucion' }, new Date(2026, 9, 30), p, []));
  assert.equal(L.recordatorioPendiente({ ...base, estado: 'vb' }, new Date(2026, 9, 30), { ...p, plazo_vb_dias: 2 }, []), 'recordatorio_vb');
});

test('recordatorio de admisibilidad: primer aviso al día hábil siguiente a la recepción', () => {
  const p = { plazo_admisibilidad_dias: 2, primer_aviso_admisibilidad_dias: 1, plazo_programa_dias: 2, recordatorio_cada_dias: 2, recordatorios_max: 3 };
  const base = { estado: 'recibida', estado_desde: new Date(2026, 9, 5, 15, 0), recordatorios: 0 }; // lun 05-10, 15:00
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 5, 18, 0), p, []), '', 'el mismo día no');
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 6, 8, 0), p, []), 'recordatorio_admisibilidad', 'mar 08:00: primer aviso');
  const viernes = { ...base, estado_desde: new Date(2026, 9, 9, 10, 0) };
  assert.equal(L.recordatorioPendiente(viernes, new Date(2026, 9, 10, 8, 0), p, []), '', 'sábado no cuenta');
  assert.equal(L.recordatorioPendiente(viernes, new Date(2026, 9, 12, 8, 0), p, []), 'recordatorio_admisibilidad', 'lunes siguiente');
  const uno = { ...base, recordatorios: 1, ultimo_recordatorio: new Date(2026, 9, 6, 8, 0) };
  assert.equal(L.recordatorioPendiente(uno, new Date(2026, 9, 7, 8, 0), p, []), '');
  assert.equal(L.recordatorioPendiente(uno, new Date(2026, 9, 8, 8, 0), p, []), 'recordatorio_admisibilidad', 'luego cada 2 días hábiles');
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 6, 8, 0), { ...p, primer_aviso_admisibilidad_dias: '' }, []), 'recordatorio_admisibilidad', 'por defecto, 1 día');
  // vence el plazo de 2 días hábiles: lun 05-10 → mié 07-10; con feriado el 06 → jue 08-10
  assert.equal(L.sumarDiasHabiles(new Date(2026, 9, 5), 2, []).getDate(), 7);
  assert.equal(L.sumarDiasHabiles(new Date(2026, 9, 5), 2, ['2026-10-06']).getDate(), 8);
  assert.equal(L.recordatorioPendiente({ ...base, estado: 'revision' }, new Date(2026, 9, 30), p, []), '', 'abierta la revisión, no hay recordatorio');
  assert.equal(L.recordatorioPendiente({ ...base, estado: 'programa' }, new Date(2026, 9, 8), p, []), 'recordatorio');
  assert.equal(L.recordatorioPendiente(base, new Date(2026, 9, 8), { ...p, recordatorios_max: 0 }, []), '');
});

test('destinatario «Analista o equipo»: la asignada, o quienes pueden asignar', () => {
  const sinAnalista = L.resolverDestinatarios('Analista o equipo', '', { solicitud: { ...sol, analista: '' }, cuentas, programas });
  assert.deepEqual(sinAnalista.para, ['analista.a@usach.cl', 'vice@usach.cl']);
  const conAnalista = L.resolverDestinatarios('Analista o equipo', '', { solicitud: sol, cuentas, programas });
  assert.deepEqual(conAnalista.para, ['analista.a@usach.cl']);
});

test('feriados desde el calendario: excluye conmemoraciones y expande eventos de varios días', () => {
  const ev = [
    { inicio: '2026-09-18', fin: '2026-09-19', titulo: 'Independencia', descripcion: 'Feriado público' },
    { inicio: '2026-09-19', fin: '2026-09-21', titulo: 'Glorias + interferiado', descripcion: 'Feriado público' },
    { inicio: '2026-05-10', fin: '2026-05-11', titulo: 'Día de la Madre', descripcion: 'Celebración' },
    { inicio: '2026-08-10', fin: '2026-08-11', titulo: 'Algo', descripcion: 'Observance\nTo hide observances…' },
    { inicio: '2026-09-18', fin: '2026-09-19', titulo: 'Independencia (repetido)', descripcion: '' }
  ];
  assert.deepEqual([...L.feriadosDesdeEventos(ev)], ['2026-09-18', '2026-09-19', '2026-09-20']);
  assert.deepEqual([...L.feriadosDesdeEventos([])], []);
  // Con feriados, el vencimiento se corre: vie 18-09 (feriado) no cuenta
  assert.equal(L.sumarDiasHabiles(new Date(2026, 8, 17), 1, ['2026-09-18']).getDate(), 21);
});

test('RUN: dígito verificador módulo 11, formato normalizado y pasaporte', () => {
  assert.equal(L.normalizarRun('12.345.678-5'), '12.345.678-5');
  assert.equal(L.normalizarRun('123456785'), '12.345.678-5');
  assert.equal(L.normalizarRun(' 12345678 - 5 '), '12.345.678-5');
  assert.equal(L.normalizarRun('12.345.678-9'), '', 'dígito verificador incorrecto');
  assert.equal(L.normalizarRun('11.111.111-1'), '11.111.111-1');
  assert.equal(L.normalizarRun('7.654.321-6'), '7.654.321-6');
  // DV «K» y «0»
  const conK = ['10000013', '10000021', '10000030'].map(c => c + (() => { let s = 0, m = 2; for (let i = c.length - 1; i >= 0; i--) { s += Number(c[i]) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); })());
  conK.forEach(r => assert.ok(L.normalizarRun(r.toLowerCase()), 'acepta ' + r));
  assert.equal(L.normalizarRun('123'), '');
  assert.equal(L.normalizarRun('abc'), '');
  assert.equal(L.normalizarPasaporte('ab 123-4567'), 'AB1234567');
  assert.equal(L.normalizarPasaporte('12'), '');
});

test('niveles y alcance por programa', () => {
  assert.ok(L.nivelSuficiente('administracion', 'edicion'));
  assert.ok(!L.nivelSuficiente('consulta', 'edicion'));
  assert.ok(!L.nivelSuficiente('edicion', 'inexistente'));
  assert.ok(L.puedeVerSolicitud({ programas: 'todos' }, { programa: 'Z' }));
  assert.ok(L.puedeVerSolicitud({ programas: 'Magíster X; Magíster Y' }, { programa: 'Magíster Y' }));
  assert.ok(!L.puedeVerSolicitud({ programas: 'Magíster X' }, { programa: 'Magíster Y' }));
});

test('cuentas: validación y última administración', () => {
  const duenia = 'institucional@usach.cl';
  const nueva = { correo: 'nueva@usach.cl', nombre: 'N', rol: 'Analista', nivel: 'edicion', activo: 'SÍ' };
  assert.equal(L.validarCuenta(nueva, cuentas, duenia, true), '');
  assert.match(L.validarCuenta({ ...nueva, correo: 'x@gmail.com' }, cuentas, duenia, true), /@usach\.cl/);
  assert.match(L.validarCuenta({ ...nueva, correo: 'vice@usach.cl' }, cuentas, duenia, true), /Ya existe/);
  assert.match(L.validarCuenta({ ...cuentas[1], nivel: 'edicion' }, cuentas, duenia, false), /al menos una/);
  assert.match(L.validarCuenta({ ...cuentas[1], activo: 'NO' }, cuentas, duenia, false), /al menos una/);
  assert.match(L.validarCuenta({ ...nueva, correo: duenia }, cuentas, duenia, true), /dueña/);
});

test('Apps Script: ningún .gs y .html comparten nombre (el editor no lo permite)', () => {
  const fs = require('fs');
  const path = require('path');
  const nombres = fs.readdirSync(path.join(__dirname, '..')).filter(f => /\.(gs|html)$/.test(f)).map(f => f.replace(/\.(gs|html)$/, ''));
  const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  assert.deepEqual(repetidos, []);
});

test('HTML: ningún enlace dentro de otro enlace (el navegador los separa y la imagen pierde su estilo)', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..');
  fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    let abiertos = 0;
    const html = fs.readFileSync(path.join(dir, f), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    for (const m of html.matchAll(/<(\/?)a[\s>]/gi)) {
      abiertos += m[1] ? -1 : 1;
      assert.ok(abiertos <= 1, f + ': enlace anidado cerca de «' + html.slice(m.index, m.index + 80) + '»');
    }
  });
});

test('«por especial encargo»: del + grado, de la + grado femenino, de sin grado', () => {
  assert.equal(L.encargoDe('Dr. Juan Pérez S.'), 'del Dr. Juan Pérez S.');
  assert.equal(L.encargoDe('Mg. Ana Soto'), 'del Mg. Ana Soto');
  assert.equal(L.encargoDe('Lic. Pedro Rojas'), 'del Lic. Pedro Rojas');
  assert.equal(L.encargoDe('Dra. Ana Soto'), 'de la Dra. Ana Soto');
  assert.equal(L.encargoDe('dr Juan Pérez'), 'del dr Juan Pérez');
  assert.equal(L.encargoDe('Juan Pérez Soto'), 'de Juan Pérez Soto');
  assert.equal(L.encargoDe('Drago Kusanovic'), 'de Drago Kusanovic'); // nombre que empieza como un grado
  assert.equal(L.encargoDe(''), '');
});

test('visor: tipo según nombre, MIME y entradas útiles de un ZIP', () => {
  assert.equal(L.tipoVista('Certificado.PDF'), 'pdf');
  assert.equal(L.tipoVista('foto.jpeg'), 'imagen');
  assert.equal(L.tipoVista('carta.docx'), 'word');
  assert.equal(L.tipoVista('carta.odt'), 'word');
  assert.equal(L.tipoVista('antecedentes.zip'), 'zip');
  assert.equal(L.tipoVista('planilla.xlsx'), '');
  assert.equal(L.mimePorNombre('a/b/carta.DOCX'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(L.mimePorNombre('sin-extension'), 'application/octet-stream');
  assert.ok(L.entradaZipUtil('docs/certificado.pdf'));
  ['docs/', '__MACOSX/docs/._certificado.pdf', 'docs/.DS_Store', 'Thumbs.db', ''].forEach(n => assert.ok(!L.entradaZipUtil(n), n));
});

test('HTML: el JavaScript de cada página se puede interpretar (un error de sintaxis deja la página en blanco)', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..');
  fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new Function(m[1].replace(/<\?[\s\S]*?\?>/g, '""')), f + ': error de sintaxis en un <script>');
    }
  });
});

test('ruta del proceso: camino principal, variantes de cierre y paso actual', () => {
  const ids = r => [...r].map(p => p.id);
  const actual = r => r.find(p => p.situacion === 'actual').id;
  const r1 = L.rutaProceso('programa', []);
  assert.deepEqual(ids(r1), ['recibida', 'revision', 'aceptada', 'informe_rc', 'programa', 'vb', 'aviso_rc', 'rc_notificado', 'resolucion', 'resuelto']);
  assert.equal(actual(r1), 'programa');
  assert.deepEqual([...r1].slice(0, 4).map(p => p.situacion), ['hecho', 'hecho', 'hecho', 'hecho']);
  assert.equal(r1[5].situacion, 'pendiente');
  assert.equal(r1.find(p => p.id === 'aviso_rc').estudiante, 'CAE admisible · coordinación con Registro Curricular');
  assert.deepEqual(ids(L.rutaProceso('rechazada', [])), ['recibida', 'revision', 'rechazada']);
  assert.deepEqual(ids(L.rutaProceso('no_procede', [])), ['recibida', 'revision', 'no_procede']);
  assert.deepEqual(ids(L.rutaProceso('rechazo_vb', [])).slice(-3), ['vb', 'rechazo_vb', 'negado']);
  assert.deepEqual(ids(L.rutaProceso('negado', ['vb', 'rechazo_vb', 'negado'])).slice(-2), ['rechazo_vb', 'negado']);
  assert.deepEqual(ids(L.rutaProceso('negado', ['vb', 'aviso_rc', 'rc_notificado', 'resolucion', 'negado'])).slice(-2), ['resolucion', 'negado']);
  // Transiciones nuevas
  assert.ok(L.transicionValida('vb', 'aviso_rc'));
  assert.ok(!L.transicionValida('vb', 'resolucion'), 'el estudiante no se notifica antes de avisar a Registro Curricular');
  assert.ok(L.transicionValida('aviso_rc', 'rc_notificado'));
  assert.ok(L.transicionValida('rc_notificado', 'resolucion'));
  assert.deepEqual([...L.camposRequeridos('aviso_rc', 'rc_notificado')], ['notificacion_rc']);
  assert.equal(L.eventoTransicion('rc_notificado', 'resolucion'), 'cae_admisible');
  assert.equal(L.eventoTransicion('vb', 'aviso_rc'), '');
});

test('Registro Curricular: copias por programa, sin aviso de «Equipo», y nivel máximo Consulta', () => {
  const cuentas = [
    { correo: 'registradora@usach.cl', rol: 'Registro Curricular', nivel: 'consulta', programas: 'todos', activo: 'SÍ', recibe_eventos: 'cae_admisible' },
    { correo: 'rc.mag@usach.cl', rol: 'Analista de Registro Curricular', nivel: 'sin_acceso', programas: 'Magíster A', activo: 'SÍ', recibe_eventos: 'cae_admisible, cae_rechazada' },
    { correo: 'rc.doc@usach.cl', rol: 'Analista de Registro Curricular', nivel: 'consulta', programas: 'Doctorado B', activo: 'SÍ', recibe_eventos: 'cae_admisible' },
    { correo: 'ana@usach.cl', rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'SÍ' }
  ];
  const sol = { programa: 'Magíster A', correo_verificado: 'est@usach.cl', analista: 'ana@usach.cl' };
  const r = L.resolverDestinatarios('Estudiante', '', { cuentas, solicitud: sol, evento: 'cae_admisible' });
  assert.deepEqual([...r.cc].sort(), ['rc.mag@usach.cl', 'registradora@usach.cl'], 'la cuenta de otro programa no recibe copia');
  const eq = L.resolverDestinatarios('Equipo', '', { cuentas, solicitud: sol, evento: 'nueva_solicitud' });
  assert.deepEqual([...eq.para], ['ana@usach.cl'], 'las cuentas de Registro Curricular no reciben «Nueva solicitud» salvo que lo marquen');
  const porRol = L.resolverDestinatarios('Analista de Registro Curricular', '', { cuentas, solicitud: sol });
  assert.deepEqual([...porRol.para], ['rc.mag@usach.cl']);
  const base = { correo: 'nueva.rc@usach.cl', nombre: 'Nueva RC', rol: 'Analista de Registro Curricular', programas: 'todos', activo: 'SÍ' };
  const admin = [{ correo: 'admin@usach.cl', nivel: 'administracion', activo: 'SÍ' }];
  assert.match(L.validarCuenta({ ...base, nivel: 'edicion' }, admin, 'duenia@usach.cl', true), /Sin acceso.*Consulta/);
  assert.equal(L.validarCuenta({ ...base, nivel: 'consulta' }, admin, 'duenia@usach.cl', true), '');
});

test('Registro Curricular asignado al programa: copias de las comunicaciones y arrastre a la registradora', () => {
  const cuentas = [
    { correo: 'registradora@usach.cl', rol: 'Registro Curricular', nivel: 'consulta', programas: 'todos', activo: 'SÍ' },
    { correo: 'rc.ana@usach.cl', rol: 'Analista de Registro Curricular', nivel: 'sin_acceso', programas: 'todos', activo: 'SÍ' },
    { correo: 'rc.magister@usach.cl', rol: 'Cuenta de Registro Curricular del programa', nivel: 'sin_acceso', programas: 'Magíster A', activo: 'SÍ' }
  ];
  const programas = [{ programa: 'Magíster A', analista_rc: 'rc.ana@usach.cl', cuenta_rc: 'rc.magister@usach.cl' }, { programa: 'Doctorado B', cuenta_rc: 'rc.magister@usach.cl' }];
  const sol = { programa: 'Magíster A', correo_verificado: 'est@usach.cl' };
  const ctx = ev => ({ cuentas, programas, solicitud: sol, evento: ev, eventosRC: ['aceptada', 'cae_admisible'] });
  const r = L.resolverDestinatarios('Estudiante', '', ctx('cae_admisible'));
  assert.deepEqual([...r.cc].sort(), ['rc.ana@usach.cl', 'rc.magister@usach.cl', 'registradora@usach.cl'], 'analista y cuenta del programa; la registradora por arrastre');
  assert.deepEqual([...L.resolverDestinatarios('Estudiante', '', ctx('vb')).cc], [], 'solo los correos del parámetro eventos_copia_rc');
  // Sin analista de RC asignada no hay arrastre a la registradora
  const r2 = L.resolverDestinatarios('Estudiante', '', { ...ctx('aceptada'), solicitud: { ...sol, programa: 'Doctorado B' } });
  assert.deepEqual([...r2.cc], ['rc.magister@usach.cl']);
  // Cuenta asignada pero inactiva: se omite y se avisa, sin bloquear el envío
  const r3 = L.resolverDestinatarios('Estudiante', '', { ...ctx('aceptada'), cuentas: cuentas.map(c => c.correo === 'rc.magister@usach.cl' ? { ...c, activo: 'NO' } : c) });
  assert.ok(r3.omitidos.some(x => /cuenta de Registro Curricular del programa/.test(x)));
  assert.deepEqual([...r3.faltantes], []);
  // Una analista de RC que recibe copia por «Recibe copia» también arrastra a la registradora
  const r4 = L.resolverDestinatarios('Estudiante', '', { cuentas: cuentas.map(c => c.correo === 'rc.ana@usach.cl' ? { ...c, recibe_eventos: 'rechazada' } : c), programas: [], solicitud: sol, evento: 'rechazada', eventosRC: [] });
  assert.deepEqual([...r4.cc].sort(), ['rc.ana@usach.cl', 'registradora@usach.cl']);
});

test('resumenCuenta: qué ve y qué recibe cada cuenta se deriva de las reglas de envío, no de lo marcado a mano', () => {
  const plantillas = [
    { evento: 'nueva_solicitud', descripcion: 'Nueva solicitud', para: 'Equipo', cc: '' },
    { evento: 'asignacion', descripcion: 'Asignación', para: 'Analista', cc: '' },
    { evento: 'aceptada', descripcion: 'Admisible', para: 'Estudiante', cc: 'Dirección de programa' },
    { evento: 'vb', descripcion: 'V°B°', para: 'Vicedecano/a', cc: '' },
    { evento: 'cae_admisible', descripcion: 'CAE admisible', para: 'Estudiante', cc: '' }
  ];
  const programas = [
    { programa: 'Magíster A', analista: 'ana@usach.cl', analista_rc: 'rc.ana@usach.cl', cuenta_rc: 'rc.a@usach.cl', activo: 'SÍ' },
    { programa: 'Magíster B', analista: '', analista_rc: '', cuenta_rc: '', activo: 'SÍ' }
  ];
  const cuentas = [
    { correo: 'ana@usach.cl', rol: 'Analista', nivel: 'edicion', programas: 'todos', activo: 'SÍ', recibe_eventos: '' },
    { correo: 'rc.ana@usach.cl', rol: 'Analista de Registro Curricular', nivel: 'sin_acceso', programas: 'todos', activo: 'SÍ', recibe_eventos: 'vb' },
    { correo: 'rc.a@usach.cl', rol: 'Cuenta de Registro Curricular del programa', nivel: 'sin_acceso', programas: 'Magíster B', activo: 'SÍ', recibe_eventos: '' },
    { correo: 'registradora@usach.cl', rol: 'Registro Curricular', nivel: 'consulta', programas: 'todos', activo: 'NO', recibe_eventos: '' }
  ];
  const ctx = { programas, plantillas, eventosRC: ['aceptada', 'cae_admisible'], cuentas };
  const ana = L.resumenCuenta(cuentas[0], ctx);
  assert.ok(ana.programas.todos);
  assert.deepEqual([...ana.programas.asignaciones].map(a => a.campo + ':' + a.programa), ['analista:Magíster A']);
  assert.deepEqual([...ana.copias].map(c => c.evento), ['nueva_solicitud', 'asignacion'], 'sin nada marcado, recibe lo de su rol y nivel');
  assert.match(ana.copias[1].origenes[0], /analista asignada/);
  // Cuenta de RC asignada en Configuración a un programa que NO está entre los que ve: recibe igual, y se advierte.
  const rcA = L.resumenCuenta(cuentas[2], ctx);
  assert.deepEqual([...rcA.copias].map(c => c.evento), ['aceptada', 'cae_admisible']);
  assert.match(rcA.copias[0].origenes[0], /Configuración a «Magíster A»/);
  assert.deepEqual([...rcA.programas.sinVista], ['Magíster A']);
  assert.match(rcA.acceso, /solo recibe correos/);
  // Registro Curricular hereda lo que recibe su analista: lo asignado por programa y lo marcado en la cuenta de la analista.
  const reg = L.resumenCuenta(cuentas[3], ctx);
  assert.equal(reg.activa, false);
  assert.deepEqual([...reg.copias].map(c => c.evento), ['aceptada', 'vb', 'cae_admisible']);
  assert.match(reg.copias[1].origenes[0], /marcado en la cuenta de rc\.ana@usach\.cl/);
  assert.match(reg.copias[0].origenes[0], /analista de Registro Curricular de «Magíster A»/);
  // Una cuenta con programas restringidos ve solo esos, y lo marcado queda acotado a ellos.
  const vice = L.resumenCuenta({ correo: 'v@usach.cl', rol: 'Vicedecano/a', nivel: 'administracion', programas: 'Magíster B', activo: 'SÍ', recibe_eventos: 'aceptada' }, ctx);
  assert.deepEqual([...vice.programas.lista], ['Magíster B']);
  assert.deepEqual([...vice.copias].map(c => c.evento + '|' + c.origenes.join('/')), ['nueva_solicitud|a todas las cuentas con acceso al panel (solo de los programas que ve)', 'aceptada|marcado en esta cuenta (solo de los programas que ve)', 'vb|por su rol «Vicedecano/a» (solo de los programas que ve)']);
});

test('recordatorio manual: solo en pasos que esperan respuesta ajena, con la misma plantilla que el automático', () => {
  assert.equal(L.recordatorioManual('programa'), L.RECORDATORIOS.programa.evento);
  assert.equal(L.recordatorioManual('vb'), L.RECORDATORIOS.vb.evento);
  assert.equal(L.recordatorioManual('recibida'), L.RECORDATORIOS.recibida.evento);
  assert.equal(L.recordatorioManual('informe_rc'), 'recordatorio_informe_rc');
  assert.equal(L.recordatorioManual('resolucion'), 'recordatorio_resolucion');
  ['aceptada', 'revision', 'aviso_rc', 'rc_notificado', 'resuelto', 'negado', 'rechazada', 'no_procede', 'rechazo_vb'].forEach(x => assert.equal(L.recordatorioManual(x), '', x));
  Object.values(L.RECORDATORIO_MANUAL).forEach(ev => assert.ok(L.ESTADOS.length && ev, ev));
});

test('rellenar: una variable vacía bloquea, salvo las opcionales (frases accesorias como la referencia al STD)', () => {
  assert.equal(L.rellenar('a {x} b', { x: '' }), 'a {x} b');
  assert.equal(L.rellenar('a{std_frase} b', { std_frase: '' }), 'a b');
  assert.equal(L.rellenar('a{std_frase} b', { std_frase: ' (trámite STD N° 1)' }), 'a (trámite STD N° 1) b');
  assert.deepEqual([...L.variablesSinResolver(L.rellenar('{folio}{std_frase}', { folio: '', std_frase: '' }))], ['folio']);
});
