import assert from 'node:assert/strict'
import fs from 'node:fs'
import {crearTienda} from '../src/logica.js'
const T=crearTienda({config:JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url))),catalogo:JSON.parse(fs.readFileSync(new URL('../catalogo.json', import.meta.url)))})
const D='d@lid'; const d=x=>T.mensajeDuena(x,D); const txt=a=>a.map(x=>x.texto).join('\n---\n')
const c=(x,e={})=>T.mensajeCliente({id:'c@lid',nombre:'Ana',telefono:'5215512345678',texto:x,...e})
assert.equal(T.hayDuenas(),false)
let r=T.activarDuena(D,'5215500000000'); assert.match(r[0].texto,/Falta configurar/); assert.match(r[0].texto,/Datos bancarios/)
assert.ok(T.esDuena('otro@lid','525500000000'.replace('52','521')));assert.equal(T.config.duenas[0].jid,'otro@lid');T.config.duenas[0].jid=D
// sin configurar: clientas no ven plantillas
assert.match(txt(c('hola')),/Mi Tienda/); assert.match(txt(c('1')),/preparando/); assert.match(txt(c('4')),/En un momento/); assert.match(txt(c('7')),/Pronto/)
c('menu'); r=txt(c('5')); assert.match(r,/Envíos/); assert.ok(!/Cambios/.test(r),'faq vacía oculta')
c('menu'); r=c('hacen cambios?'); assert.match(r[1].texto,/sin respuesta configurada/); c('menu')
// ajustes
assert.match(txt(d('ajustes')),/Ajustes de la tienda/)
d('1'); assert.match(txt(d('Glam Store')),/Guardado/); assert.equal(T.config.tienda,'Glam Store')
d('2'); d('¡Bienvenida a Glam! ✨'); assert.equal(T.config.bienvenida,'¡Bienvenida a Glam! ✨')
d('3'); d('BBVA'); d('Vane R'); assert.match(txt(d('123')),/16 o 18/); assert.match(txt(d('012 180 00123456789 0')),/····7890|Guardado/); assert.equal(T.config.pago.clabe.length,18)
d('4'); d('50'); assert.equal(T.config.costoEnvio,50)
d('5'); d('1'); d('Instagram'); assert.match(txt(d('hola')),/no es válido/); assert.match(txt(d('https://instagram.com/glam')),/Instagram: https/); 
d('1'); d('1'); d('https://instagram.com/glam2'); assert.equal(T.config.redes[0].url,'https://instagram.com/glam2'); d('0')
d('6'); d('3'); d('1'); d('Cambios en 3 días'); assert.equal(T.config.faq[2].respuesta,'Cambios en 3 días')
d('2'); d('1'); d('2 días'); d('4'); d('1'); d('Solo defectos');
d('6'); d('Facturas'); d('No facturamos'); d('factura, facturas'); assert.equal(T.config.faq.length,6)
d('0'); 
// dueñas
d('8'); assert.match(txt(d('1')),/única/); d('2'); d('5215511112222'); assert.equal(T.config.duenas.length,2); d('2'); d('1'); assert.equal(T.config.duenas.length,1); d('0');
assert.match(txt(d('salir')),/Listo/); assert.equal(T.db.asistentes[D],undefined)
// producto con tallas y colores
d('agregar'); d('Ropa'); d('Blusa satinada'); assert.match(txt(d('caro')),/solo con números/); d('289'); d('Suave'); d('4')
assert.match(txt(d('CH Negro')),/No entendí/); d('CH, Negro, 3\nM, Azul marino, 2'); r=txt(d('1')); assert.match(r,/R01/); assert.match(r,/Azul marino: 2/); assert.equal(T.db.asistentes[D],undefined)
// producto simple en categoría existente, y otra categoría
d('agregar'); d('1'); d('Falda'); d('300'); d('no'); d('1'); d('5'); d('2'); assert.equal(T.catalogo[1].id,'R02')
d('agregar'); d('Maquillaje'); d('Labial mate'); d('129'); d('no'); d('3'); d('Rojo 6\nNude 0'); d('2'); assert.equal(T.catalogo[2].id,'M01')
assert.match(txt(d('productos')),/Blusa satinada · \$289 · 5 pzas/)
// editar
d('editar R01'); d('2'); d('300'); assert.equal(T.catalogo[0].precio,300); d('5'); assert.equal(T.catalogo[0].encargable,false)
d('6'); d('1 10'); assert.equal(T.catalogo[0].variantes[0].stock,10)
d('7'); assert.match(txt(d('CH, Negro, 1')),/Ya existe/); d('G, Rojo, 4'); assert.equal(T.catalogo[0].variantes.length,3); d('salir')
// la clienta compra lo editado con envío
c('menu'); assert.match(txt(c('hola')),/En qué/); c('Blusa'); 
c('blusa'); c('1'); c('3'); /*G Rojo*/ r=txt(c('1')); assert.match(r,/Agregado/); c('1'); c('1'); c('Ana'); c('Dir'); r=c('1'); assert.match(r[0].texto,/\$350/); assert.match(r[0].texto,/CLABE: 012180001234567890/); const stockG=T.catalogo[0].variantes[2]; assert.equal(stockG.stock,3)
// quitar otra opción desplaza índices y cancelar devuelve a la correcta
d('editar R01'); d('8'); d('1'); d('salir'); assert.equal(T.catalogo[0].variantes.length,2); d('cancelar 1'); assert.equal(T.catalogo[0].variantes[1].stock,4); assert.equal(T.catalogo[0].variantes[0].stock,2)
r=d('confirmar 1'); assert.match(txt(r),/ya no está esperando/)
// redes al confirmar
c('blusa'); c('1');c('1');c('1');c('1');c('1');c('1');
assert.equal(T.db.pedidos.length,2); r=d('confirmar 2'); assert.match(r[0].texto,/instagram.com\/glam2/)
// borrar con producto en ficha
c('menu');c('labial');c('1');c('1');c('1');c('1');
d('editar M01');d('9');d('1');assert.equal(T.catalogo.length,2);
r=txt(c('1')); assert.match(r,/ya no está disponible/);
// categoría renombrada
d('ajustes');d('7');d('1');d('Moda');d('salir');assert.equal(T.catalogo[0].categoria,'Moda')
// bienvenida en clienta nueva
assert.match(txt(T.mensajeCliente({id:'z',nombre:'Z',telefono:'5599999999',texto:'hola'})),/Bienvenida a Glam/)
// JSON serializable
JSON.parse(JSON.stringify({a:T.db,b:T.config}))
console.log('AJUSTES OK')
