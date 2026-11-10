import assert from 'node:assert/strict'
import fs from 'node:fs'
import {crearTienda} from '../src/logica.js'
const T=crearTienda({config:JSON.parse(fs.readFileSync(new URL('./ejemplo-config.json', import.meta.url))),catalogo:JSON.parse(fs.readFileSync(new URL('./ejemplo-catalogo.json', import.meta.url)))})
let n=0
const nueva=()=>{const id='k'+(n++);return x=>T.mensajeCliente({id,nombre:'A',telefono:'52155'+(20000000+n),texto:x}).map(a=>a.texto).join('\n')}
const P=(prep,m,re)=>{const c=nueva();prep.forEach(c);assert.match(c(m),re,m)}
let c=nueva();c('hola');assert.match(c('gracias'),/Con gusto/);assert.equal(c('ok'),'');assert.equal(c('👍'),'');assert.equal(T.db.clientes['k0'].paso,'menu')
P([],'Buenas tardes tienen vestidos?',/Vestido floral/);P(['hola'],'hola buenas',/En qué/);P(['hola'],'vino mal mi talla',/Cuéntame/)
P(['hola'],'me llegó roto',/Cuéntame/);P(['hola'],'quiero cancelar',/persona/);P(['hola'],'cancelar mi pedido',/persona/);P(['hola'],'ya pagué',/No veo pedidos/)
P(['hola'],'opción 1',/Catálogo/);P(['hola'],'la 2',/ficha/);P(['hola'],'1️⃣',/Catálogo/);P(['hola'],'dos',/ficha/)
P(['hola','blusa'],'talla M negra',/Talla M · Negro\) quieres/);P(['hola','blusa'],'quiero la M',/Hay varias/);P(['hola','blusa'],'en rojo',/Rojo\) quieres/)
P(['hola'],'hay promociones?',/Síguenos/);P(['hola'],'quiero hablar con alguien',/persona/);P(['hola'],'quiero hacer un pedido',/Catálogo/)
// ya pagué con pedido, y una dirección con palabras clave no se confunde
c=nueva();for(const x of ['aretes','1','1','1','1','Ana']) c(x);assert.match(c('Calle Hola 5, buenas tardes'),/Revisa/);c('1');assert.match(c('ya deposité'),/foto o PDF.*#/)
// dueña
const d=x=>T.mensajeDuena(x,'d').map(a=>a.texto).join('\n');assert.match(d('Ver #1'),/Pedido #1/);d('confirmar #1');assert.match(d('listo 1'),/Listo para entregar/);assert.match(d('entregado #1'),/Entregado/)
console.log('NATURAL2 OK')
