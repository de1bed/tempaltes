# Cotizador · Treve / Feedbak / Staffvia / HAATS

Mini app para generar cotizaciones y contratos en PDF a partir de un formulario. Se llenan los datos del cliente a la izquierda, la vista previa se actualiza en vivo a la derecha y **Descargar PDF** genera el PDF en la propia app (Carta o A4, igual en cualquier navegador, también iPhone) con el nombre del archivo ya puesto.

## Acceso y permisos

La app pide **iniciar sesión** (Supabase Auth, proyecto `treve automatizaciones`). No hay registro: solo entran las cuentas que da de alta el administrador.

- **Administrador** (`davidrocha0520@gmail.com`): entra a todas las secciones y a **Administración** (`#admin`), donde da de alta cuentas (correo, nombre, contraseña y secciones), cambia permisos al momento, asigna una contraseña nueva, desactiva o elimina cuentas y ve el último acceso de cada quien.
- **Las demás personas** solo ven en el inicio las secciones que tienen activadas; una dirección como `#contratos` sin permiso regresa al inicio.
- **Contraseñas**: Supabase las guarda cifradas y nadie puede leerlas, ni el administrador. Al crear una cuenta o asignar una contraseña nueva se muestra **una sola vez** para compartirla.
- **Cambiar contraseña**: cada persona la cambia desde el inicio (pide la contraseña actual).
- **Bitácora** (en Administración): cada PDF, Excel o validación que se descarga queda registrado con quién, cuándo y los datos usados; "Abrir documento" lo vuelve a cargar tal cual. También se anotan inicios de sesión, cambios de contraseña y lo que hace el administrador con las cuentas. Nadie puede registrar a nombre de otro, editar ni borrar la bitácora, y solo el administrador la ve.
- **Primera vez**: mientras no exista el administrador, el login muestra "Configurar la cuenta de administrador" (solo para ese correo y solo una vez).

Cómo está hecho:

- `supabase/migrations/`: tabla `perfiles` (secciones, activo, es_admin) con RLS; cada persona solo puede leer su propio perfil y nadie puede escribir desde el navegador.
- `supabase/functions/admin-usuarios/`: Edge Function que crea, cambia y elimina cuentas con la llave secreta (nunca llega al navegador); revisa en cada llamada que quien la usa sea el administrador. Desactivar bloquea el inicio de sesión en Supabase Auth.
- `src/auth/`: login, primera configuración y panel de administración. `src/lib/supabase.ts` usa la llave publicable, que está hecha para ir en el navegador.

## Salas

Reservación de la **Sala principal** y la **Salita 2** (permiso "Salas" en Administración). Lunes a viernes, 7:00 a.m. a 9:00 p.m., hasta 30 días adelante, en hora de la Ciudad de México.

- Se elige sala, día y duración; la app muestra los horarios libres y lo que ya está ocupado ese día (reservaciones de la app y eventos que estén directamente en Outlook).
- Cada quien mueve o cancela sus reservaciones; el administrador ve y puede cambiar todas. Todo queda en la bitácora.
- La base de datos no permite dos reservaciones encimadas en la misma sala.
- **Outlook**: la Edge Function `salas` copia cada reservación al calendario de la sala (Microsoft Graph) e invita a los invitados. Necesita los secretos `MS_TENANT_ID`, `MS_CLIENT_ID` y `MS_CLIENT_SECRET` en Supabase y el correo del buzón de cada sala en la tabla `salas` (columna `buzon`). Sin eso funciona solo en la app.

## Pantalla de inicio

Al abrir la app aparece **¿Qué quieres hacer hoy?** con tres secciones: **Cotizaciones**, **Contratos** y **Corridas**. Se entra a una sección con su tarjeta (abre el último formato usado) o directo a un formato de la lista. Dentro, el menú muestra solo los formatos de esa sección y **‹ Inicio** regresa (también el botón Atrás del navegador). Cada sección tiene su dirección: `#cotizaciones`, `#contratos`, `#corridas`.

## Tamaño de hoja y reparto en hojas

Las hojas son **Carta** por defecto (el papel de las plantillas originales); en la barra superior se puede cambiar a **A4**. Todas las plantillas reparten su contenido solas: si una carta, una lista de términos o una tabla crece, lo que no cabe pasa a la hoja siguiente (las tablas largas repiten su encabezado). En Reclutamiento, HAATS y los términos se puede forzar un salto de hoja con una línea `---`.

## Plantillas

Todas se generan en **español o inglés** con el selector "Idioma del documento".

