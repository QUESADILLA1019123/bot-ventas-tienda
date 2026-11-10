import assert from 'node:assert/strict'
import fs from 'node:fs'
import {crearTienda} from '../src/logica.js'
const nueva=()=>crearTienda({config:JSON.parse(fs.readFileSync(new URL('./ejemplo-config.json', import.meta.url))),catalogo:JSON.parse(fs.readFileSync(new URL('./ejemplo-catalogo.json', import.meta.url)))})
let T=nueva()
const A='111@lid'
const c=(x,extra={})=>T.mensajeCliente({id:A,nombre:'Ana',telefono:'5215512345678',texto:x,...extra})
const d=x=>T.mensajeDuena(x,'d@s')
const txt=a=>a.map(x=>x.texto).join('\n---\n')
const stock=(id,i)=>T.catalogo.find(p=>p.id===id).variantes[i].stock
assert.match(txt(c('hola')),/Soy la asistente/)
assert.match(txt(c('1')),/Maquillaje/)
assert.match(txt(c('2')),/Labial mate/)      // Maquillaje
let r=txt(c('1')); assert.match(r,/\$129/); assert.match(r,/Rojo: 6 disponibles/); assert.match(r,/Vino: agotado/)
r=txt(c('1')); assert.match(r,/Rojo/); assert.ok(!/Vino/.test(r),'no encargable no se ofrece')
assert.match(txt(c('1')),/Hay 6/)
assert.match(txt(c('99')),/del 1 al 6/)
assert.match(txt(c('2')),/Agregado/)
r=txt(c('1')); assert.match(r,/Labial mate \(Rojo\)/); assert.match(r,/\$258/)
assert.match(txt(c('1')),/A nombre/)
assert.match(txt(c('Ana López')),/dirección/)
r=txt(c('Calle 1 #2, Centro')); assert.match(r,/Revisa tu pedido/)
r=c('1'); assert.equal(r.length,2); assert.match(r[0].texto,/#1/); assert.match(r[0].texto,/CLABE/); assert.match(r[1].texto,/Nuevo pedido/); assert.match(r[1].texto,/Ana López/); assert.match(r[1].texto,/5215512345678/)
assert.equal(stock('M01',0),4)
assert.match(txt(c('3')),/👉 Pendiente de pago/)
assert.match(txt(c('4')),/CLABE/)
// comprobante
r=c('',{media:{mime:'image/jpeg'}}); assert.equal(r[1].adjuntarComprobante,1); assert.match(r[1].texto,/confirmar 1/)
assert.equal(T.db.pedidos[0].estado,'comprobante_revision')
assert.match(txt(d('estado 1 listo')),/no está pagado/)
r=d('rechazar 1 borroso'); assert.equal(T.db.pedidos[0].estado,'pendiente_pago'); assert.match(r[0].texto,/borroso/)
c('',{media:{mime:'application/pdf'}})
r=d('confirmar 1'); assert.equal(r[0].tipo,'cliente'); assert.match(r[0].texto,/Pago confirmado/); assert.match(r[0].texto,/instagram/)
assert.match(txt(d('pedidos')),/Pagado y en proceso \(1\)/)
for(const [e,re] of [['encargado',/encargamos/],['listo',/listo para/],['camino',/en camino/]]){ r=d('estado 1 '+e); assert.match(r[0].texto,re)}
assert.match(txt(c('¿cómo va mi pedido?')),/👉 En camino/)
d('estado 1 entregado'); assert.match(txt(d('cancelar 1')),/cerrado/); assert.equal(stock('M01',0),4)
assert.match(txt(c('3')),/✅ Entregado/)
// libre
c('menu')
assert.match(txt(c('cuanto cuesta el labial rojo')),/\$129/)
c('menu'); assert.match(txt(c('tienen blusas?')),/Blusa satinada/)
c('menu'); assert.match(txt(c('aretes')),/\$99/)
c('menu'); assert.match(txt(c('cuanto tardan en entregar')),/Tiempos/)
assert.match(txt(c('hacen cambios?')),/Cambios/); assert.match(txt(c('quiero una devolución')),/Devoluciones/)
assert.match(txt(c('aceptan tarjeta?')),/Métodos/); assert.match(txt(c('hacen envios a domicilio')),/Envíos/)
assert.match(txt(c('me pasas su instagram')),/instagram.com/)
// faq num
c('menu'); assert.match(txt(c('5')),/Preguntas/); assert.match(txt(c('3')),/Cambios/)
// queja
c('menu'); assert.match(txt(c('6')),/Cuéntame/); r=c('Llegó roto el pedido 1'); assert.match(r[1].texto,/Pedido #1/)
assert.match(txt(d('casos')),/Queja/)
r=d('cerrar 1 Te lo cambiamos'); assert.match(r[0].texto,/Te lo cambiamos/)
// persona
c('menu'); r=c('8'); assert.match(r[1].texto,/atención/); r=c('hola, sigues?'); assert.equal(r.length,1); assert.equal(r[0].tipo,'duena'); assert.match(r[0].texto,/sigues/); assert.match(r[0].texto,/responder 2/)
d('cerrar 2 listo'); assert.match(txt(c('hola')),/En qué/)
// no entiende x2 -> persona
c('menu'); assert.match(txt(c('xyzzy')),/No te entendí/); r=c('qwerty'); assert.match(r[0].texto,/persona/); assert.equal(T.db.casos.at(-1).tipo,'atencion'); 
assert.match(txt(c('menu')),/En qué/); assert.equal(T.db.casos.at(-1).estado,'cerrado')
// comprobante sin pedido
assert.match(txt(c('',{media:{mime:'image/png'}})),/no tienes pedidos pendientes/)
assert.match(txt(c('',{media:{mime:'audio/ogg'}})),/solo puedo leer/)
// encargo + cancelar devuelve + datos guardados
c('menu');c('1');c('1');c('1');c('1');
const blusa=T.catalogo.find(p=>p.id==='R01')
assert.match(txt(c('menu')),/En qué/)
c('blusa');c('1');r=txt(c('3'));assert.match(r,/Talla G · Negro/.source? /Talla/:/x/)
// flujo encargo talla G (opción 3)
assert.match(txt(c('2')),/Agregado/); 
c('1'); r=txt(c('1')); assert.match(r,/Revisa tu pedido/); 
r=c('1'); assert.match(r[0].texto,/#2/); assert.match(r[1].texto,/encargo/)
// última pieza: otra clienta
T=nueva(); 
const b=(x)=>T.mensajeCliente({id:'b@lid',nombre:'B',telefono:null,texto:x}), e=(x)=>T.mensajeCliente({id:'e@s',nombre:'E',telefono:'5500000000',texto:x})
for(const x of ['bolsa','1','1','1','1','1','Bea','Dir 1']) b(x)
assert.match(txt(b('123')),/10 dígitos/); assert.match(txt(b('5511112222')),/Revisa/)
for(const x of ['bolsa','1','1','1','1','1','Eva','Dir 2']) e(x)
assert.match(txt(e('1')),/#1/); assert.equal(T.catalogo.find(p=>p.id==='A02').variantes[0].stock,0)
r=txt(b('1')); assert.match(r,/Cambió la disponibilidad/); assert.equal(T.catalogo.find(p=>p.id==='A02').variantes[0].stock,0)
T.mensajeDuena('cancelar 1','d'); assert.equal(T.catalogo.find(p=>p.id==='A02').variantes[0].stock,1)
// registrar, stock, precio
r=T.mensajeDuena('registrar Luz | 55 3333 4444 | Instagram | Av 5 | R01 1 2; A01 1 1','d'); assert.equal(r[0].a,'tel:5533334444'); assert.match(r[1].texto,/Instagram/); assert.match(r[1].texto,/\$677/)
assert.match(txt(T.mensajeDuena('registrar Luz | 55 | IG | x | M01 3 1','d')),/quedan 0/)
assert.match(txt(T.mensajeDuena('stock R01 1 10','d')),/CH · Negro: 10/); assert.match(txt(T.mensajeDuena('precio R01 300','d')),/\$300/)
assert.match(txt(T.mensajeDuena('blabla','d')),/ayuda/)
assert.match(txt(T.mensajeDuena('pedidos entregado','d')),/No hay/)
// clienta ve pedido manual desde su WhatsApp por teléfono
r=T.mensajeCliente({id:'luz@lid',nombre:'Luz',telefono:'5215533334444',texto:'mis pedidos'}); assert.match(txt(r),/Pedido #/)
// límite sin pagar
T=nueva(); const f=x=>T.mensajeCliente({id:'f',nombre:'F',telefono:'5512121212',texto:x})
for(const x of ['aretes','1','1','1','1','F','Dir','1']) f(x)
for(let i=0;i<2;i++) for(const x of ['aretes','1','1','1','1','1']) f(x)
for(const x of ['aretes','1','1','1','1']) f(x); r=txt(f('1')); assert.match(r,/3 pedidos pendientes/)
console.log('LOGICA OK')
