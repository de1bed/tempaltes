# Cotizador · Treve / Feedbak / Staffvia

Mini app para generar cotizaciones en PDF a partir de un formulario. Se llenan los datos del cliente a la izquierda, la vista previa se actualiza en vivo a la derecha y **Descargar PDF** abre el diálogo de impresión (guardar como PDF, tamaño A4) con el nombre del archivo ya puesto.

## Plantillas

Todas se generan en **español o inglés** con el selector "Idioma del documento".

| Plantilla | Precios |
| --- | --- |
| Feedbak · Licenciamiento Mi Kiosko / Checador | **Tabulador fijo** (ver abajo) |
| Staffvia · Servicios y trámites | Captura manual, IVA calculado |
| Staffvia · Nómina (payroll) | Captura semanal; mensual y cuota de servicio calculados |
| Staffvia · Gastos médicos (GMM) | Captura manual por empleado |
| Staffvia · Bonos | Captura por empleado; totales calculados |

Al cambiar de idioma, los textos editables (introducción, términos, notas…) que siguen igual al original se traducen solos; los que ya editaste se quedan como los dejaste. Los textos de cada idioma están en `src/lib/modelo.ts`.

Feedbak permite elegir entre 3 portadas o ninguna. Staffvia usa la portada Treve con título, cliente y mes.

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