| Plantilla | Precios |
| --- | --- |
| Feedbak · Licenciamiento Mi Kiosko / Checador | **Tabulador fijo** (ver abajo) |
| Staffvia · Servicios y trámites | Captura manual, IVA calculado |
| Staffvia · Nómina (payroll) | Captura semanal; mensual y cuota de servicio calculados |
| Staffvia · Gastos médicos (GMM) | Captura manual por empleado |
| Staffvia · Bonos | Captura por empleado; totales calculados |
| Staffvia · Estudios con precio especial | Precio normal y precio especial por volumen: con N solicitudes o más se cobra el especial |
| Staffvia · Reclutamiento | Posiciones con precio regular y de promoción; condiciones y perfil por secciones |
| HAATS · Servicio especializado mensual | Mensualidad, precio por hora festivo y días de crédito por periodo |
| HAATS · Tiempo extra por horas | Costo = horas × precio por hora, con total si hay varias filas |

Al cambiar de idioma, los textos editables (introducción, términos, notas…) que siguen igual al original se traducen solos; los que ya editaste se quedan como los dejaste. Los textos de cada idioma están en `src/lib/modelo.ts`.

### Edición directa en la hoja

Los textos resaltados de la vista previa se editan con un clic: contacto, empresa, ciudad, títulos de portada, introducción, términos, notas, firmante y los montos que se capturan a mano en Staffvia. Lo que se escribe en la hoja se guarda en el mismo campo del formulario (y al revés), así que se conserva al cambiar de idioma o recargar.

- Los montos muestran su valor sin formato al editarlos y con formato al salir.
- En introducción y términos, `{empresa}`, `{puesto}` o `{fee}` aparecen como tales mientras se edita y se sustituyen al salir.
- En listas (términos, detalle, notas), **Enter** agrega un punto nuevo y **Retroceso** en un punto vacío lo quita.
- En Reclutamiento, HAATS y los términos de Feedbak el texto va por secciones: `## ` es título de sección, `- ` subpunto, una línea que empieza con `*` es una nota sin viñeta y `---` es un salto de hoja.
- En Feedbak también se editan la carta, el título, la nota de montos y todos los términos. En los términos, las líneas que empiezan con `## ` son títulos de sección; `{moneda}` y `{precioAdmin}` se llenan con el tabulador.
- Los precios que calcula el tabulador de Feedbak no se editan: salen del tabulador fijo.
- El resaltado y los textos guía solo se ven en pantalla; no salen en el PDF.

Feedbak permite elegir entre 3 portadas o ninguna. Staffvia y HAATS permiten la portada Treve (con título, cliente y mes) o ninguna.

## Contratos

La sección **Contratos** tiene el contrato de licencia y servicios de Feedbak y el contrato de confidencialidad (NDA). Funcionan igual que las cotizaciones (formulario, edición en la hoja, español/inglés, PDF), con dos diferencias:

- **Las hojas se reparten solas**: el texto se mide y se acomoda en hojas A4; un título de cláusula nunca queda solo al final de una hoja. El pie lleva "Página X de N" y, en el contrato, el número de contrato.
- **Formato del texto**: `## ` cláusula (se numera sola), `### ` subtítulo, `- ` inciso a), b)…, cualquier otra línea es un párrafo. `{cliente}`, `{proveedor}`, `{vigencia}`, `{inicio}`, `{renovacion}`, `{representante}`, `{fecha}`, etc. se llenan con el formulario. La fecha de renovación se calcula con la vigencia (anual o semestral).

Los textos de los contratos están en `src/lib/contratos.ts`.

## Corridas (simulaciones salariales)

Tres formatos, cada uno con **su** plantilla aprobada (no se mezclan):

| Formato | Plantilla aprobada | Periodo |
| --- | --- | --- |
| Simulación extendida **Kofile** | `Simulaciones_2026_cat_10082026_KOFILE_BASE_RECIBIDA_2026-08-19.xlsx` | Catorcenal |
| Corrida **General Treve** (formato completo) | `Simulaciones_2026_para_David_FORMATO_COMPLETO_APROBADO_2026-08-19.xlsx` | Semanal |
| Formato **33 Hilos** | `Estructura_Corrida_33_Hilos_BASE.xlsx` (montos de la corrida general) | Semanal |

**Cómo funciona**

