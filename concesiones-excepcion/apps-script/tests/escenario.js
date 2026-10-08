// Escenario sintético compartido por las pruebas: imita los problemas reales de la planilla sin datos personales.
const { crearEntorno } = require('./simulador');

const ENC = ['', 'Marca temporal', 'Dirección de correo electrónico', 'Primer Apellido', 'Segundo Apellido', 'Nombres',
  'Rol Único Nacional (RUN) o Pasaporte', 'Correo electrónico', 'Teléfono de contacto', 'Programa de Postgrado en que participa.',
  'Año asociado a la solicitud', 'Semestre asociado a la solicitud', 'Solicito autorización para:',
  'Fundamentación (relate los antecedentes o integre los argumentos que se asocian a la solicitud de excepción)',
  'Adjuntar antecedentes (si se trata de más de un archivo, adjuntar en un único archivo comprimido .zip, tamaño máximo 100 MB)',
  'Estado de Presentación ', 'ESTADO', 'Analista a cargo', 'Observación Vicedecano/a',
  'Comentarios Analista Vicedecanato de Investigación y Postgrado', 'N° STD', 'OBSERVACIONES EXTRAS', 'ESTADO ACTUAL',
  'Archivo CAE', 'archivo resolución', ''];

function fila(folio, fecha, n, estados, extra) {
  const [pres, est, act] = estados;
  const e = extra || {};
  return [folio, fecha, 'est' + n + '@usach.cl', 'Apellido' + n, 'Segundo' + n, 'Nombre' + n, '11.111.11' + n + '-1', 'est' + n + '@usach.cl',
    '+5690000000' + n, e.programa || 'Magíster en Prueba A', 2026, e.semestre || 'Semestre I', e.tipos || 'Renuncia', 'Fundamentación confidencial ' + n,
    e.adjunto || '', pres, est, e.analista === undefined ? 'Analista Uno' : e.analista, '', e.com || '', e.std || '', e.ext || '', act, '', '', e.z || ''];
}

function preparar() {
  const env = crearEntorno();
  const { ctx, estado, hoja } = env;
  const adj = env.archivo('adjFormularioUno1234', 'antecedentes.zip', 90 * 1048576, 'application/zip');
  estado.archivos.adjFormularioUno1234 = adj;
  const datos = [
    ENC,
    fila(new Date(2026, 0, 1), new Date(2026, 0, 15), 1, ['Aprobado', 'Resuelto', 'Resuelto'], { com: 'Enviado a RC // con fecha 01.02', adjunto: 'https://drive.google.com/open?id=adjFormularioUno1234' }),
    fila('02 / 2026', new Date(2026, 1, 1), 2, ['Rechazado', 'Negado', 'NO PROCEDE']),
    fila('03/2026', new Date(2026, 1, 2), 3, ['Aprobado', 'En trámite', 'En trámite'], { tipos: 'Matrícula fuera de plazo' }),
    fila('03/2026', new Date(2026, 1, 3), 4, ['en revisión', 'programa', 'programa'], { semestre: 'primer semestre de 2026' }),
    fila('04/2026', new Date(2026, 1, 4), 5, ['Rechazado', '', ''], { com: 'Debe ingresarse en la página web y enviada a RC.' }),
    fila('', new Date(2026, 1, 5), 6, ['', '', ''], { analista: '' })
  ];
  datos.forEach((r, i) => r.forEach((v, j) => hoja.set(i + 1, j + 1, v)));
  return env;
}

function instalar(env) {
  const { ctx, estado } = env;
  estado.usuario = estado.duenia;
  ctx.instalarPaso1();
  const L = env.libro;
  const cuentas = L.getSheetByName('Cuentas');
  // La persona completa los correos y crea la administración humana.
  cuentas.set(2, 1, 'analista.uno@usach.cl');
  cuentas.appendRow(['vice@usach.cl', 'Vice Decano', 'Vicedecano/a', 'administracion', 'todos', 'SÍ', '', '', '', '']);
  cuentas.appendRow(['rc@usach.cl', 'Registro', 'Registro Curricular', 'sin_acceso', 'todos', 'SÍ', '', '', '', '']);
  cuentas.appendRow(['consulta@usach.cl', 'Solo Consulta', 'Consulta', 'consulta', 'todos', 'SÍ', 'vb', '', '', '']);
  const prog = L.getSheetByName('Programas');
  for (let f = 2; f <= prog.getLastRow(); f++) { prog.set(f, 2, 'dir' + f + '@usach.cl'); prog.set(f, 3, 'analista.uno@usach.cl'); }
  const par = L.getSheetByName('Parámetros');
  for (let f = 2; f <= par.getLastRow(); f++) if (par.datos[f - 1][0] === 'enlace_rc') par.set(f, 2, 'https://rc.example/fahu');
  ctx.instalarPaso2();
  return env;
}

module.exports = { ENC, fila, preparar, instalar };
