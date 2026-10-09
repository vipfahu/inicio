/**
 * Config.gs · Estructura de la planilla, parámetros y textos iniciales.
 * Los valores de esta hoja solo se usan al instalar: después se editan desde el panel o la planilla.
 */

const HOJAS = {
  solicitudes: 'Solicitudes',
  bitacora: 'Bitácora',
  plantillas: 'Plantillas',
  cuentas: 'Cuentas',
  programas: 'Programas',
  parametros: 'Parámetros',
  feriados: 'Feriados',
  archivos: 'Archivos'
};

const COLUMNAS = {
  Solicitudes: ['folio', 'fila_respuesta', 'fecha_recepcion', 'correo_verificado', 'apellido1', 'apellido2', 'nombres', 'run',
    'correo', 'telefono', 'programa', 'anio', 'semestre', 'tipo_catalogo', 'tipo_texto_libre', 'estado', 'estado_desde',
    'analista', 'n_std', 'comentarios_analista', 'obs_vicedecano', 'propuesta_comite', 'motivo', 'resolucion',
    'carpeta_id', 'recordatorios', 'ultimo_recordatorio', 'revisar', 'nota_migracion', 'actualizado', 'origen', 'fundamentacion'],
  'Bitácora': ['fecha', 'folio', 'tipo', 'quien', 'texto', 'estado_nuevo', 'evento', 'para', 'cc', 'asunto', 'editado'],
  Plantillas: ['evento', 'descripcion', 'para', 'cc', 'asunto', 'cuerpo', 'asunto_original', 'cuerpo_original', 'actualizado_por', 'actualizado_en'],
  Cuentas: ['correo', 'nombre', 'rol', 'nivel', 'programas', 'activo', 'recibe_eventos', 'creada_por', 'creada_en', 'notas'],
  Programas: ['programa', 'correo_direccion', 'analista', 'activo'],
  'Parámetros': ['clave', 'valor', 'descripcion'],
  Feriados: ['fecha', 'descripcion'],
  Archivos: ['fecha', 'folio', 'archivo_id', 'nombre', 'categoria', 'tamano_mb', 'subido_por']
};

/** Encabezados del Formulario (se buscan por el comienzo del texto, para tolerar cambios menores). */
const RESPUESTA = {
  marca: 'Marca temporal',
  correoVerificado: 'Dirección de correo electrónico',
  apellido1: 'Primer Apellido',
  apellido2: 'Segundo Apellido',
  nombres: 'Nombres',
  run: 'Rol Único Nacional',
  correo: 'Correo electrónico',
  telefono: 'Teléfono de contacto',
  programa: 'Programa de Postgrado',
  anio: 'Año asociado',
  semestre: 'Semestre asociado',
  tipos: 'Solicito autorización para',
  fundamentacion: 'Fundamentación',
  adjunto: 'Adjuntar antecedentes'
};

/** Columnas de gestión manual de la planilla anterior (solo se leen al migrar; luego se ocultan). */
const LEGADO = {
  presentacion: 'Estado de Presentación',
  estado: 'ESTADO',
  actual: 'ESTADO ACTUAL',
  analista: 'Analista a cargo',
  obsVicedecano: 'Observación Vicedecano',
  comentarios: 'Comentarios Analista',
  std: 'N° STD',
  extras: 'OBSERVACIONES EXTRAS',
  archivoCae: 'Archivo CAE',
  resolucion: 'archivo resolución'
};

const PARAMETROS_INICIALES = [
  ['vicedecano_nombre', 'Dr. Jorge Castillo S.', 'Nombre que aparece en los correos ({vicedecano}).'],
  ['remitente_nombre', 'Vicedecanato de Investigación y Postgrado · FAHU', 'Nombre visible del remitente.'],
  ['plazo_admisibilidad_dias', '2', 'Días hábiles desde la recepción para asignar analista e iniciar la revisión de admisibilidad.'],
  ['primer_aviso_admisibilidad_dias', '1', 'Días hábiles desde la recepción hasta el primer recordatorio de admisibilidad (luego, cada recordatorio_cada_dias).'],
  ['plazo_programa_dias', '2', 'Días hábiles que tiene el programa para pronunciarse.'],
  ['recordatorio_cada_dias', '2', 'Días hábiles entre recordatorios, una vez vencido el plazo.'],
  ['recordatorios_max', '3', 'Máximo de recordatorios por solicitud (0 = desactivados).'],
  ['max_mb_archivo', '20', 'Tamaño máximo por archivo subido desde el panel (MB). Gmail admite 25 MB por correo en total.'],
  ['max_mb_antecedente', '10', 'Formulario web: tamaño máximo por archivo de antecedentes (MB); hasta 3 archivos y 20 MB en total.'],
  ['max_solicitudes_dia', '3', 'Formulario web: máximo de solicitudes por cuenta en 24 horas.'],
  ['enlace_rc', 'COMPLETAR', 'Enlace a la plataforma de Registro Curricular FAHU ({enlace_rc}).'],
  ['compartido_permitido', '', 'Correos (separados por coma) que pueden tener acceso directo a la planilla. Vacío = solo la cuenta dueña.'],
  ['carpeta_raiz_id', '', 'Lo completa la instalación. Carpeta «Plataforma CAE · NO COMPARTIR».']
];