- **Se calcula con las fórmulas del propio Excel.** La app trae un motor que lee y evalúa las fórmulas de la plantilla tal cual (`src/corridas/motor/`): no hay fórmulas propias de nómina. Las pruebas verifican que reproduce *todas* las fórmulas de las 3 plantillas igual que Excel y que da los mismos números que los ejemplos enviados por Nóminas.
- **Se elige qué fijar**: salario diario, bruto del periodo (total de percepciones), bruto mensual, neto o neto + Sodexo. Para un bruto o neto, la app **busca el salario diario** que llega al monto (lo que antes se hacía "jugando con los números") con 2 decimales (centavos) o 6 (cierre exacto).
- Los datos se capturan en las mismas celdas que se usaban a mano (`Calculo!D19` salario diario, `Calculo!D64` Sodexo, etc.). En Kofile, "sin séptimo día" pone `Calculo!D36 = 0`, los días de vacaciones ajustan la fórmula de `Calculo!D44` y el bono de desempeño fijo va en `Calculo!E19`, como en los ejemplos.
- **Kofile, esquema**: *Nómina* (hoja Simulacion: ISR por tabla + IMSS) o *Asimilado* (bloque "Genérica" de Simulacion Asimilado: ISR catorcenal de IMPUESTOS KOFILE + invoice bi-weekly con service fee, medical, life insurance y TC).
- **Otros conceptos** (montos por periodo): van al renglón que ya tiene la hoja `Calculo` y entran a ISR/IMSS con las exenciones de la plantilla: prima dominical (`D41`), horas extra dobles/triples (`D37`/`D38`) y, en la general y 33 Hilos, bonos de turno/transporte, fondo de ahorro y otras percepciones (`D49`, gravado). Como el resumen (`Simulacion`) no lista esos renglones, se agrega la línea "Otras percepciones (incluidas en el total)" y el total queda igual a `Calculo!D55`. Si se busca un neto, el salario diario se ajusta contando con ellos.
- **Bloqueos y pendientes**: sin puesto o sin monto no se genera nada. Un concepto que el formato no tiene (en Kofile: bono de turno, transporte u otras percepciones) queda como **pendiente**: aparece en la corrida y en la validación, pero no se calcula.
- **Vista Documento / Números**: el botón de arriba cambia la vista previa a solo números, con "Copiar" por monto, por sección o todo junto (se pega en Excel como concepto y monto), en formato `1234.56` o `$1,234.56`.
- **Validación** (panel del formulario): objetivo alcanzado, resumen = `Calculo` (percepciones `D55`, deducciones `D62`), neto = percepciones − deducciones, neto + Sodexo, invoice = subtotal + fee, celdas clave sin ceros ni errores.

**Descargas**

- **Descargar Excel**: copia limpia de la plantilla aprobada con los datos capturados; **cada fórmula lleva su valor ya calculado** (nunca abre en ceros o en blanco) y el libro se marca para recalcular al abrir. Hojas, fórmulas, formato y comentarios quedan intactos. En la corrida general, las hojas ocultas `Sheet5` y `33 Hilos ` (copias del resumen pegadas como valores) se actualizan con la corrida nueva, como pedía Nóminas; `Sheet1`–`Sheet3` son comparativos históricos y no se tocan.
- **PDF**: resumen de una o dos hojas con la imagen de Treve.
- **Validación**: JSON con entradas, supuestos, resultados, validaciones y las celdas capturadas.

**Actualizar una plantilla** (p. ej. nuevas tablas de ISR o UMA): reemplazar el `.xlsx` en `src/corridas/plantillas/` (mismo nombre: `kofile.xlsx`, `general.xlsx` o `hilos33.xlsx`), correr `python3 scripts/extraer-plantillas-corridas.py` (requiere `openpyxl`) y `npm test`. Si las celdas de captura cambian de lugar, ajustar `src/corridas/calculo.ts`. Los ejemplos de Nóminas usados en las pruebas están en `src/corridas/pruebas/`.

## Tabuladores Feedbak

`src/lib/tabuladores.ts` transcribe los Excel `Cotizador … Cliente 00-2026` (hoja "2025", columna Pesos). Con el producto y el número de colaboradores se calculan:

| Colaboradores | <101 | <501 | <1501 | <3001 | <7001 | <12000 | 12000+ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Checador | 24 | 19 | 12 | 7 | 7 | 7 | 7 |
| Checador facial | 26 | 21 | 14 | 9 | 9 | 9 | 9 |
| Mi Kiosko + Checador | 36 | 29 | 22 | 17 | 13 | 8 | 5 |
| Mi Kiosko + Checador facial | 38 | 31 | 24 | 19 | 15 | 8 | 5 |
| Admins incluidos | 2 | 3 | 6 | 10 | 20 | 30 | 50 |
| Admin extra (MXN/mes) | 250 | 150 | 100 | 50 | 10 | 8 | 5 |

- **Setup inicial:** Checador $2,000; Mi Kiosko $3,000 hasta 100 colaboradores y sin costo arriba de 100.
- **Semestral:** primera factura (con setup) + 5 mensualidades, con 3% / 6% / 12% / 15% de descuento.
- **Anual:** primera factura + 11 mensualidades, con 5% / 10% / 15% / 20% de descuento.
- **Dólares:** montos en pesos ÷ tipo de cambio capturado.
- Los administradores que excedan los incluidos se suman al total mensual al precio de admin extra.

Para cambiar precios se edita ese archivo; `src/lib/tabuladores.test.ts` verifica los resultados contra los valores de los Excel.

## Uso

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas del tabulador
npm run build    # sitio estático en dist/ (Vercel, Netlify, etc.)
npm run build:artifact  # un solo HTML autocontenido en dist-artifact/cotizador.html
```

El borrador se guarda en el navegador (localStorage). **Reiniciar** limpia solo la plantilla abierta. Si algún contenido no cabe en su hoja, la vista previa la marca en rojo y muestra un aviso.
