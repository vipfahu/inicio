"""Genera cae/formulario-solicitud-cae.pdf: formulario rellenable para solicitar una CAE sin cuenta @usach.cl.

Replica los campos del formulario web (Solicitud.html). Uso, desde la raíz del repositorio:
    python3 concesiones-excepcion/apps-script/herramientas/formulario_sin_cuenta.py
Requiere reportlab. Si cambian los tipos de concesión (TIPOS_CATALOGO en Logica.gs), actualizar TIPOS y regenerar.
"""
import os
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SALIDA = os.path.join(RAIZ, 'cae', 'formulario-solicitud-cae.pdf')
LOGO = os.path.join(RAIZ, 'assets', 'logo-fahu.png')
CORREO = 'viceinvestigacionfahu@usach.cl'
TIPOS = ['Reincorporación Simple', 'Reincorporación para Requisito de Graduación', 'Prórroga de Periodo Lectivo',
         'Retiro Temporal sin expresión de causa', 'Retiro Temporal con expresión de causa', 'Convalidación de Asignaturas',
         'Cursar Asignatura Sin o Junto con el Requisito', 'Cursar Asignatura por Tutoría', 'Renuncia']

TINTA, TINTA2, APAGADO = HexColor('#3A4450'), HexColor('#5A6470'), HexColor('#8A8272')
TEAL, NARANJA, BORDE, CAMPO = HexColor('#007E80'), HexColor('#EF7A00'), HexColor('#CFC9BB'), HexColor('#FAF9F5')
W, H = letter
MX = 54  # margen horizontal
ANCHO = W - 2 * MX


def cabecera(c, pagina):
    c.setFillColor(TINTA); c.rect(0, H - 70, W, 70, stroke=0, fill=1)
    try:
        img = ImageReader(LOGO); iw, ih = img.getSize(); alto = 40
        c.setFillColor(white); c.roundRect(MX - 6, H - 61, iw * alto / ih + 12, alto + 12, 6, stroke=0, fill=1)
        c.drawImage(img, MX, H - 55, width=iw * alto / ih, height=alto, mask='auto')
    except Exception:
        pass
    c.setFillColor(white); c.setFont('Helvetica-Bold', 12.5)
    c.drawRightString(W - MX, H - 34, 'Solicitud de Concesión Académica de Excepción (CAE)')
    c.setFont('Helvetica', 8.5)
    c.drawRightString(W - MX, H - 48, 'Vicedecanato de Investigación y Postgrado · Facultad de Humanidades · USACH')
    c.setFillColor(APAGADO); c.setFont('Helvetica', 7.5)
    c.drawString(MX, 30, 'Formulario para personas sin cuenta @usach.cl · Enviar a ' + CORREO)
    c.drawRightString(W - MX, 30, 'Página %d de 2' % pagina)


def seccion(c, y, numero, titulo, color):
    c.setFillColor(color); c.rect(MX, y - 3, 3, 15, stroke=0, fill=1)
    c.setFillColor(TINTA); c.setFont('Helvetica-Bold', 11.5); c.drawString(MX + 10, y, titulo)
    c.setFillColor(APAGADO); c.setFont('Helvetica-Bold', 9); c.drawRightString(W - MX, y, numero)
    c.setStrokeColor(BORDE); c.setLineWidth(.5); c.line(MX, y - 8, W - MX, y - 8)
    return y - 26


def rotulo(c, x, y, texto, obligatorio=True):
    c.setFillColor(TINTA2); c.setFont('Helvetica-Bold', 7.5); c.drawString(x, y, texto.upper())
    if obligatorio:
        c.setFillColor(NARANJA); c.drawString(x + c.stringWidth(texto.upper(), 'Helvetica-Bold', 7.5) + 3, y, '*')


def campo(c, nombre, etiqueta, x, y, ancho, alto=20, obligatorio=True, multilinea=False, ayuda=''):
    """Rótulo arriba y campo de texto debajo. Devuelve la y bajo el campo."""
    rotulo(c, x, y, etiqueta, obligatorio)
    c.acroForm.textfield(name=nombre, tooltip=etiqueta, x=x, y=y - 6 - alto, width=ancho, height=alto, fontName='Helvetica',
                         fontSize=10 if not multilinea else 9.5, borderColor=BORDE, fillColor=CAMPO, textColor=TINTA, borderWidth=.75,
                         borderStyle='solid', forceBorder=True, fieldFlags='multiline' if multilinea else '', maxlen=None if multilinea else 200)
    if ayuda:
        c.setFillColor(APAGADO); c.setFont('Helvetica', 7); c.drawString(x, y - 6 - alto - 9, ayuda)
    return y - 6 - alto - (22 if ayuda else 14)


