import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { calcularCorrida } from './calculo'
import { escribirExcel } from './excel'
import { corridasIniciales } from './tipos'

const plantilla = (id: string) => readFileSync(join(__dirname, 'plantillas', `${id}.xlsx`))
const ini = corridasIniciales()

// Con SALIDA_EXCEL=<carpeta> se guardan los archivos para revisarlos a mano.
const guardar = (nombre: string, datos: Uint8Array) => {
  const dir = process.env.SALIDA_EXCEL
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, nombre), datos)
}

describe('Excel de salida', () => {
  it('Kofile sin séptimo: captura en la plantilla y cada fórmula con su valor', async () => {
    const r = calcularCorrida('kofile', { ...ini.kofile, puesto: 'Analista', objetivo: 'salarioDiario', monto: '1728.14', septimo: false })
    const datos = await escribirExcel(plantilla('kofile'), r.libros[0].libro)
    guardar('kofile-sd1728-sin-septimo.xlsx', datos)
    const zip = await JSZip.loadAsync(datos)
    const calculo = await zip.file('xl/worksheets/sheet3.xml')!.async('string')
    expect(calculo).toContain('<c r="D19" s="135"><v>1728.14</v></c>')
    expect(calculo).toContain('<c r="D36" s="130"><v>0</v></c>')
    // Las fórmulas siguen ahí, con su valor ya calculado (no abre en ceros).
    expect(calculo).toMatch(/<c r="D55" s="\d+"><f>SUM\(D35:D54\)<\/f><v>51433\.79916072/)
    const asim = await zip.file('xl/worksheets/sheet8.xml')!.async('string')
    expect(asim).toContain('<is><t xml:space="preserve">Analista</t></is>')
    expect(zip.file('xl/calcChain.xml')).toBeNull()
    expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('fullCalcOnLoad="1"')
  })

  it('Project Manager: la fórmula de prima vacacional ajustada queda escrita', async () => {
    const r = calcularCorrida('kofile', { ...ini.kofile, puesto: 'Project Manager', objetivo: 'brutoMensual', monto: '50000', bonoDesempeno: 'monto', bonoDesempenoMonto: '5000', diasVacaciones: '12' })
    const datos = await escribirExcel(plantilla('kofile'), r.libros[0].libro)
    guardar('kofile-pm-50000.xlsx', datos)
    const calculo = await (await JSZip.loadAsync(datos)).file('xl/worksheets/sheet3.xml')!.async('string')
    expect(calculo).toMatch(/<c r="D44" s="130"><f>\+\(D19\*12\)\*0\.25\/12\/2\.17<\/f><v>/)
  })

  it('General y 33 Hilos se escriben sin errores', async () => {
    const g = calcularCorrida('general', { ...ini.general, puesto: 'Operador', objetivo: 'netoSodexo', monto: '17000' })
    guardar('general-neto-sodexo-17000.xlsx', await escribirExcel(plantilla('general'), g.libros[0].libro))
    const h = calcularCorrida('hilos33', { ...ini.hilos33, puesto: 'Inside Sales Representative', objetivo: 'salarioDiario', monto: '914.62' })
    const datos = await escribirExcel(plantilla('hilos33'), h.libros[0].libro)
    guardar('hilos33-sd914.xlsx', datos)
    const hoja = await (await JSZip.loadAsync(datos)).file('xl/worksheets/sheet1.xml')!.async('string')
    expect(hoja).toMatch(/<c r="F34" s="\d+"><f>\+F32\+F33<\/f><v>11713\.7/)
  })
})
