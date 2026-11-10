import assert from 'node:assert/strict'
import fs from 'node:fs'
import { crearTienda } from '../src/logica.js'

const leer = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)))
let reloj = Date.UTC(2026, 10, 10, 18, 0)
const T = crearTienda({ config: leer('./ejemplo-config.json'), catalogo: leer('./ejemplo-catalogo.json'), ahora: () => reloj, version: '2.0.0 (abc1234)' })
const txt = (a) => a.map((x) => x.texto).join('\n---\n')
const d = (x) => T.mensajeDuena(x, 'duena@lid')
const clienta = (id, tel) => (x, extra = {}) => T.mensajeCliente({ id, nombre: 'Ana *López*_\nX', telefono: tel, texto: x, ...extra })
const hora = 3600000
const stock = (id, i) => T.catalogo.find((p) => p.id === id).variantes[i].stock

// Nombre de perfil sin formato ni saltos
const ana = clienta('ana@lid', '5215512345678')
assert.match(txt(ana('hola')), /¡Hola Ana López X!/)

// Pedido de aretes
for (const x of ['aretes', '1', '2', '1', '1', 'Ana López', 'Calle 5, Centro']) ana(x)
let r = ana('1')
assert.match(r[0].texto, /#1/)
assert.equal(stock('A01', 0), 6)

// Recordatorio una sola vez, luego cancelación con stock devuelto
assert.deepEqual(T.revisarPendientes(), [])
reloj += 13 * hora
r = T.revisarPendientes()
assert.equal(r.length, 1)
assert.match(r[0].texto, /recordamos.*#1/s)
assert.match(r[0].texto, /CLABE/)
assert.deepEqual(T.revisarPendientes(), [], 'el recordatorio no se repite')
reloj += 36 * hora
r = T.revisarPendientes()
assert.match(txt(r), /se canceló/)
assert.match(txt(r), /cancelado por falta de pago/)
assert.equal(T.db.pedidos[0].estado, 'cancelado')
assert.equal(stock('A01', 0), 8)

// Un pedido con comprobante en revisión no se cancela
for (const x of ['aretes', '1', '1', '1', '1']) ana(x)
assert.match(txt(ana('1')), /#2/)
ana('', { media: { mime: 'image/jpeg' } })
reloj += 100 * hora
assert.deepEqual(T.revisarPendientes(), [])

// Ajustes de pagos pendientes desde WhatsApp
d('ajustes')
assert.match(txt(d('9')), /cuántas horas/)
d('6')
assert.match(txt(d('3')), /mayor que el recordatorio/)
d('24')
assert.equal(T.config.recordatorioHoras, 6)
assert.equal(T.config.vencimientoHoras, 24)
d('salir')

// Entrega y mensaje directo
d('confirmar 2')
r = d('entrega 2 sábado 4 pm')
assert.equal(r[0].tipo, 'cliente')
assert.match(r[0].texto, /sábado 4 pm/)
assert.match(txt(d('ver 2')), /📅 Entrega: sábado 4 pm/)
r = d('mensaje 2 Hola Ana, ya va tu pedido')
assert.equal(r[0].a, 'ana@lid')
assert.equal(r[0].texto, 'Hola Ana, ya va tu pedido')
assert.match(txt(d('entrega 99 hoy')), /No encontré/)

// Atención personal: se reenvía a la dueña y ella contesta con "responder"
ana('menu')
ana('8')
const caso = T.db.casos.at(-1).id
r = ana('¿Tienen la blusa en talla XL?')
assert.equal(r[0].tipo, 'duena')
assert.match(r[0].texto, new RegExp(`responder ${caso}`))
r = ana('', { media: { mime: 'video/mp4' } })
assert.match(txt(r), /envió un archivo/)
r = d(`responder ${caso} Sí, mañana te la aparto`)
assert.equal(r[0].a, 'ana@lid')
assert.equal(r[0].texto, 'Sí, mañana te la aparto')
assert.match(txt(d('responder 999 hola')), /Usa:/)
d(`cerrar ${caso}`)
assert.match(txt(ana('hola')), /En qué/)

// Resumen
r = txt(d('resumen'))
assert.match(r, /Pagado en 7 días: 1 pedido · \$99/)
assert.match(r, /Stock bajo/)
assert.match(r, /M01 Labial mate \(Vino\): 0/)

// Exportar: CSV con protección contra fórmulas
const mala = clienta('mala@lid', '5215599990000')
for (const x of ['hola', 'aretes', '1', '1', '1', '1', '=HYPERLINK("x")', '+Calle, "1"']) mala(x)
mala('1')
r = d('exportar')
const csv = r[0].archivo.contenido
assert.equal(r[0].archivo.mime, 'text/csv')
assert.ok(csv.startsWith('﻿Pedido,Fecha'))
assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'las fórmulas quedan como texto')
assert.ok(csv.includes(`"'+Calle, ""1"""`))

// Fotos
assert.equal(T.productoParaFoto('hola'), undefined)
assert.equal(T.productoParaFoto('foto ZZ9'), null)
assert.equal(T.productoParaFoto('Foto r01').id, 'R01')
assert.match(txt(T.ponerFoto('R01', 'R01.jpg')), /Foto guardada/)
const otra = clienta('otra@lid', '5215511110000')
otra('hola')
r = otra('blusa')
assert.equal(r[0].imagen, 'R01.jpg')
d('quitarfoto R01')
assert.equal(otra('blusa')[0].imagen, undefined)

// Versión, flujos que caducan y la palabra "alguien" ya no manda a una persona
assert.match(txt(d('version')), /2\.0\.0 \(abc1234\)/)
d('ajustes')
d('1')
reloj += 31 * 60000
assert.match(txt(d('pedidos')), /Pedidos activos/, 'un flujo abandonado ya no se traga comandos')
assert.equal(T.config.tienda, 'Mi Tienda')
otra('menu')
assert.match(txt(otra('alguien sabe el precio del labial rojo?')), /\$129/)

// Lista de pedidos con muchos pedidos no se pasa del límite de WhatsApp
for (let i = 0; i < 60; i++) d(`registrar Clienta ${i} | 55000000${String(i).padStart(2, '0')} | Instagram | Calle ${i} | A02 2 1`)
r = txt(d('pedidos pendiente'))
assert.match(r, /…y \d+ más antiguos/)
assert.ok(r.length < 6000)

console.log('FUNCIONES NUEVAS OK')