def casilla(c, nombre, etiqueta, x, y, tam=11):
    c.acroForm.checkbox(name=nombre, tooltip=etiqueta, x=x, y=y - 2, size=tam, buttonStyle='check', borderColor=TINTA2,
                        fillColor=white, textColor=TEAL, borderWidth=.75, forceBorder=True)
    c.setFillColor(TINTA); c.setFont('Helvetica', 9.5); c.drawString(x + tam + 6, y + 1, etiqueta)


def parrafo(c, x, y, texto, ancho, fuente='Helvetica', tam=9, color=TINTA2, interlinea=12.5):
    c.setFillColor(color); c.setFont(fuente, tam)
    linea = ''
    for palabra in texto.split():
        prueba = (linea + ' ' + palabra).strip()
        if c.stringWidth(prueba, fuente, tam) > ancho:
            c.drawString(x, y, linea); y -= interlinea; linea = palabra
        else:
            linea = prueba
    if linea:
        c.drawString(x, y, linea); y -= interlinea
    return y


def generar():
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    c = canvas.Canvas(SALIDA, pagesize=letter)
    c.setTitle('Solicitud de Concesión Académica de Excepción (CAE) · sin cuenta USACH')
    c.setAuthor('Vicedecanato de Investigación y Postgrado · FAHU USACH')
    c.setSubject('Formulario para estudiantes de postgrado que no cuentan con cuenta @usach.cl')
    mitad = (ANCHO - 14) / 2

    # ---- Página 1 ----
    cabecera(c, 1)
    y = H - 92
    y = parrafo(c, MX, y, 'Este formulario es para estudiantes de postgrado de la Facultad de Humanidades y del Instituto de Estudios Avanzados que '
                'no cuentan con una cuenta @usach.cl activa. Complételo en su computador, guárdelo y envíelo, junto con sus antecedentes, a ' + CORREO +
                '. La Unidad de Análisis del Vicedecanato registrará el caso y le informará su número de folio. Los campos con * son obligatorios.', ANCHO)
    y -= 8
    y = seccion(c, y, '01', 'Datos de la persona solicitante', HexColor('#00A0A0'))
    y2 = campo(c, 'apellido1', 'Primer apellido', MX, y, mitad)
    campo(c, 'apellido2', 'Segundo apellido', MX + mitad + 14, y, mitad)
    y = campo(c, 'nombres', 'Nombres', MX, y2, ANCHO)
    rotulo(c, MX, y, 'Documento de identidad')
    c.acroForm.radio(name='tipo_documento', value='RUN', selected=True, x=MX, y=y - 20, size=11, buttonStyle='circle', shape='circle',
                     borderColor=TINTA2, fillColor=white, textColor=TEAL, borderWidth=.75, forceBorder=True)
    c.setFillColor(TINTA); c.setFont('Helvetica', 9.5); c.drawString(MX + 17, y - 17, 'RUN (cédula chilena)')
    c.acroForm.radio(name='tipo_documento', value='Pasaporte', x=MX + 150, y=y - 20, size=11, buttonStyle='circle', shape='circle',
                     borderColor=TINTA2, fillColor=white, textColor=TEAL, borderWidth=.75, forceBorder=True)
    c.drawString(MX + 167, y - 17, 'Pasaporte')
    y -= 38
    y2 = campo(c, 'run', 'Número de documento', MX, y, mitad, ayuda='RUN con dígito verificador (ej.: 12.345.678-5).')
    campo(c, 'telefono', 'Teléfono de contacto', MX + mitad + 14, y, mitad, ayuda='Ej.: +56 9 1234 5678')
    y = campo(c, 'correo', 'Correo electrónico de contacto', MX, y2, ANCHO,
              ayuda='A este correo llegarán las notificaciones del trámite. Use el mismo desde el que envía este formulario.')
    y -= 6
    y = seccion(c, y, '02', 'Datos de requerimiento', NARANJA)
    y = campo(c, 'programa', 'Programa de postgrado en que participa', MX, y, ANCHO, ayuda='Nombre completo del programa (magíster o doctorado).')
    rotulo(c, MX, y, 'Año asociado a la solicitud')
    c.acroForm.textfield(name='anio', tooltip='Año asociado a la solicitud', x=MX, y=y - 26, width=110, height=20, fontName='Helvetica', fontSize=10,
                         borderColor=BORDE, fillColor=CAMPO, textColor=TINTA, borderWidth=.75, borderStyle='solid', forceBorder=True, maxlen=4)
    rotulo(c, MX + mitad + 14, y, 'Semestre asociado')
    for i, s in enumerate(['Semestre I', 'Semestre II']):
        x = MX + mitad + 14 + i * 110
        c.acroForm.radio(name='semestre', value=s, x=x, y=y - 22, size=11, buttonStyle='circle', shape='circle', borderColor=TINTA2,
                         fillColor=white, textColor=TEAL, borderWidth=.75, forceBorder=True)
        c.setFillColor(TINTA); c.setFont('Helvetica', 9.5); c.drawString(x + 17, y - 19, s)
    y -= 46
    rotulo(c, MX, y, 'Solicito autorización para (marque una o más)')
    y -= 18
    for i, t in enumerate(TIPOS):
        casilla(c, 'tipo_%d' % (i + 1), t, MX + (i % 2) * (mitad + 14), y - (i // 2) * 19)
    y -= ((len(TIPOS) + 1) // 2) * 19 + 4
    campo(c, 'otro', 'Otros (describa brevemente)', MX, y, ANCHO, obligatorio=False)
    c.showPage()

    # ---- Página 2 ----
    cabecera(c, 2)
    y = H - 96
    y = seccion(c, y, '02', 'Datos de requerimiento (continuación)', NARANJA)
    y = campo(c, 'fundamentacion', 'Fundamentación', MX, y, ANCHO, alto=250, multilinea=True,
              ayuda='Relate los antecedentes o integre los argumentos que se asocian a la solicitud de excepción.')
    y = campo(c, 'antecedentes', 'Antecedentes que adjunta al correo', MX, y, ANCHO, alto=62, obligatorio=False, multilinea=True,
              ayuda='Liste los archivos (PDF, Word, imágenes o .zip) que enviará junto con este formulario.')
    y -= 4
    y = seccion(c, y, '03', 'Declaración y envío', TEAL)
    casilla(c, 'declaracion', 'Declaro que la información entregada es fidedigna y que no cuento con una cuenta @usach.cl activa.', MX, y)
    y -= 30
    y2 = campo(c, 'fecha', 'Fecha', MX, y, 130, ayuda='dd-mm-aaaa')
    campo(c, 'firma', 'Nombre completo (vale como firma)', MX + 144, y, ANCHO - 144, ayuda='Si lo prefiere, imprima, firme a mano y escanee.')
    y = y2 - 4
    c.setFillColor(HexColor('#E4F2F2')); c.roundRect(MX, y - 74, ANCHO, 78, 8, stroke=0, fill=1)
    c.setFillColor(HexColor('#1F5C5E')); c.setFont('Helvetica-Bold', 9.5); c.drawString(MX + 12, y - 12, 'Cómo enviar')
    yy = parrafo(c, MX + 12, y - 26, '1. Guarde este PDF con sus datos.  2. Escriba a ' + CORREO + ' con el asunto «Solicitud CAE sin cuenta USACH» y adjunte '
                 'este formulario y sus antecedentes.  3. La Unidad de Análisis del Vicedecanato de Investigación y Postgrado registrará el caso y le '
                 'responderá con el número de folio. Las notificaciones del trámite llegarán a su correo de contacto.', ANCHO - 24, tam=8.8, color=HexColor('#1F5C5E'))
    y = y - 92
    parrafo(c, MX, y, 'Los datos se tratan de forma confidencial y solo son visibles para el Vicedecanato y las personas que intervienen en el trámite.',
            ANCHO, tam=7.8, color=APAGADO, interlinea=10)
    c.save()
    return SALIDA


if __name__ == '__main__':
    print(generar())
