import assert from 'node:assert/strict'
import fs from 'node:fs'
import {crearTienda} from '../src/logica.js'
const T=crearTienda({config:JSON.parse(fs.readFileSync(new URL('./ejemplo-config.json', import.meta.url))),catalogo:JSON.parse(fs.readFileSync(new URL('./ejemplo-catalogo.json', import.meta.url)))})
const c=x=>T.mensajeCliente({id:'a',nombre:'Ana',telefono:'5215512345678',texto:x}).map(a=>a.texto).join('\n')
c('hola')
assert.match(c('vestido'),/Vestido floral/); assert.match(c('si'),/Elige la opción/)
assert.match(c('la azul'),/Hay varias/); assert.match(c('CH azul'),/Hay 2/)
assert.match(c('Una'),/Agregado/); assert.equal(T.db.clientes.a.ficha[0].cantidad,1)
assert.match(c('terminar'),/Tu ficha/); assert.match(c('confirmar'),/A nombre/); c('Ana'); assert.match(c('Calle 1'),/Revisa/); assert.match(c('Sí'),/#1/)
for(const [x,n] of [['dos',2],['2 piezas',2],['solo una',1],['quiero 1',1]]){c('labial');c('1');c('1');const r=c(x);assert.match(r,/Agregado/,x);const l=T.db.clientes.a.ficha;assert.equal(l[l.length-1].cantidad,n);l.length=0;}
c('labial');c('1');c('1');assert.match(c('muchas'),/del 1 al/);assert.equal(T.db.clientes.a.fallos,0);assert.match(c('muchas'),/del 1 al/);assert.equal(T.db.clientes.a.paso,'cantidad');assert.match(c('20'),/del 1 al/);
c('menu');c('labial');c('1');assert.match(c('rojo'),/Rojo\) quieres/);
console.log('NATURAL OK')
