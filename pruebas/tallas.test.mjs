import assert from 'node:assert/strict'
import fs from 'node:fs'
import { crearTienda } from '../src/logica.js'

const leer = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)))
const T = crearTienda({ config: leer('./ejemplo-config.json'), catalogo: leer('./ejemplo-catalogo.json') })
let n = 0
const prueba = (texto, esperado) => {
  const id = `t${n++}`
  const c = (x) => T.mensajeCliente({ id, nombre: 'A', telefono: '5215500000' + String(n).padStart(3, '0'), texto: x }).map((a) => a.texto).join('\n')
  c('hola')
  c('blusa')
  assert.match(c(texto), esperado, texto)
}
prueba('La chica', /Talla CH · Negro\) quieres/)
prueba('chica negra', /Talla CH · Negro\) quieres/)
prueba('la mediana', /Hay varias.*Talla M · Negro, Talla M · Rojo/)
prueba('mediana roja', /Talla M · Rojo\) quieres/)
prueba('talla S', /Talla CH · Negro\) quieres/)
prueba('la grande', /Talla G · Negro\) quieres/)
prueba('extra grande', /No te entendí/)
console.log('TALLAS OK')