/** Feriados de fecha fija. Los feriados móviles (Viernes y Sábado Santo, San Pedro y San Pablo, Encuentro de Dos Mundos,
 *  Iglesias Evangélicas, elecciones, interferiados) deben agregarse a mano cada año desde una fuente oficial. */
function feriadosFijos_(anios) {
  const fijos = [['01-01', 'Año Nuevo'], ['05-01', 'Día del Trabajo'], ['05-21', 'Glorias Navales'], ['09-18', 'Independencia Nacional'],
    ['09-19', 'Glorias del Ejército'], ['11-01', 'Todos los Santos'], ['12-08', 'Inmaculada Concepción'], ['12-25', 'Navidad']];
  const out = [];
  anios.forEach(a => fijos.forEach(f => out.push([a + '-' + f[0], f[1]])));
  return out;
}

const FIRMA = '\n\nAtentamente,\n{analista}\nVicedecanato de Investigación y Postgrado · FAHU';

/** Se agrega a todo correo dirigido al estudiante. */
const SEGUIMIENTO = '\n\nPuede revisar el estado de su solicitud en cualquier momento, ingresando con la cuenta USACH con que envió el formulario, en: {enlace}';

/** [evento, descripción, para, cc, asunto, cuerpo] */
const PLANTILLAS_INICIALES = [
  ['recepcion', 'Recepción de la solicitud (automático)', 'Estudiante', '', 'Confirmación de recepción · Solicitud CAE {folio}',
    'Estimado/a {nombre}:\n\nJunto con saludarle cordialmente, le informamos que hemos recibido su Solicitud de Concesión Académica de Excepción (CAE), folio {folio}. Actualmente, el trámite se encuentra en etapa de revisión de antecedentes para evaluar su admisibilidad.\n\nPuede consultar el avance de su solicitud, ingresando con su cuenta USACH, en: {enlace}\n\nLe mantendremos informado/a sobre el avance o resolución de su solicitud.' + FIRMA],
  ['nueva_solicitud', 'Nueva solicitud recibida (automático, a todas las cuentas con acceso al panel)', 'Equipo', '', 'Nueva solicitud CAE · {folio} · {programa}',
    'Se ha recibido una nueva Solicitud de Concesión Académica de Excepción.\n\nFolio: {folio}\nEstudiante: {nombre}\nPrograma: {programa}\nTipo: {tipo}\nAnalista: {analista_asignada}\n\nExpediente: {enlace_panel}'],
  ['asignacion', 'Asignación de analista (automático)', 'Analista', '', 'Nueva solicitud CAE asignada · {folio}',
    'Se le ha asignado la solicitud {folio} de {nombre} ({programa}).\nTipo: {tipo}\n\nExpediente: {enlace_panel}'],
  ['aceptada', 'Admisible para análisis', 'Estudiante', 'Dirección de programa', 'Solicitud CAE {folio} · admisible para análisis',
    'Estimado/a {nombre}:\n\nJunto con saludar cordialmente, y por especial encargo del {vicedecano}, Vicedecano de Investigación y Postgrado de la FAHU, informo a usted que su Solicitud de Concesión Académica de Excepción (CAE), folio {folio}, ha sido declarada admisible para análisis.\n\nEsto significa que la solicitud cumple con los requisitos para ser estudiada; no constituye aún una resolución sobre lo solicitado.\n\nA continuación, la solicitud será remitida a la Unidad de Registro Curricular para la emisión del informe académico y, posteriormente, se solicitará el pronunciamiento del programa. La analista a cargo, {analista}, podrá contactarle si se requieren antecedentes adicionales.\n\nLa resolución final de su solicitud le será notificada vía correo electrónico.' + SEGUIMIENTO + FIRMA],
  ['rechazada', 'Presentación rechazada', 'Estudiante', 'Dirección de programa', 'Resultado de admisibilidad · Solicitud CAE {folio}',
    'Estimado/a {nombre}:\n\nJunto con saludar cordialmente, y en atención a su Solicitud de Concesión Académica de Excepción (CAE), cumplo con informar que, tras la revisión de sus antecedentes y de acuerdo con la normativa y procedimientos vigentes, no se ha aceptado la presentación de la solicitud.\n\nMotivo: {motivo}\n\nAnte cualquier duda o consulta, quedamos atentos.' + SEGUIMIENTO + FIRMA],
  ['no_procede', 'No procede · vía Registro Curricular', 'Estudiante', '', 'Solicitud CAE {folio} · debe ingresarse en Registro Curricular',
    'Estimado/a {nombre}:\n\nJunto con saludarle cordialmente, y en atención a su solicitud de Concesión Académica de Excepción (CAE), cumplo con informar que, tras la revisión de sus antecedentes y de acuerdo con la normativa y procedimientos vigentes, no procede dar continuidad al proceso por esta vía, por lo que la presente solicitud se dejará sin efecto.\n\nLo anterior se debe a que el trámite solicitado corresponde a una Concesión Académica que usted debe ingresar directamente a través de la plataforma de Registro Curricular: {enlace_rc}\n\nAnte cualquier duda o consulta, quedamos atentos.' + SEGUIMIENTO + FIRMA],
  ['vb', 'V°B° a la respuesta del Comité', 'Vicedecano/a', '', 'V°B° respuesta del Comité · Solicitud CAE {folio}',
    'Estimado/a Vicedecano/a:\n\nJunto con saludarle cordialmente, adjunto la respuesta emitida por el Comité del Programa respecto de la solicitud CAE {folio} de {nombre}, para su revisión y posterior V°B°.\n\nPropuesta del Comité: {propuesta_comite}\n\nExpediente: {enlace_panel}\n\nQuedo a su disposición ante cualquier duda o comentario.' + FIRMA],
  ['admisible_cae', 'Admisibilidad de la CAE (V°B° favorable; sigue a Registro Curricular vía STD)', 'Estudiante', '', 'Solicitud CAE {folio} · admisibilidad de la CAE',
    'Estimado/a {nombre}:\n\nJunto con saludar cordialmente, y por especial encargo del {vicedecano}, Vicedecano de Investigación y Postgrado de la FAHU, informo a usted que, considerando el informe académico de Registro Curricular y la propuesta del Comité del programa, su Solicitud de Concesión Académica de Excepción (CAE), folio {folio}, ha sido declarada admisible.\n\nEn consecuencia, la solicitud será remitida a la Unidad de Registro Curricular para la elaboración y tramitación de la resolución correspondiente.\n\nLa resolución final le será notificada vía correo electrónico.' + SEGUIMIENTO + FIRMA],
  ['resuelto', 'Resolución favorable', 'Estudiante', 'Dirección de programa', 'Resolución · Solicitud CAE {folio}',
    'Estimado/a {nombre}:\n\nJunto con saludar, se informa que su Solicitud de Concesión Académica de Excepción {folio} ha sido resuelta favorablemente. Resolución: {resolucion}.' + SEGUIMIENTO + FIRMA],
  ['negado', 'Resolución desfavorable', 'Estudiante', 'Dirección de programa', 'Resolución · Solicitud CAE {folio}',
    'Estimado/a {nombre}:\n\nJunto con saludar, se informa que su Solicitud de Concesión Académica de Excepción {folio} ha sido resuelta y no ha sido acogida. Resolución: {resolucion}.\n\nAnte cualquier duda o consulta, quedamos atentos.' + SEGUIMIENTO + FIRMA],
  ['recordatorio_admisibilidad', 'Recordatorio interno (automático): admisibilidad pendiente', 'Analista o equipo', '', 'Recordatorio · Solicitud CAE {folio} · admisibilidad pendiente',
    'La solicitud CAE {folio} de {nombre} ({programa}) fue recibida el {fecha_recepcion} y sigue en «Recibida».\n\nPendiente: {accion_admisibilidad}.\nPlazo: {plazo_admisibilidad} días hábiles desde la recepción (hasta el {vence_admisibilidad}).\nAnalista: {analista_asignada}\n\nExpediente: {enlace_panel}'],
  ['recordatorio', 'Recordatorio a la dirección de programa (automático): plazo de pronunciamiento vencido', 'Dirección de programa', 'Analista', 'Recordatorio · Solicitud CAE {folio} · pronunciamiento del programa pendiente',
    'Estimado/a Director/a:\n\nJunto con saludar cordialmente, le recordamos que el {fecha_solicitud_programa} se solicitó, a través del Sistema de Trazabilidad Documental (STD), el pronunciamiento del programa respecto de la Solicitud de Concesión Académica de Excepción {folio} de {nombre} ({programa}).\n\nEl plazo de {plazo} días hábiles para responder venció el {vence_programa}. Agradecemos enviar el pronunciamiento del Comité del programa a la brevedad, a través del mismo trámite en el STD.\n\nAnte cualquier duda, puede responder a este correo; la respuesta llegará a la analista a cargo, {analista}.' + FIRMA]
];
