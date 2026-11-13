// Cerebro del bot: catálogo, ficha, pedidos, quejas y comandos de la dueña.
// No depende de WhatsApp: recibe mensajes y devuelve lo que hay que enviar.

export const ESTADOS = {
  pendiente_pago: { nombre: 'Pendiente de pago', icono: '🟡' },
  comprobante_revision: { nombre: 'Comprobante en revisión', icono: '🧾' },
  pagado: { nombre: 'Pagado y en proceso', icono: '✅' },
  encargado: { nombre: 'Encargado', icono: '📦' },
  listo: { nombre: 'Listo para entregar', icono: '🎁' },
  en_camino: { nombre: 'En camino', icono: '🛵' },
  entregado: { nombre: 'Entregado', icono: '🎉' },
  cancelado: { nombre: 'Cancelado', icono: '❌' }
}

const RUTA = ['pendiente_pago', 'comprobante_revision', 'pagado', 'listo', 'en_camino', 'entregado']
const CERRADOS = ['entregado', 'cancelado']
const SIN_PAGO = ['pendiente_pago', 'comprobante_revision']
const ALIAS_ESTADO = {
  pendiente: 'pendiente_pago', 'pendiente de pago': 'pendiente_pago',
  revision: 'comprobante_revision', comprobante: 'comprobante_revision',
  pagado: 'pagado', proceso: 'pagado', 'en proceso': 'pagado',
  encargado: 'encargado', listo: 'listo', camino: 'en_camino', 'en camino': 'en_camino',
  entregado: 'entregado', cancelado: 'cancelado'
}
const AVISOS_ESTADO = {
  pendiente_pago: (p) => `🟡 Tu pedido *#${p.id}* está *pendiente de pago*.`,
  pagado: (p) => `✅ ¡Pago confirmado! Tu pedido *#${p.id}* está *en proceso*.`,
  encargado: (p) => `📦 Ya *encargamos* los productos de tu pedido *#${p.id}*. Te avisamos cuando lleguen.`,
  listo: (p) => `🎁 Tu pedido *#${p.id}* está *listo para entregar*. Pronto coordinamos contigo el día y la hora.`,
  en_camino: (p) => `🛵 Tu pedido *#${p.id}* va *en camino* a tu domicilio.`,
  entregado: (p) => `🎉 Tu pedido *#${p.id}* fue *entregado*. ¡Gracias por tu compra!`
}

const MAX_FICHA = 20
const MAX_ENCARGO = 20
const MAX_SIN_PAGAR = 3
const PALABRAS_MENU = new Set(['menu', 'inicio', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi'])
const PASOS_TEXTO = new Set(['datos_nombre', 'datos_direccion', 'datos_telefono', 'queja_texto'])
const VACIAS = new Set(('de la el los las un una unos unas y o en con para por que q me mi tu su lo le al del hay tienes tienen tiene tengo quiero quisiera busco necesito ocupo comprar precio precios cuanto cuesta cuestan vale valen costo stock disponible disponibles talla tallas color colores favor porfa hola buenas buenos dias tardes noches gracias ver info informacion sobre como si no este esta ese esa algo cual cuales saber').split(' '))

const NUMEROS_EN_LETRA = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 }
// Respuestas escritas que equivalen a tocar una opción numerada.
const RESPUESTAS = {
  producto: { si: 1, agregar: 1, agregalo: 1, encargar: 1, 'lo quiero': 1, 'la quiero': 1, volver: 2 },
  tras_agregar: { terminar: 1, listo: 1, 'ver ficha': 1, 'ver mi ficha': 1, 'mi ficha': 1, seguir: 2, 'seguir viendo': 2 },
  ficha_vacia: { si: 1, catalogo: 1 },
  ficha: { confirmar: 1, terminar: 1, 'confirmar pedido': 1, agregar: 2, quitar: 3, vaciar: 4 },
  resumen: { si: 1, confirmo: 1, confirmar: 1, 'confirmar pedido': 1, correcto: 1, corregir: 2, volver: 3 }
}

// Formas en que las clientas escriben las tallas.
const TALLAS = {
  xch: ['xch', 'xs', 'extra chica', 'extrachica'],
  ch: ['ch', 's', 'chica', 'chico', 'chiquita', 'pequeña', 'pequena', 'small'],
  m: ['m', 'mediana', 'mediano', 'medium'],
  g: ['g', 'l', 'grande', 'large'],
  xg: ['xg', 'xl', 'eg', 'extra grande', 'extragrande'],
  xxg: ['xxg', 'xxl', '2xl'],
  unitalla: ['unitalla', 'unica', 'talla unica']
}
const sinonimosTalla = (talla) => {
  const t = norm(talla)
  const grupo = Object.values(TALLAS).find((lista) => lista.includes(t))
  return grupo ? grupo.filter((x) => !x.includes(' ')) : [t]
}
const unirTallas = (t) => t.replace(/\b(extra) (grande|chica)\b/g, '$1$2').replace(/\btalla unica\b/g, 'unitalla')

function cantidadDe(t) {
  const limpio = t.replace(/\b(quiero|dame|me llevo|solo|solamente|nada mas|nomas|por favor|porfa|piezas?|pzas?)\b/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^\d+$/.test(limpio)) return Number(limpio)
  return NUMEROS_EN_LETRA[limpio] ?? null
}

const norm = (s = '') => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/([0-9])\ufe0f?\u20e3/g, '$1').replace(/[¿?¡!.,;:()"']/g, ' ').replace(/\s+/g, ' ').trim()

function raiz(palabra) {
  let w = palabra
  if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
  if (w.length > 3 && /[aoe]$/.test(w)) w = w.slice(0, -1)
  return w
}

const CORTESIAS = new Set('gracias gracia muchas mil ok okay oki va sale si no vale perfecto perfecta excelente listo bien muy claro entendido genial dale ntp bye adios hasta luego'.split(' '))
const quitarSaludo = (t) => t.replace(/\b(hola+|holis?|ola|hello|hey|buen[ao]?s?(?: dias?| tardes?| noches?)?|que tal|como estas|disculpa|disculpe|oye|oiga|amiga|saludos)\b/g, ' ').replace(/\s+/g, ' ').trim()
const esCortesia = (t) => !/[a-z0-9]/.test(t) || t.split(' ').every((w) => CORTESIAS.has(w))
const frase = (s) => norm(s).split(' ').map(raiz).join(' ')
const contiene = (texto, claves) => claves.some((k) => ` ${texto} `.includes(` ${frase(k)} `))
const dinero = (n) => `$${Number(n).toLocaleString('es-MX')}`
const soloDigitos = (s) => String(s || '').replace(/\D/g, '')
const mismoTel = (a, b) => !!a && !!b && soloDigitos(a).slice(-10) === soloDigitos(b).slice(-10)
const detalle = (x) => [x.talla && `Talla ${x.talla}`, x.color].filter(Boolean).join(' · ')
const nombreLinea = (l) => `${l.nombre}${detalle(l) ? ` (${detalle(l)})` : ''}`
const opcion = (n, t) => `*${n}.* ${t}`
const PIE_MENU = opcion(0, 'Menú principal')

export function crearTienda({ config, catalogo, datos = {}, guardar = () => {}, ahora = () => Date.now(), version = '' }) {
  const db = Object.assign({ pedidos: [], casos: [], clientes: {}, asistentes: {}, modoClienta: {}, sigPedido: 1, sigCaso: 1 }, datos)
  db.modoClienta ||= {}
  config.duenas ||= []
  config.redes ||= []
  config.faq ||= []
  config.pago ||= { banco: '', titular: '', clabe: '' }
  config.recordatorioHoras ??= 12
  config.vencimientoHoras ??= 48
  const fecha = (ms) => new Date(ms).toLocaleString('es-MX', {
    timeZone: config.zonaHoraria || 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short'
  })
  const buscarProducto = (id) => catalogo.find((p) => norm(p.id) === norm(id))
  const categorias = () => [...new Set(catalogo.map((p) => p.categoria))]
  const stockTotal = (p) => p.variantes.reduce((a, v) => a + v.stock, 0)
  const buscarPedido = (id) => db.pedidos.find((p) => p.id === Number(id))
  const buscarCaso = (id) => db.casos.find((c) => c.id === Number(id))
  const total = (lineas) => lineas.reduce((a, l) => a + l.cantidad * l.precio, 0)
  const costoEnvio = () => Number(config.costoEnvio) || 0

  const faqVisibles = () => config.faq.filter((f) => f.respuesta)
  const textoRedes = () => (config.redes.length
    ? `📲 *Síguenos para ver novedades, productos y promociones:*\n${config.redes.map((r) => `• ${r.nombre}: ${r.url}`).join('\n')}`
    : 'Pronto compartiremos nuestras redes sociales. 💖')
  const cierreCompra = (p) => `${AVISOS_ESTADO.pagado(p)}\n\nGracias por tu compra. 💖${config.redes.length ? `\n\n${textoRedes()}` : ''}`
  const textoPago = (p) => {
    const d = config.pago
    if (!d.clabe) return `💳 En un momento te compartimos los datos para transferir.${p ? `\nMonto: *${dinero(p.total)}*` : ''}`
    return `💳 *Datos para transferencia*\nBanco: ${d.banco}\nTitular: ${d.titular}\n${String(d.clabe).length === 18 ? 'CLABE' : 'Cuenta o tarjeta'}: ${d.clabe}${p ? `\nConcepto: Pedido ${p.id}\nMonto: *${dinero(p.total)}*` : ''}`
  }

  function etiquetaStock(p) {
    const n = stockTotal(p)
    if (n > 0) return `${n} disponible${n === 1 ? '' : 's'}`
    return p.encargable ? 'Agotado, se puede encargar' : 'Agotado'
  }

  function indexar(p) {
    const partes = [p.nombre, p.categoria, p.descripcion, ...p.variantes.flatMap((v) => [v.color, v.talla])]
    return new Set(partes.filter(Boolean).flatMap((x) => norm(x).split(' ')).filter((w) => w.length >= 3).map(raiz))
  }

  function buscarProductos(t) {
    const palabras = t.split(' ').filter((w) => !VACIAS.has(w))
    const directo = palabras.map(buscarProducto).find(Boolean)
    if (directo) return [directo]
    const raices = palabras.filter((w) => w.length >= 3).map(raiz)
    if (!raices.length) return []
    const puntuados = catalogo.map((p) => {
      const indice = indexar(p)
      return { p, puntos: raices.filter((r) => indice.has(r)).length }
    }).filter((x) => x.puntos > 0)
    const mejor = Math.max(0, ...puntuados.map((x) => x.puntos))
    return puntuados.filter((x) => x.puntos === mejor).map((x) => x.p).slice(0, 10)
  }

  function cliente(id, nombre, telefono) {
    if (!db.clientes[id]) db.clientes[id] = { id, perfil: '', nombre: '', telefono: '', direccion: '', paso: 'nuevo', ficha: [], fallos: 0 }
    const c = db.clientes[id]
    if (nombre) c.perfil = String(nombre).replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (telefono) c.telefono = soloDigitos(telefono)
    return c
  }

  const pedidosDe = (c) => db.pedidos.filter((p) => p.clienteId === c.id || mismoTel(p.telefono, c.telefono))

  function lineasTexto(lineas) {
    return lineas.map((l) => `• ${nombreLinea(l)}\n   ${l.cantidad} × ${dinero(l.precio)} = ${dinero(l.cantidad * l.precio)}${l.encargo ? ' _(encargo)_' : ''}`).join('\n')
  }

  function etapas(p) {
    if (p.estado === 'cancelado') return '❌ Pedido cancelado'
    const usaEncargo = p.estado === 'encargado' || p.historial.some((h) => h.estado === 'encargado')
    const ruta = usaEncargo ? [...RUTA.slice(0, 3), 'encargado', ...RUTA.slice(3)] : RUTA
    const actual = ruta.indexOf(p.estado)
    return ruta.map((e, i) => `${i < actual || p.estado === 'entregado' ? '✅' : i === actual ? '👉' : '▫️'} ${ESTADOS[e].nombre}`).join('\n')
  }

  function fichaDuena(p) {
    return [
      `🛍️ *Pedido #${p.id}* · ${ESTADOS[p.estado].icono} ${ESTADOS[p.estado].nombre}`,
      `👤 ${p.nombre}`,
      `📞 ${p.telefono || 'Sin número'}`,
      `📍 ${p.direccion}`,
      `Canal: ${p.canal} · ${fecha(p.creado)}`,
      '',
      lineasTexto(p.lineas),
      p.envio ? `Envío: ${dinero(p.envio)}` : '',
      `*Total: ${dinero(p.total)}*`,
      p.entrega ? `📅 Entrega: ${p.entrega}` : ''
    ].filter((x, i) => x !== '' || i === 5).join('\n')
  }

  // Se busca por talla y color porque las opciones de un producto se pueden editar.
  const varianteDe = (l) => buscarProducto(l.productoId)?.variantes.find((v) => (v.talla || '') === l.talla && (v.color || '') === l.color)

  function reservar(lineas) {
    for (const l of lineas) {
      if (l.encargo) continue
      const v = varianteDe(l)
      if (v) v.stock -= l.cantidad
    }
  }

  function devolverStock(p) {
    for (const l of p.lineas) {
      if (l.encargo) continue
      const v = varianteDe(l)
      if (v) v.stock += l.cantidad
    }
  }

  function registrarEstado(p, estado) {
    p.estado = estado
    p.historial.push({ estado, fecha: ahora() })
  }

  // ===== CLIENTAS =====
  function mensajeCliente(m) {
    const acciones = []
    const c = cliente(m.id, m.nombre, m.telefono)
    const crudo = String(m.texto || '').trim().slice(0, 2000)
    const t = norm(crudo)
    const limpio = quitarSaludo(t)
    const esSaludo = PALABRAS_MENU.has(t) || (!!t && !limpio)
    const decir = (texto, extra = {}) => acciones.push({ tipo: 'cliente', a: c.id, texto, ...extra })
    const avisar = (texto, extra = {}) => acciones.push({ tipo: 'duena', texto, ...extra })
    const fin = () => { guardar(); return acciones }
    const ir = (paso, extra = {}) => { c.paso = paso; Object.assign(c, extra) }
    const nombreCliente = () => c.nombre || c.perfil || 'Clienta'

    const menu = (saludo = false) => {
      ir('menu')
      c.fallos = 0
      decir(`${saludo ? `${config.bienvenida || `¡Hola${c.perfil ? ` ${c.perfil}` : ''}! 👋 Soy la asistente de *${config.tienda}*.`}\n\n` : ''}¿En qué te ayudo?\n\n${[
        opcion(1, 'Ver catálogo'), opcion(2, 'Mi ficha de pedido'), opcion(3, 'Estado de mis pedidos'),
        opcion(4, 'Datos para transferencia'), opcion(5, 'Preguntas frecuentes'),
        opcion(6, 'Reportar un problema o queja'), opcion(7, 'Redes sociales'), opcion(8, 'Hablar con una persona')
      ].join('\n')}\n\nTambién puedes escribirme el producto que buscas, por ejemplo: _labial rojo_.`)
    }

    const verCategorias = () => {
      const lista = categorias()
      if (!lista.length) {
        ir('menu')
        decir(`Estamos preparando nuestro catálogo. 🛍️ Escribe *8* si quieres hablar con una persona.\n\n${PIE_MENU}`)
        return
      }
      ir('categorias', { opciones: lista })
      decir(`🛍️ *Catálogo*\n\n${lista.map((x, i) => opcion(i + 1, x)).join('\n')}\n\n${PIE_MENU}`)
    }

    const verProducto = (p) => {
      ir('producto', { productoId: p.id })
      const variantes = p.variantes.map((v) => {
        const estado = v.stock > 0 ? `${v.stock} disponible${v.stock === 1 ? '' : 's'}` : p.encargable ? 'agotado, se puede encargar' : 'agotado'
        return `• ${detalle(v) || 'Pieza'}: ${estado}`
      }).join('\n')
      const puede = stockTotal(p) > 0 || p.encargable
      decir(`*${p.nombre}* (${p.id})\n${p.descripcion ? `${p.descripcion}\n` : ''}💰 *${dinero(p.precio)}*\n\n${variantes}\n\n${[
        puede ? opcion(1, stockTotal(p) > 0 ? 'Agregar a mi ficha' : 'Encargar') : '',
        opcion(2, 'Volver al catálogo'), PIE_MENU
      ].filter(Boolean).join('\n')}`, p.foto ? { imagen: p.foto } : {})
    }

    const verProductos = (lista, titulo) => {
      if (lista.length === 1) return verProducto(lista[0])
      ir('productos', { opciones: lista.map((p) => p.id) })
      decir(`*${titulo}*\n\n${lista.map((p, i) => `${opcion(i + 1, p.nombre)}\n   ${dinero(p.precio)} · ${etiquetaStock(p)}`).join('\n')}\n\nResponde con el número para ver tallas y colores.\n${PIE_MENU}`)
    }

    const verFicha = () => {
      if (!c.ficha.length) {
        ir('ficha_vacia')
        decir(`🧾 Tu ficha está vacía.\n\n${opcion(1, 'Ver catálogo')}\n${PIE_MENU}`)
        return
      }
      ir('ficha')
      decir(`🧾 *Tu ficha de pedido*\n\n${lineasTexto(c.ficha)}\n\n*Subtotal: ${dinero(total(c.ficha))}*\n\n${[
        opcion(1, 'Confirmar pedido'), opcion(2, 'Agregar otro producto'), opcion(3, 'Quitar un producto'), opcion(4, 'Vaciar ficha'), PIE_MENU
      ].join('\n')}`)
    }

    const pedirCantidad = (p, indice) => {
      const v = p.variantes[indice]
      const enFicha = c.ficha.find((l) => l.productoId === p.id && l.variante === indice)?.cantidad || 0
      const encargo = v.stock === 0
      const maximo = encargo ? MAX_ENCARGO - enFicha : v.stock - enFicha
      if (maximo <= 0) {
        decir(`Ya tienes en tu ficha todas las piezas disponibles de esa opción.\n\n${opcion(1, 'Ver mi ficha')}\n${PIE_MENU}`)
        ir('tras_agregar')
        return
      }
      ir('cantidad', { varianteElegida: indice, maximo })
      decir(`¿Cuántas piezas de *${p.nombre}*${detalle(v) ? ` (${detalle(v)})` : ''} quieres?${encargo ? '' : ` Hay ${maximo}.`}`)
    }

    const pedirDatos = () => {
      if (c.nombre && c.direccion && c.telefono) return resumen()
      ir('datos_nombre')
      decir('Para tu pedido necesito unos datos.\n\n¿A nombre de quién va?')
    }

    const resumen = () => {
      ir('resumen')
      const envio = costoEnvio()
      decir(`📝 *Revisa tu pedido*\n\n${lineasTexto(c.ficha)}${envio ? `\nEnvío: ${dinero(envio)}` : ''}\n\n*Total: ${dinero(total(c.ficha) + envio)}*\n\n👤 ${c.nombre}\n📞 ${c.telefono}\n📍 ${c.direccion}\n\n${[
        opcion(1, 'Confirmar pedido'), opcion(2, 'Corregir mis datos'), opcion(3, 'Volver a mi ficha')
      ].join('\n')}`)
    }

    const confirmarPedido = () => {
      if (pedidosDe(c).filter((p) => p.estado === 'pendiente_pago').length >= MAX_SIN_PAGAR) {
        ir('menu')
        decir(`Tienes ${MAX_SIN_PAGAR} pedidos pendientes de pago. Paga alguno de ellos antes de hacer otro, o escribe *8* para hablar con una persona.`)
        return
      }
      const ajustes = []
      c.ficha = c.ficha.filter((l) => {
        const variante = varianteDe(l)
        if (!variante) {
          ajustes.push(`${nombreLinea(l)}: ya no está disponible`)
          return false
        }
        if (l.encargo) return true
        const disponible = variante.stock
        if (disponible >= l.cantidad) return true
        ajustes.push(`${nombreLinea(l)}: quedan ${disponible}`)
        if (disponible === 0) return false
        l.cantidad = disponible
        return true
      })
      if (ajustes.length) {
        decir(`⚠️ Cambió la disponibilidad mientras llenabas tu ficha:\n${ajustes.join('\n')}\n\nLa ajusté; revísala antes de confirmar.`)
        verFicha()
        return
      }
      const envio = costoEnvio()
      const p = {
        id: db.sigPedido++, clienteId: c.id, nombre: c.nombre, telefono: c.telefono, direccion: c.direccion,
        canal: 'WhatsApp', lineas: c.ficha.map((l) => ({ ...l })), envio, total: total(c.ficha) + envio,
        estado: 'pendiente_pago', historial: [{ estado: 'pendiente_pago', fecha: ahora() }], comprobantes: 0, creado: ahora()
      }
      reservar(p.lineas)
      db.pedidos.push(p)
      c.ficha = []
      ir('menu')
      decir(`🎉 ¡Recibimos tu pedido *#${p.id}*! Está *pendiente de pago*.\n\n${textoPago(p)}\n\nCuando transfieras, envíame aquí la *foto o PDF de tu comprobante* para revisarlo.`)
      avisar(`🆕 *Nuevo pedido*\n\n${fichaDuena(p)}\n\nPendiente de pago. Para cancelarlo: *cancelar ${p.id}*`)
    }

    const verMisPedidos = () => {
      const lista = pedidosDe(c).slice(-5).reverse()
      ir('menu')
      if (!lista.length) {
        decir(`Todavía no tienes pedidos.\n\n${opcion(1, 'Ver catálogo')}\n${PIE_MENU}`)
        return
      }
      decir(`📦 *Tus pedidos*\n\n${lista.map((p) => `*Pedido #${p.id}* · ${dinero(p.total)}\n${p.lineas.map((l) => `${l.cantidad} × ${nombreLinea(l)}`).join('\n')}\n\n${etapas(p)}`).join('\n\n———\n\n')}\n\n${PIE_MENU}`)
    }

    const verFaq = () => {
      if (!faqVisibles().length) {
        ir('menu')
        decir(`Todavía no tenemos preguntas frecuentes. Escribe *8* para hablar con una persona.\n\n${PIE_MENU}`)
        return
      }
      ir('faq')
      decir(`❓ *Preguntas frecuentes*\n\n${faqVisibles().map((f, i) => opcion(i + 1, f.pregunta)).join('\n')}\n\n${PIE_MENU}`)
    }

    const nuevoCaso = (tipo, texto, pedidoId) => {
      const caso = { id: db.sigCaso++, tipo, clienteId: c.id, nombre: nombreCliente(), telefono: c.telefono, texto, pedidoId: pedidoId || null, estado: 'abierto', creado: ahora() }
      db.casos.push(caso)
      return caso
    }

    const pasarAPersona = (motivo) => {
      const caso = nuevoCaso('atencion', motivo)
      ir('humano', { casoAtencion: caso.id, humanoHasta: ahora() + (config.horasAtencion || 12) * 3600000 })
      decir('👤 Te paso con una persona de nuestro equipo. Te contestamos por este chat en cuanto podamos.\n\nSi quieres volver al menú automático, escribe *menu*.')
      avisar(`🙋 *Una clienta necesita atención* (caso ${caso.id})\n\n👤 ${caso.nombre}\n📞 ${caso.telefono || 'Sin número'}\n💬 ${motivo}\n\nTe reenviaré aquí lo que escriba. El bot no le contestará hasta que termines.\nPara contestarle: *responder ${caso.id} tu mensaje*\nAl terminar: *cerrar ${caso.id}*`)
    }

    const iniciarQueja = () => {
      ir('queja_texto')
      decir('Lamento el inconveniente. 🙏 Cuéntame qué pasó, y si tienes número de pedido, inclúyelo.')
    }

    const noEntendi = () => {
      c.fallos = (c.fallos || 0) + 1
      if (c.fallos >= (config.fallosParaPasar || 2)) {
        c.fallos = 0
        pasarAPersona(`El bot no pudo resolver: "${crudo.slice(0, 300)}"`)
      } else {
        decir('No te entendí. 😅 Escribe *menu* para ver las opciones o dime el producto que buscas.')
      }
    }

    function interpretarLibre() {
      if (esCortesia(limpio) && c.paso !== 'cantidad') {
        if (ahora() - (c.cortesiaEn || 0) > 600000) decir('¡Con gusto! 💖 Si necesitas algo más, escribe *menu*.')
        c.cortesiaEn = ahora()
        return true
      }
      const f = frase(limpio)
      if (contiene(f, ['queja', 'reclamo', 'reportar', 'problema', 'inconveniente', 'roto', 'rota', 'dañado', 'dañada', 'defecto', 'mal estado', 'vino mal', 'llego mal', 'no llego', 'no me llego', 'no ha llegado', 'no me ha llegado', 'fraude', 'estafa'])) { iniciarQueja(); return true }
      if (contiene(f, ['cancelar', 'ya no lo quiero', 'ya no la quiero', 'ya no quiero'])) { pasarAPersona(`La clienta quiere cancelar: "${crudo.slice(0, 300)}"`); return true }
      if (contiene(f, ['persona', 'humano', 'asesora', 'asesor', 'agente', 'encargada', 'dueña', 'operadora', 'hablar con', 'me atiende', 'me atiendan'])) { pasarAPersona(`La clienta pidió atención: "${crudo.slice(0, 300)}"`); return true }
      if (contiene(f, ['ya pague', 'ya pago', 'ya te pague', 'ya deposite', 'ya transferi', 'ya hice la transferencia', 'ya hice el deposito', 'ya hice el pago', 'ya realice el pago', 'ya esta pagado', 'comprobante'])) {
        const pendiente = pedidosDe(c).filter((p) => p.estado === 'pendiente_pago').pop()
        decir(pendiente ? `¡Gracias! 🧾 Envíame aquí la *foto o PDF de tu comprobante* del pedido *#${pendiente.id}* para revisarlo.` : `No veo pedidos pendientes de pago en este número. Si ya hiciste uno, escribe *8* y te ayuda una persona.`)
        return true
      }
      if (contiene(f, ['redes', 'instagram', 'facebook', 'tiktok', 'redes sociales', 'promocion', 'promociones', 'descuento', 'descuentos', 'oferta', 'ofertas', 'novedades'])) { decir(textoRedes()); return true }
      if (contiene(f, ['mi pedido', 'mis pedidos', 'estado de mi pedido', 'donde viene', 'va mi pedido', 'ya viene', 'mi compra', 'mi paquete', 'estado', 'estatus', 'status', 'seguimiento'])) { verMisPedidos(); return true }
      if (contiene(f, ['ficha', 'carrito'])) { verFicha(); return true }
      if (contiene(f, ['clabe', 'datos de pago', 'datos bancarios', 'numero de cuenta', 'transferir', 'deposito', 'a que cuenta', 'donde pago', 'donde deposito'])) { decir(textoPago()); return true }
      const faq = config.faq.find((x) => contiene(f, x.claves || []))
      if (faq?.respuesta) { decir(faq.respuesta); return true }
      if (faq) { pasarAPersona(`Pregunta sin respuesta configurada: "${crudo.slice(0, 300)}"`); return true }
      const productos = buscarProductos(limpio)
      if (productos.length) { verProductos(productos, 'Esto encontré'); return true }
      if (contiene(f, ['catalogo', 'productos', 'hacer pedido', 'hacer un pedido', 'quiero pedir', 'ordenar', 'comprar', 'encargar', 'que venden', 'que vendes', 'que tienes', 'que tienen', 'ver todo'])) { verCategorias(); return true }
      return false
    }

    const PASOS = {
      menu: (n) => {
        const acciones_menu = { 1: verCategorias, 2: verFicha, 3: verMisPedidos, 4: () => decir(textoPago()), 5: verFaq, 6: iniciarQueja, 7: () => decir(textoRedes()), 8: () => pasarAPersona('La clienta pidió hablar con una persona.') }
        if (!acciones_menu[n]) return false
        acciones_menu[n]()
        return true
      },
      categorias: (n) => {
        const cat = c.opciones[n - 1]
        if (!cat) return false
        verProductos(catalogo.filter((p) => p.categoria === cat), cat)
        return true
      },
      productos: (n) => {
        const p = buscarProducto(c.opciones[n - 1] || '')
        if (!p) return false
        verProducto(p)
        return true
      },
      producto: (n) => {
        const p = buscarProducto(c.productoId)
        if (n === 2) { verCategorias(); return true }
        if (n !== 1 || !p || (stockTotal(p) === 0 && !p.encargable)) return false
        if (c.ficha.length >= MAX_FICHA) { decir('Tu ficha ya está llena. Confirma este pedido y haz otro para agregar más.'); return true }
        const validas = p.variantes.map((v, i) => ({ v, i })).filter((x) => x.v.stock > 0 || p.encargable)
        if (validas.length === 1) { pedirCantidad(p, validas[0].i); return true }
        ir('variante', { opciones: validas.map((x) => x.i) })
        decir(`Elige la opción de *${p.nombre}*:\n\n${validas.map((x, i) => `${opcion(i + 1, detalle(x.v) || 'Pieza')}${x.v.stock === 0 ? ' _(encargo)_' : ` — ${x.v.stock} disp.`}`).join('\n')}\n\n${PIE_MENU}`)
        return true
      },
      variante: (n) => {
        const p = buscarProducto(c.productoId)
        const indice = c.opciones[n - 1]
        if (!p || indice === undefined) return false
        pedirCantidad(p, indice)
        return true
      },
      cantidad: (n) => {
        const p = buscarProducto(c.productoId)
        if (!p) return false
        if (n < 1 || n > c.maximo) { decir(`Escribe un número del 1 al ${c.maximo}.`); return true }
        const v = p.variantes[c.varianteElegida]
        const existente = c.ficha.find((l) => l.productoId === p.id && l.variante === c.varianteElegida)
        if (existente) existente.cantidad += n
        else c.ficha.push({ productoId: p.id, variante: c.varianteElegida, nombre: p.nombre, talla: v.talla || '', color: v.color || '', cantidad: n, precio: p.precio, encargo: v.stock === 0 })
        ir('tras_agregar')
        decir(`✅ Agregado a tu ficha.\n\n${opcion(1, 'Ver mi ficha y terminar')}\n${opcion(2, 'Seguir viendo el catálogo')}\n${PIE_MENU}`)
        return true
      },
      tras_agregar: (n) => {
        if (n === 1) { verFicha(); return true }
        if (n === 2) { verCategorias(); return true }
        return false
      },
      ficha_vacia: (n) => {
        if (n !== 1) return false
        verCategorias()
        return true
      },
      ficha: (n) => {
        if (n === 1) { pedirDatos(); return true }
        if (n === 2) { verCategorias(); return true }
        if (n === 3) {
          ir('quitar')
          decir(`¿Cuál quito?\n\n${c.ficha.map((l, i) => opcion(i + 1, `${nombreLinea(l)} × ${l.cantidad}`)).join('\n')}\n\n${PIE_MENU}`)
          return true
        }
        if (n === 4) { c.ficha = []; verFicha(); return true }
        return false
      },
      quitar: (n) => {
        if (!c.ficha[n - 1]) return false
        c.ficha.splice(n - 1, 1)
        verFicha()
        return true
      },
      resumen: (n) => {
        if (n === 1) { confirmarPedido(); return true }
        if (n === 2) { c.nombre = ''; c.direccion = ''; pedirDatos(); return true }
        if (n === 3) { verFicha(); return true }
        return false
      },
      faq: (n) => {
        const f = faqVisibles()[n - 1]
        if (!f) return false
        decir(`${f.respuesta}\n\nEscribe otro número o *0* para el menú.`)
        return true
      }
    }

    const PASOS_LIBRES = {
      datos_nombre: () => {
        c.nombre = crudo.slice(0, 60)
        ir('datos_direccion')
        decir('¿Cuál es la dirección de entrega? Incluye calle, número, colonia y alguna referencia.')
      },
      datos_direccion: () => {
        c.direccion = crudo.slice(0, 250)
        if (c.telefono) return resumen()
        ir('datos_telefono')
        decir('¿A qué número te contactamos para la entrega? Escríbelo a 10 dígitos.')
      },
      datos_telefono: () => {
        const tel = soloDigitos(crudo)
        if (tel.length < 10 || tel.length > 13) { decir('Ese número no parece correcto. Escríbelo a 10 dígitos.'); return }
        c.telefono = tel
        resumen()
      },
      queja_texto: () => {
        const texto = crudo.slice(0, 700)
        const numero = texto.match(/#\s*(\d+)|pedido\s*(\d+)/i)
        const posible = numero ? buscarPedido(numero[1] || numero[2]) : null
        const pedido = posible && pedidosDe(c).includes(posible) ? posible : null
        const caso = nuevoCaso('queja', texto, pedido?.id)
        ir('menu')
        decir(`Registré tu reporte con el número *${caso.id}*. Lo revisamos y te contestamos por aquí. 🙏\n\n${PIE_MENU}`)
        avisar(`⚠️ *Nueva queja* (caso ${caso.id})\n\n👤 ${caso.nombre}\n📞 ${caso.telefono || 'Sin número'}${pedido ? `\nPedido #${pedido.id}` : ''}\n💬 ${texto}\n\nAl resolverla: *cerrar ${caso.id} tu mensaje*`)
      }
    }

    // ----- Comprobantes y archivos -----
    if (m.media) {
      const esComprobante = /^(image\/|application\/pdf)/.test(m.media.mime || '')
      const enAtencion = c.paso === 'humano' && ahora() <= (c.humanoHasta || 0)
      if (!esComprobante) {
        if (enAtencion) avisar(`📎 *${nombreCliente()}* (caso ${c.casoAtencion}) envió un archivo. Revísalo en el WhatsApp del bot.`)
        else decir('Por ahora solo puedo leer texto y comprobantes en foto o PDF. Escríbeme tu duda, o *8* para hablar con una persona.')
        return fin()
      }
      const abiertos = pedidosDe(c).filter((p) => SIN_PAGO.includes(p.estado))
      if (abiertos.length) {
        const citado = crudo.match(/\d+/)
        const pedido = (citado && abiertos.find((p) => p.id === Number(citado[0])))
          || [...abiertos].reverse().find((p) => p.estado === 'pendiente_pago')
          || abiertos[abiertos.length - 1]
        if (pedido.estado !== 'comprobante_revision') registrarEstado(pedido, 'comprobante_revision')
        pedido.comprobantes += 1
        if (c.paso === 'nuevo') ir('menu')
        decir(`🧾 Recibí tu comprobante del pedido *#${pedido.id}*. Lo revisamos y te avisamos en cuanto se confirme.`)
        avisar(`🧾 *Comprobante recibido*\n\n${fichaDuena(pedido)}\n\nSi el pago está bien: *confirmar ${pedido.id}*\nSi no: *rechazar ${pedido.id} motivo*`, { adjuntarComprobante: pedido.id })
        return fin()
      }
      if (enAtencion) {
        avisar(`📎 *${nombreCliente()}* (caso ${c.casoAtencion}) envió un archivo. Revísalo en el WhatsApp del bot.`)
        return fin()
      }
      if (!t) {
        decir('Recibí tu archivo, pero no tienes pedidos pendientes de pago. Si necesitas ayuda, escribe *8* para hablar con una persona.')
        return fin()
      }
    }

    if (!t) return fin()

    // ----- Conversación atendida por una persona -----
    if (c.paso === 'humano') {
      const vencido = ahora() > (c.humanoHasta || 0)
      if (t !== 'menu' && !vencido) {
        avisar(`💬 *${nombreCliente()}* (caso ${c.casoAtencion}):\n${crudo.slice(0, 1500)}\n\nPara contestarle: *responder ${c.casoAtencion} tu mensaje*`)
        return fin()
      }
      const caso = buscarCaso(c.casoAtencion)
      if (caso) caso.estado = 'cerrado'
      if (t === 'menu') { menu(); return fin() }
      c.paso = 'menu'
    }

    // ----- Primer mensaje -----
    if (c.paso === 'nuevo') {
      c.paso = 'menu'
      if (esSaludo || !interpretarLibre()) menu(true)
      return fin()
    }

    // ----- Pasos donde la clienta escribe libremente -----
    if (PASOS_TEXTO.has(c.paso)) {
      if (t === 'menu' || t === '0' || t === 'cancelar') menu()
      else PASOS_LIBRES[c.paso]()
      return fin()
    }

    if (esSaludo || t === '0') { menu(); return fin() }

    const elegida = t.match(/^(?:el |la )?(?:opcion |numero )*(\d+)$/)
    let numero = elegida ? Number(elegida[1]) : c.paso === 'cantidad' ? null : NUMEROS_EN_LETRA[t] ?? null
    if (numero === null && c.paso === 'cantidad') numero = cantidadDe(t)
    if (numero === null) numero = RESPUESTAS[c.paso]?.[t] ?? null
    if (numero === null && (c.paso === 'variante' || c.paso === 'producto')) {
      const p = buscarProducto(c.productoId)
      const palabras = unirTallas(t).split(' ').filter((w) => !VACIAS.has(w))
      const indices = !p ? [] : c.paso === 'variante' ? c.opciones : p.variantes.map((_v, i) => i).filter((i) => p.variantes[i].stock > 0 || p.encargable)
      const coincidencias = !palabras.length ? [] : indices.filter((i) => {
        const v = p.variantes[i]
        const tallas = v.talla ? sinonimosTalla(v.talla) : []
        const valores = [...tallas, ...tallas.map(raiz), ...norm(v.color || '').split(' ').map(raiz)].filter(Boolean)
        return palabras.every((w) => valores.includes(w) || valores.includes(raiz(w)))
      })
      if (coincidencias.length > 1) {
        decir(`Hay varias opciones así: ${coincidencias.map((i) => detalle(p.variantes[i])).join(', ')}. Dime la talla y el color.`)
        return fin()
      }
      if (coincidencias.length === 1) {
        c.fallos = 0
        pedirCantidad(p, coincidencias[0])
        return fin()
      }
    }
    const manejado = (numero !== null && PASOS[c.paso]?.(numero)) || (numero === null && interpretarLibre())
    if (manejado) c.fallos = 0
    else if (c.paso === 'cantidad') decir(`Dime cuántas piezas quieres, del 1 al ${c.maximo}.`)
    else noEntendi()
    return fin()
  }

  // ===== DUEÑA =====
  const AYUDA = `🛠️ *Comandos*

⚙️ *Tu tienda*
*probar* — te atiende como clienta para que pruebes el bot
*ajustes* — nombre, saludo, banco, envío, redes, preguntas, categorías y pagos
*dueñas* — agrega o quita números de dueña

🛍️ *Productos*
*productos* — lista completa
*agregar* — crea un producto paso a paso
*editar R01* — cambia cualquier dato o bórralo
*stock R01* — ve las existencias
*stock R01 2 10* — pone 10 a la opción 2
*precio R01 299* — cambia el precio
*foto R01* — envía una foto con ese texto para ponerla al producto
*quitarfoto R01* — quita la foto

📋 *Pedidos*
*pedidos* — activos por estado
*pedidos pagado* — filtra por estado
*ver 12* — detalle del pedido
*confirmar 12* — confirma el pago
*rechazar 12 motivo* — rechaza el comprobante
*estado 12 listo* — cambia el estado
   (pendiente, proceso, encargado, listo, camino, entregado)
*cancelar 12 motivo* — cancela y regresa el stock
*registrar* — pedido de Instagram u otra red

*entrega 12 sábado 4 pm* — avisa día y hora de entrega
*mensaje 12 texto* — le escribe a la clienta del pedido

📌 *Atención*
*casos* — quejas y atenciones abiertas
*responder 3 texto* — le contesta a la clienta del caso
*cerrar 3 mensaje* — cierra un caso

📊 *Reportes*
*resumen* — ventas de hoy y de la semana
*exportar* — archivo de pedidos para Excel
*version* — versión del bot instalada`

  // ===== AJUSTES DESDE WHATSAPP =====
  const OMITIR = new Set(['no', 'ninguna', 'ninguno', 'omitir'])

  function pendientes() {
    const lista = []
    if (config.tienda === 'Mi Tienda') lista.push('Nombre de la tienda')
    if (!config.pago.clabe) lista.push('Datos bancarios')
    if (!config.redes.length) lista.push('Redes sociales')
    const sinRespuesta = config.faq.filter((f) => !f.respuesta).map((f) => f.pregunta)
    if (sinRespuesta.length) lista.push(`Respuestas de: ${sinRespuesta.join(', ')}`)
    if (!catalogo.length) lista.push('Productos (escribe *agregar*)')
    return lista
  }

  const textoPendientes = () => {
    const lista = pendientes()
    return lista.length ? `⚠️ *Falta configurar:*\n${lista.map((x) => `• ${x}`).join('\n')}` : '✅ Tu tienda ya está configurada.'
  }

  function generarCodigo(categoria) {
    const letra = (norm(categoria).replace(/[^a-z]/g, '')[0] || 'p').toUpperCase()
    for (let n = 1; ; n++) {
      const codigo = `${letra}${String(n).padStart(2, '0')}`
      if (!buscarProducto(codigo)) return codigo
    }
  }

  function leerOpciones(texto, forma) {
    const esperados = (forma.talla ? 1 : 0) + (forma.color ? 1 : 0) + 1
    const variantes = []
    for (const linea of texto.split('\n').map((x) => x.trim()).filter(Boolean)) {
      const partes = (linea.includes(',') ? linea.split(',') : linea.split(/\s+/)).map((x) => x.trim()).filter(Boolean)
      const stock = Number(partes[partes.length - 1])
      if (partes.length !== esperados || !Number.isInteger(stock) || stock < 0) return { error: linea }
      const v = { stock }
      let i = 0
      if (forma.talla) v.talla = partes[i++].slice(0, 20).toUpperCase()
      if (forma.color) v.color = partes[i].slice(0, 30).replace(/^./, (x) => x.toUpperCase())
      variantes.push(v)
    }
    return variantes.length ? { variantes } : { error: texto }
  }

  const ejemploOpciones = (forma) => (forma.talla && forma.color ? 'CH, Negro, 3\nM, Rojo, 2' : forma.talla ? 'CH, 3\nM, 2' : 'Rojo, 6\nAzul marino, 4')
  const textoProducto = (p) => `📦 *${p.nombre}* (${p.id})\nCategoría: ${p.categoria}\nPrecio: ${dinero(p.precio)}\nDescripción: ${p.descripcion || 'Sin descripción'}\nSe puede encargar: ${p.encargable ? 'Sí' : 'No'}\n\n${p.variantes.map((v, i) => `${i + 1}. ${detalle(v) || 'Pieza'}: ${v.stock}`).join('\n')}`

  function crearFlujo(remitente, responder) {
    const terminar = () => { delete db.asistentes[remitente] }
    const preguntar = (paso, texto, datos = {}) => {
      db.asistentes[remitente] = { paso, datos, en: ahora() }
      responder(`${texto}\n\n_Escribe *salir* para terminar._`)
    }
    const invalido = (texto) => responder(`${texto}\n\n_Escribe *salir* para terminar._`)

    const menuAjustes = (prefijo = '') => {
      const d = config.pago
      preguntar('aj_menu', `${prefijo}⚙️ *Ajustes de la tienda*\n\n${[
        opcion(1, `Nombre: ${config.tienda}`),
        opcion(2, `Saludo: ${config.bienvenida ? 'personalizado' : 'normal'}`),
        opcion(3, `Banco: ${d.clabe ? `${d.banco} ····${String(d.clabe).slice(-4)}` : 'sin configurar'}`),
        opcion(4, `Costo de envío: ${costoEnvio() ? dinero(costoEnvio()) : 'sin costo fijo'}`),
        opcion(5, `Redes sociales (${config.redes.length})`),
        opcion(6, `Preguntas frecuentes (${config.faq.length})`),
        opcion(7, `Categorías (${categorias().length})`),
        opcion(8, `Dueñas (${config.duenas.length})`),
        opcion(9, `Pagos pendientes: ${config.recordatorioHoras ? `recordar a las ${config.recordatorioHoras} h` : 'sin recordatorio'}, ${config.vencimientoHoras ? `cancelar a las ${config.vencimientoHoras} h` : 'sin cancelar'}`)
      ].join('\n')}\n\n${textoPendientes()}`)
    }
    const guardado = () => menuAjustes('✅ Guardado.\n\n')

    const menuRedes = () => {
      const lista = config.redes.map((r, i) => opcion(i + 1, `${r.nombre}: ${r.url}`))
      preguntar('redes_menu', `📲 *Redes sociales*\n\n${[...lista, opcion(lista.length + 1, 'Agregar red'), opcion(0, 'Volver a ajustes')].join('\n')}`)
    }
    const menuFaq = () => {
      const lista = config.faq.map((f, i) => opcion(i + 1, `${f.respuesta ? '' : '⚠️ '}${f.pregunta}`))
      preguntar('faq_menu', `❓ *Preguntas frecuentes*\nElige una para editarla. ⚠️ significa sin respuesta.\n\n${[...lista, opcion(lista.length + 1, 'Agregar pregunta'), opcion(0, 'Volver a ajustes')].join('\n')}`)
    }
    const menuCategorias = () => {
      const lista = categorias()
      if (!lista.length) { menuAjustes('Aún no hay categorías. Se crean al agregar un producto.\n\n'); return }
      preguntar('cats_menu', `🗂️ *Categorías*\nElige una para cambiarle el nombre.\n\n${[...lista.map((c, i) => opcion(i + 1, c)), opcion(0, 'Volver a ajustes')].join('\n')}`, { lista })
    }
    const menuDuenas = () => {
      const lista = config.duenas.map((d, i) => opcion(i + 1, d.telefono || d.jid))
      preguntar('duenas_menu', `👑 *Dueñas*\nElige un número para quitarlo.\n\n${[...lista, opcion(lista.length + 1, 'Agregar número'), opcion(0, 'Volver a ajustes')].join('\n')}`)
    }

    const nuevoProducto = () => {
      const lista = categorias()
      preguntar('prod_cat', `🆕 *Nuevo producto*\n\n¿En qué categoría va?\n${lista.length ? `\n${lista.map((c, i) => opcion(i + 1, c)).join('\n')}\n\nResponde con el número o escribe una categoría nueva.` : 'Escribe el nombre, por ejemplo: Ropa.'}`, { lista })
    }
    const menuEdicion = (p, prefijo = '') => {
      preguntar('ed_menu', `${prefijo}${textoProducto(p)}\n\n¿Qué quieres cambiar?\n\n${[
        opcion(1, 'Nombre'), opcion(2, 'Precio'), opcion(3, 'Descripción'), opcion(4, 'Categoría'),
        opcion(5, p.encargable ? 'Quitar opción de encargo' : 'Permitir encargo'),
        opcion(6, 'Existencias'), opcion(7, 'Agregar talla o color'), opcion(8, 'Quitar talla o color'), opcion(9, 'Borrar producto')
      ].join('\n')}`, { id: p.id })
    }
    const formaDe = (p) => ({ talla: p.variantes.some((v) => v.talla), color: p.variantes.some((v) => v.color) })

    const PASOS_D = {
      aj_menu: (n) => {
        const ir_a = {
          1: () => preguntar('aj_nombre', 'Escribe el nombre de tu tienda.'),
          2: () => preguntar('aj_bienvenida', 'Escribe el saludo para tus clientas.\nEscribe *no* para usar el saludo normal.'),
          3: () => preguntar('aj_banco', '¿Cuál es el banco?'),
          4: () => preguntar('aj_envio', '¿Cuánto cobras de envío? Escribe solo el número, o *0* si no hay costo fijo.'),
          5: menuRedes, 6: menuFaq, 7: menuCategorias, 8: menuDuenas,
          9: () => preguntar('aj_recordatorio', '¿A las cuántas horas le recuerdo a la clienta que pague? Escribe *0* para no recordar.')
        }
        if (!ir_a[n]) return false
        ir_a[n]()
        return true
      },
      aj_nombre: (_n, crudo) => { config.tienda = crudo.slice(0, 60); guardado(); return true },
      aj_bienvenida: (_n, crudo, t) => { config.bienvenida = OMITIR.has(t) ? '' : crudo.slice(0, 500); guardado(); return true },
      aj_banco: (_n, crudo) => { preguntar('aj_titular', '¿A nombre de quién está la cuenta?', { banco: crudo.slice(0, 60) }); return true },
      aj_titular: (_n, crudo, _t, s) => { preguntar('aj_clabe', 'Escribe la CLABE (18 dígitos) o el número de tarjeta (16 dígitos).', { ...s.datos, titular: crudo.slice(0, 80) }); return true },
      aj_clabe: (_n, crudo, _t, s) => {
        const clabe = soloDigitos(crudo)
        if (clabe.length !== 16 && clabe.length !== 18) { invalido('Debe tener 16 o 18 dígitos. Escríbelo otra vez.'); return true }
        config.pago = { banco: s.datos.banco, titular: s.datos.titular, clabe }
        guardado()
        return true
      },
      aj_recordatorio: (n) => {
        if (n === null || n > 720) { invalido('Escribe un número de horas, de 0 a 720.'); return true }
        preguntar('aj_vencimiento', '¿A las cuántas horas se cancela un pedido sin pagar y se libera el stock? Escribe *0* para nunca cancelar.', { recordatorio: n })
        return true
      },
      aj_vencimiento: (n, _c, _t, s) => {
        if (n === null || n > 720) { invalido('Escribe un número de horas, de 0 a 720.'); return true }
        if (n && s.datos.recordatorio && n <= s.datos.recordatorio) { invalido(`Debe ser mayor que el recordatorio (${s.datos.recordatorio} h), o *0*.`); return true }
        config.recordatorioHoras = s.datos.recordatorio
        config.vencimientoHoras = n
        guardado()
        return true
      },
      aj_envio: (n) => {
        if (n === null) return false
        config.costoEnvio = n
        guardado()
        return true
      },
      redes_menu: (n) => {
        if (n === 0) { menuAjustes(); return true }
        if (n === config.redes.length + 1) { preguntar('red_nombre', '¿Qué red es? Por ejemplo: Instagram.'); return true }
        const red = config.redes[n - 1]
        if (!red) return false
        preguntar('red_accion', `*${red.nombre}*\n${red.url}\n\n${opcion(1, 'Cambiar link')}\n${opcion(2, 'Borrar')}\n${opcion(0, 'Volver')}`, { i: n - 1 })
        return true
      },
      red_accion: (n, _c, _t, s) => {
        if (n === 0) { menuRedes(); return true }
        if (n === 1) { preguntar('red_url', 'Pega el link nuevo.', { i: s.datos.i, nombre: config.redes[s.datos.i].nombre }); return true }
        if (n === 2) { config.redes.splice(s.datos.i, 1); menuRedes(); return true }
        return false
      },
      red_nombre: (_n, crudo) => { preguntar('red_url', 'Pega el link completo, empezando con https://', { nombre: crudo.slice(0, 30) }); return true },
      red_url: (_n, crudo, _t, s) => {
        if (!/^https?:\/\/\S+$/i.test(crudo) || crudo.length > 200) { invalido('Ese link no es válido. Debe empezar con https://'); return true }
        const red = { nombre: s.datos.nombre, url: crudo }
        if (s.datos.i !== undefined) config.redes[s.datos.i] = red
        else config.redes.push(red)
        menuRedes()
        return true
      },
      faq_menu: (n) => {
        if (n === 0) { menuAjustes(); return true }
        if (n === config.faq.length + 1) { preguntar('faq_pregunta', 'Escribe la pregunta o tema. Por ejemplo: Facturas.'); return true }
        const f = config.faq[n - 1]
        if (!f) return false
        preguntar('faq_accion', `*${f.pregunta}*\n${f.respuesta || '⚠️ Sin respuesta'}\n\nPalabras clave: ${(f.claves || []).join(', ') || 'ninguna'}\n\n${[opcion(1, 'Cambiar respuesta'), opcion(2, 'Cambiar pregunta'), opcion(3, 'Cambiar palabras clave'), opcion(4, 'Borrar'), opcion(0, 'Volver')].join('\n')}`, { i: n - 1 })
        return true
      },
      faq_accion: (n, _c, _t, s) => {
        if (n === 0) { menuFaq(); return true }
        if (n === 1) { preguntar('faq_cambiar_respuesta', 'Escribe la respuesta nueva.', s.datos); return true }
        if (n === 2) { preguntar('faq_cambiar_pregunta', 'Escribe la pregunta nueva.', s.datos); return true }
        if (n === 3) { preguntar('faq_cambiar_claves', 'Escribe las palabras clave separadas por coma. Por ejemplo: factura, facturas.\nEscribe *no* para quitarlas.', s.datos); return true }
        if (n === 4) { config.faq.splice(s.datos.i, 1); menuFaq(); return true }
        return false
      },
      faq_cambiar_respuesta: (_n, crudo, _t, s) => { config.faq[s.datos.i].respuesta = crudo.slice(0, 1000); menuFaq(); return true },
      faq_cambiar_pregunta: (_n, crudo, _t, s) => { config.faq[s.datos.i].pregunta = crudo.slice(0, 80); menuFaq(); return true },
      faq_cambiar_claves: (_n, crudo, t, s) => { config.faq[s.datos.i].claves = OMITIR.has(t) ? [] : crudo.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20); menuFaq(); return true },
      faq_pregunta: (_n, crudo) => { preguntar('faq_respuesta', '¿Qué debe contestar el bot?', { pregunta: crudo.slice(0, 80) }); return true },
      faq_respuesta: (_n, crudo, _t, s) => { preguntar('faq_claves', 'Escribe las palabras clave separadas por coma, para que el bot la reconozca. Por ejemplo: factura, facturas.\nEscribe *no* si solo debe aparecer en la lista.', { ...s.datos, respuesta: crudo.slice(0, 1000) }); return true },
      faq_claves: (_n, crudo, t, s) => {
        config.faq.push({ pregunta: s.datos.pregunta, respuesta: s.datos.respuesta, claves: OMITIR.has(t) ? [] : crudo.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20) })
        menuFaq()
        return true
      },
      cats_menu: (n, _c, _t, s) => {
        if (n === 0) { menuAjustes(); return true }
        const anterior = s.datos.lista[n - 1]
        if (!anterior) return false
        preguntar('cat_nombre', `¿Cómo se llamará *${anterior}*?`, { anterior })
        return true
      },
      cat_nombre: (_n, crudo, _t, s) => {
        catalogo.filter((p) => p.categoria === s.datos.anterior).forEach((p) => { p.categoria = crudo.slice(0, 40) })
        menuCategorias()
        return true
      },
      duenas_menu: (n) => {
        if (n === 0) { menuAjustes(); return true }
        if (n === config.duenas.length + 1) { preguntar('duena_num', 'Escribe el número con código de país. Por ejemplo: 5215512345678.'); return true }
        const d = config.duenas[n - 1]
        if (!d) return false
        if (config.duenas.length === 1) { menuDuenas(); responder('No puedes quitar a la única dueña.'); return true }
        preguntar('duena_quitar', `¿Quitar a ${d.telefono || d.jid}?\n\n${opcion(1, 'Sí, quitar')}\n${opcion(2, 'No')}`, { i: n - 1 })
        return true
      },
      duena_num: (_n, crudo) => {
        const tel = soloDigitos(crudo)
        if (tel.length < 10 || tel.length > 13) { invalido('Ese número no parece correcto. Escríbelo con código de país.'); return true }
        if (!config.duenas.some((d) => mismoTel(d.telefono, tel))) config.duenas.push({ jid: null, telefono: tel })
        menuDuenas()
        return true
      },
      duena_quitar: (n, _c, _t, s) => {
        if (n === 1) { config.duenas.splice(s.datos.i, 1); menuDuenas(); return true }
        if (n === 2) { menuDuenas(); return true }
        return false
      },
      prod_cat: (n, crudo, _t, s) => {
        const categoria = n !== null ? s.datos.lista[n - 1] : crudo.slice(0, 40)
        if (!categoria) return false
        preguntar('prod_nombre', '¿Cómo se llama el producto?', { categoria })
        return true
      },
      prod_nombre: (_n, crudo, _t, s) => { preguntar('prod_precio', '¿Cuánto cuesta? Escribe solo el número.', { ...s.datos, nombre: crudo.slice(0, 80) }); return true },
      prod_precio: (n, _c, _t, s) => {
        if (!n) { invalido('Escribe el precio solo con números. Por ejemplo: 289'); return true }
        preguntar('prod_desc', 'Escribe una descripción corta, o *no* para omitirla.', { ...s.datos, precio: n })
        return true
      },
      prod_desc: (_n, crudo, t, s) => {
        preguntar('prod_tipo', `¿Tiene tallas o colores?\n\n${[opcion(1, 'No, es una sola opción'), opcion(2, 'Solo tallas'), opcion(3, 'Solo colores'), opcion(4, 'Tallas y colores')].join('\n')}`, { ...s.datos, descripcion: OMITIR.has(t) ? '' : crudo.slice(0, 200) })
        return true
      },
      prod_tipo: (n, _c, _t, s) => {
        if (n === 1) { preguntar('prod_stock', '¿Cuántas piezas tienes?', s.datos); return true }
        const forma = { 2: { talla: true }, 3: { color: true }, 4: { talla: true, color: true } }[n]
        if (!forma) return false
        preguntar('prod_vars', `Escribe una opción por renglón con su cantidad:\n\n${ejemploOpciones(forma)}`, { ...s.datos, forma })
        return true
      },
      prod_stock: (n, _c, _t, s) => {
        if (n === null) { invalido('Escribe solo el número de piezas.'); return true }
        preguntar('prod_enc', `¿Se puede encargar cuando se agote?\n\n${opcion(1, 'Sí')}\n${opcion(2, 'No')}`, { ...s.datos, variantes: [{ stock: n }] })
        return true
      },
      prod_vars: (_n, crudo, _t, s) => {
        const r = leerOpciones(crudo, s.datos.forma)
        if (r.error) { invalido(`No entendí este renglón: "${r.error}"\n\nUsa este formato:\n${ejemploOpciones(s.datos.forma)}`); return true }
        preguntar('prod_enc', `¿Se puede encargar cuando se agote?\n\n${opcion(1, 'Sí')}\n${opcion(2, 'No')}`, { ...s.datos, variantes: r.variantes })
        return true
      },
      prod_enc: (n, _c, _t, s) => {
        if (n !== 1 && n !== 2) return false
        const { categoria, nombre, precio, descripcion, variantes } = s.datos
        const p = { id: generarCodigo(categoria), categoria, nombre, descripcion, precio, encargable: n === 1, variantes }
        catalogo.push(p)
        terminar()
        responder(`✅ Producto agregado.\n\n${textoProducto(p)}\n\nPara otro, escribe *agregar*. Para cambiarlo: *editar ${p.id}*`)
        return true
      },
      ed_menu: (n, _c, _t, s) => {
        const p = buscarProducto(s.datos.id)
        const d = s.datos
        if (!p) { terminar(); responder('Ese producto ya no existe.'); return true }
        const opcionesActuales = p.variantes.map((v, i) => `${i + 1}. ${detalle(v) || 'Pieza'}: ${v.stock}`).join('\n')
        const acciones_ed = {
          1: () => preguntar('ed_nombre', 'Escribe el nombre nuevo.', d),
          2: () => preguntar('ed_precio', 'Escribe el precio nuevo. Los pedidos ya hechos conservan su precio.', d),
          3: () => preguntar('ed_desc', 'Escribe la descripción nueva, o *no* para quitarla.', d),
          4: () => preguntar('ed_cat', 'Escribe la categoría.', d),
          5: () => { p.encargable = !p.encargable; menuEdicion(p, '✅ Guardado.\n\n') },
          6: () => preguntar('ed_stock', `${opcionesActuales}\n\nEscribe número de opción y cantidad. Por ejemplo: 2 10`, d),
          7: () => {
            const forma = formaDe(p)
            if (!forma.talla && !forma.color) { menuEdicion(p, 'Este producto no maneja tallas ni colores. Si los necesita, bórralo y créalo otra vez.\n\n'); return }
            preguntar('ed_agregar_op', `Escribe las opciones nuevas, una por renglón:\n\n${ejemploOpciones(forma)}`, d)
          },
          8: () => {
            if (p.variantes.length === 1) { menuEdicion(p, 'No puedes quitar su única opción.\n\n'); return }
            preguntar('ed_quitar_op', `${opcionesActuales}\n\nEscribe el número que quieres quitar.`, d)
          },
          9: () => preguntar('ed_borrar', `¿Borrar *${p.nombre}*? Los pedidos ya hechos no cambian.\n\n${opcion(1, 'Sí, borrar')}\n${opcion(2, 'No')}`, d)
        }
        if (!acciones_ed[n]) return false
        acciones_ed[n]()
        return true
      },
      ed_nombre: (_n, crudo, _t, s) => { const p = buscarProducto(s.datos.id); if (p) { p.nombre = crudo.slice(0, 80); menuEdicion(p, '✅ Guardado.\n\n') } return true },
      ed_precio: (n, _c, _t, s) => {
        if (!n) { invalido('Escribe el precio solo con números.'); return true }
        const p = buscarProducto(s.datos.id)
        if (p) { p.precio = n; menuEdicion(p, '✅ Guardado.\n\n') }
        return true
      },
      ed_desc: (_n, crudo, t, s) => { const p = buscarProducto(s.datos.id); if (p) { p.descripcion = OMITIR.has(t) ? '' : crudo.slice(0, 200); menuEdicion(p, '✅ Guardado.\n\n') } return true },
      ed_cat: (_n, crudo, _t, s) => { const p = buscarProducto(s.datos.id); if (p) { p.categoria = crudo.slice(0, 40); menuEdicion(p, '✅ Guardado.\n\n') } return true },
      ed_stock: (_n, crudo, _t, s) => {
        const p = buscarProducto(s.datos.id)
        const [op, cant] = crudo.split(/\s+/).map(Number)
        const v = p?.variantes[op - 1]
        if (!v || !Number.isInteger(cant) || cant < 0) { invalido('Usa número de opción y cantidad. Por ejemplo: 2 10'); return true }
        v.stock = cant
        menuEdicion(p, '✅ Guardado.\n\n')
        return true
      },
      ed_agregar_op: (_n, crudo, _t, s) => {
        const p = buscarProducto(s.datos.id)
        const forma = formaDe(p)
        const r = leerOpciones(crudo, forma)
        if (r.error) { invalido(`No entendí este renglón: "${r.error}"\n\nUsa este formato:\n${ejemploOpciones(forma)}`); return true }
        const repetida = r.variantes.find((n) => p.variantes.some((v) => (v.talla || '') === (n.talla || '') && norm(v.color || '') === norm(n.color || '')))
        if (repetida) { invalido(`Ya existe: ${detalle(repetida)}. Cambia su cantidad con la opción de existencias.`); return true }
        p.variantes.push(...r.variantes)
        menuEdicion(p, '✅ Guardado.\n\n')
        return true
      },
      ed_quitar_op: (n, _c, _t, s) => {
        const p = buscarProducto(s.datos.id)
        if (!p?.variantes[n - 1]) return false
        p.variantes.splice(n - 1, 1)
        menuEdicion(p, '✅ Guardado.\n\n')
        return true
      },
      ed_borrar: (n, _c, _t, s) => {
        const p = buscarProducto(s.datos.id)
        if (n === 2 && p) { menuEdicion(p); return true }
        if (n !== 1) return false
        if (p) catalogo.splice(catalogo.indexOf(p), 1)
        terminar()
        responder(`🗑️ Producto borrado.`)
        return true
      }
    }

    const continuar = (texto) => {
      const s = db.asistentes[remitente]
      const crudo = String(texto || '').trim()
      const t = norm(crudo)
      if (t === 'salir') { terminar(); responder('Listo. Escribe *ayuda* para ver los comandos.'); return }
      const n = /^\d+$/.test(t) ? Number(t) : null
      if (!PASOS_D[s.paso]) { terminar(); responder('Se reinició este paso. Escribe *ayuda*.'); return }
      if (!crudo || !PASOS_D[s.paso](n, crudo, t, s)) invalido('Esa opción no es válida. Responde con una de las que aparecen arriba.')
    }

    return { continuar, menuAjustes, menuDuenas, nuevoProducto, menuEdicion }
  }

  const enModoClienta = (jid) => !!db.modoClienta[jid]
  function salirModoClienta(jid) {
    delete db.modoClienta[jid]
    guardar()
    return [{ tipo: 'duena', a: jid, texto: `👑 *Modo dueña.* Ya puedes usar tus comandos.\n\n${textoPendientes()}\n\nEscribe *ayuda* para verlos.` }]
  }

  function esDuena(jid, telefono) {
    const d = config.duenas.find((x) => x.jid === jid || mismoTel(x.telefono, telefono))
    if (d && jid && d.jid !== jid) { d.jid = jid; guardar() }
    return !!d
  }

  const hayDuenas = () => config.duenas.length > 0
  const destinosDuena = () => config.duenas.map((d) => d.jid || d.telefono)

  function activarDuena(jid, telefono) {
    config.duenas.push({ jid, telefono: telefono ? soloDigitos(telefono) : '' })
    guardar()
    return [{ tipo: 'duena', a: jid, texto: `👑 ¡Listo! Este número ya es la dueña de la tienda.\n\n${textoPendientes()}\n\nEscribe *ajustes* para empezar o *ayuda* para ver todo lo que puedes hacer.` }]
  }

  function mensajeDuena(texto, remitente) {
    const acciones = []
    const responder = (t) => acciones.push({ tipo: 'duena', a: remitente, texto: t })
    const flujo = crearFlujo(remitente, responder)
    if (db.asistentes[remitente] && ahora() - (db.asistentes[remitente].en || 0) > 30 * 60000) delete db.asistentes[remitente]
    if (db.asistentes[remitente]) {
      flujo.continuar(texto)
      guardar()
      return acciones
    }
    const avisarCliente = (p, t) => {
      if (p.clienteId) acciones.push({ tipo: 'cliente', a: p.clienteId, texto: t })
    }
    const fin = () => { guardar(); return acciones }
    const partes = String(texto || '').trim().split(/\s+/)
    let cmd = norm(partes[0])
    let resto = partes.slice(1)
    if (resto[0]) resto[0] = resto[0].replace(/^#/, '')
    if (ALIAS_ESTADO[cmd] && /^\d+$/.test(resto[0] || '')) {
      resto = [resto[0], cmd]
      cmd = 'estado'
    }
    const conPedido = (fn) => {
      const p = buscarPedido(resto[0])
      if (!p) responder(`No encontré ese pedido. Escribe *pedidos* para ver la lista.`)
      else fn(p)
    }
    const confirmado = (p) => responder(`Pedido *#${p.id}* → ${ESTADOS[p.estado].icono} *${ESTADOS[p.estado].nombre}*${p.clienteId ? '. Ya le avisé a la clienta.' : '. Este pedido no tiene número para avisar.'}`)

    switch (cmd) {
      case 'ayuda': case 'comandos': case 'menu': case 'hola': case 'buenas': case 'inicio':
        responder(AYUDA)
        break
      case 'probar': case 'clienta': case 'cliente': {
        db.modoClienta[remitente] = true
        delete db.asistentes[remitente]
        if (db.clientes[remitente]) { db.clientes[remitente].paso = 'nuevo'; db.clientes[remitente].ficha = [] }
        responder('🛍️ *Modo clienta activado.* Ahora el bot te atiende como a una clienta, para que lo pruebes.\n\nTe siguen llegando los avisos de dueña. Para volver a tus comandos escribe *modo dueña*.')
        break
      }
      case 'ajustes': case 'configurar': case 'configuracion':
        flujo.menuAjustes()
        break
      case 'duenas': case 'duena': case 'duenos': case 'dueno':
        flujo.menuDuenas()
        break
      case 'agregar': case 'nuevo':
        flujo.nuevoProducto()
        break
      case 'editar': {
        const p = buscarProducto(resto[0] || '')
        if (!p) responder('No encontré ese código. Escribe *productos* para ver la lista.')
        else flujo.menuEdicion(p)
        break
      }
      case 'productos': case 'catalogo': {
        if (!catalogo.length) { responder('Aún no tienes productos. Escribe *agregar* para crear el primero.'); break }
        responder(`🛍️ *Tus productos*\n\n${categorias().map((cat) => `*${cat}*\n${catalogo.filter((p) => p.categoria === cat).map((p) => `${p.id} · ${p.nombre} · ${dinero(p.precio)} · ${stockTotal(p)} pzas`).join('\n')}`).join('\n\n')}\n\nPara cambiar uno: *editar* y su código.`)
        break
      }
      case 'pedidos': {
        const filtro = norm(resto.join(' '))
        const estado = ALIAS_ESTADO[filtro]
        if (filtro && !estado) { responder('No conozco ese estado. Escribe *ayuda* para ver los nombres.'); break }
        const lista = estado ? db.pedidos.filter((p) => p.estado === estado) : db.pedidos.filter((p) => !CERRADOS.includes(p.estado))
        if (!lista.length) { responder('No hay pedidos en esa lista.'); break }
        const grupos = Object.keys(ESTADOS).map((e) => {
          const items = lista.filter((p) => p.estado === e)
          if (!items.length) return ''
          return `${ESTADOS[e].icono} *${ESTADOS[e].nombre} (${items.length})*\n${items.slice(-30).map((p) => `#${p.id} · ${p.nombre} · ${p.telefono || 'Sin número'} · ${dinero(p.total)}`).join('\n')}${items.length > 30 ? `\n…y ${items.length - 30} más antiguos (escribe *exportar*)` : ''}`
        }).filter(Boolean)
        responder(`📋 *${estado ? 'Pedidos' : 'Pedidos activos'}*\n\n${grupos.join('\n\n')}\n\nEscribe *ver* y el número para abrir uno.`)
        break
      }
      case 'ver':
        conPedido((p) => {
          const siguientes = SIN_PAGO.includes(p.estado)
            ? [`*confirmar ${p.id}*`, `*cancelar ${p.id}*`]
            : CERRADOS.includes(p.estado) ? [] : ['encargado', 'listo', 'camino', 'entregado'].filter((e) => ALIAS_ESTADO[e] !== p.estado).map((e) => `*estado ${p.id} ${e}*`)
          responder(`${fichaDuena(p)}\n\nComprobantes: ${p.comprobantes}${siguientes.length ? `\n\n${siguientes.join('\n')}` : ''}`)
        })
        break
      case 'confirmar':
        conPedido((p) => {
          if (!SIN_PAGO.includes(p.estado)) { responder(`El pedido #${p.id} ya no está esperando pago.`); return }
          registrarEstado(p, 'pagado')
          avisarCliente(p, cierreCompra(p))
          confirmado(p)
        })
        break
      case 'rechazar':
        conPedido((p) => {
          if (p.estado !== 'comprobante_revision') { responder(`El pedido #${p.id} no tiene un comprobante en revisión.`); return }
          const motivo = resto.slice(1).join(' ')
          registrarEstado(p, 'pendiente_pago')
          avisarCliente(p, `⚠️ No pudimos confirmar el comprobante de tu pedido *#${p.id}*.${motivo ? `\nMotivo: ${motivo}` : ''}\n\nRevísalo y envíame uno nuevo por aquí.`)
          confirmado(p)
        })
        break
      case 'estado':
        conPedido((p) => {
          const nuevo = ALIAS_ESTADO[norm(resto.slice(1).join(' '))]
          if (!nuevo || nuevo === 'comprobante_revision' || nuevo === 'cancelado') { responder(`Usa: *estado ${p.id} listo*\nEstados: pendiente, proceso, encargado, listo, camino, entregado.`); return }
          if (CERRADOS.includes(p.estado)) { responder(`El pedido #${p.id} ya está cerrado (${ESTADOS[p.estado].nombre}).`); return }
          if (SIN_PAGO.includes(p.estado) && nuevo !== 'pagado' && nuevo !== 'pendiente_pago') { responder(`El pedido #${p.id} no está pagado. Primero usa *confirmar ${p.id}*.`); return }
          if (p.estado === nuevo) { responder(`El pedido #${p.id} ya está en ese estado.`); return }
          if (nuevo === 'pagado' && SIN_PAGO.includes(p.estado)) {
            registrarEstado(p, 'pagado')
            avisarCliente(p, cierreCompra(p))
          } else {
            registrarEstado(p, nuevo)
            avisarCliente(p, AVISOS_ESTADO[nuevo](p))
          }
          confirmado(p)
        })
        break
      case 'cancelar':
        conPedido((p) => {
          if (CERRADOS.includes(p.estado)) { responder(`El pedido #${p.id} ya está cerrado.`); return }
          const motivo = resto.slice(1).join(' ')
          devolverStock(p)
          registrarEstado(p, 'cancelado')
          avisarCliente(p, `❌ Tu pedido *#${p.id}* fue cancelado.${motivo ? `\nMotivo: ${motivo}` : ''}\n\nSi tienes dudas, escribe *menu* y luego *8*.`)
          confirmado(p)
        })
        break
      case 'casos': {
        const abiertos = db.casos.filter((c) => c.estado === 'abierto')
        if (!abiertos.length) { responder('No hay casos abiertos. 🎉'); break }
        responder(`📌 *Casos abiertos*\n\n${abiertos.map((c) => `*${c.id}* · ${c.tipo === 'queja' ? '⚠️ Queja' : '🙋 Atención'} · ${c.nombre} · ${c.telefono || 'Sin número'}\n${c.texto}`).join('\n\n')}\n\nAl terminar: *cerrar* y el número.`)
        break
      }
      case 'responder': case 'contestar': {
        const caso = buscarCaso(resto[0])
        const mensaje = resto.slice(1).join(' ').trim()
        if (!caso || !mensaje) { responder('Usa: *responder 3 tu mensaje*. Escribe *casos* para ver los números.'); break }
        acciones.push({ tipo: 'cliente', a: caso.clienteId, texto: mensaje.slice(0, 3000) })
        const cl = db.clientes[caso.clienteId]
        if (caso.tipo === 'atencion' && cl?.paso === 'humano') cl.humanoHasta = ahora() + (config.horasAtencion || 12) * 3600000
        responder(`✉️ Enviado a ${caso.nombre}.`)
        break
      }
      case 'mensaje':
        conPedido((p) => {
          const mensaje = resto.slice(1).join(' ').trim()
          if (!mensaje) { responder(`Usa: *mensaje ${p.id} tu mensaje*`); return }
          if (!p.clienteId) { responder('Este pedido no tiene número para escribirle.'); return }
          avisarCliente(p, mensaje.slice(0, 3000))
          responder(`✉️ Enviado a ${p.nombre}.`)
        })
        break
      case 'entrega':
        conPedido((p) => {
          const cuando = resto.slice(1).join(' ').trim()
          if (!cuando) { responder(`Usa: *entrega ${p.id} sábado 4 pm*`); return }
          if (CERRADOS.includes(p.estado)) { responder(`El pedido #${p.id} ya está cerrado.`); return }
          p.entrega = cuando.slice(0, 120)
          avisarCliente(p, `📅 Tu pedido *#${p.id}* se entregará: *${p.entrega}*\n📍 ${p.direccion}\n\nSi necesitas cambiarlo, escribe *8* para hablar con una persona.`)
          responder(`📅 Entrega del pedido #${p.id}: ${p.entrega}${p.clienteId ? '. Ya le avisé a la clienta.' : ''}`)
        })
        break
      case 'resumen': case 'reporte': {
        const hoy = new Date(ahora()).toLocaleDateString('en-CA', { timeZone: config.zonaHoraria || 'America/Mexico_City' })
        const diaDe = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: config.zonaHoraria || 'America/Mexico_City' })
        const pagadoEn = (p) => p.historial.find((h) => h.estado === 'pagado')?.fecha
        const vendidos = db.pedidos.filter((p) => p.estado !== 'cancelado' && pagadoEn(p))
        const ventas = (lista) => `${lista.length} pedido${lista.length === 1 ? '' : 's'} · ${dinero(lista.reduce((a, p) => a + p.total, 0))}`
        const semana = vendidos.filter((p) => ahora() - pagadoEn(p) < 7 * 86400000)
        const deHoy = vendidos.filter((p) => diaDe(pagadoEn(p)) === hoy)
        const sinPagar = db.pedidos.filter((p) => SIN_PAGO.includes(p.estado))
        const conteo = Object.keys(ESTADOS).filter((e) => !CERRADOS.includes(e)).map((e) => [e, db.pedidos.filter((p) => p.estado === e).length]).filter(([, n]) => n)
        const bajos = catalogo.flatMap((p) => p.variantes.filter((v) => v.stock <= 1).map((v) => `${p.id} ${p.nombre}${detalle(v) ? ` (${detalle(v)})` : ''}: ${v.stock}`))
        responder([
          '📊 *Resumen*', '',
          `💰 Pagado hoy: ${ventas(deHoy)}`,
          `💰 Pagado en 7 días: ${ventas(semana)}`,
          `🟡 Sin pagar: ${ventas(sinPagar)}`,
          '', '*Pedidos activos*',
          conteo.length ? conteo.map(([e, n]) => `${ESTADOS[e].icono} ${ESTADOS[e].nombre}: ${n}`).join('\n') : 'Ninguno',
          '', '*Stock bajo o agotado*',
          bajos.length ? bajos.slice(0, 25).join('\n') + (bajos.length > 25 ? `\n…y ${bajos.length - 25} más` : '') : 'Todo bien'
        ].join('\n'))
        break
      }
      case 'exportar': {
        if (!db.pedidos.length) { responder('Aún no hay pedidos para exportar.'); break }
        const celda = (v) => {
          let x = String(v ?? '')
          if (/^[=+\-@\t\r]/.test(x)) x = `'${x}`
          return /[",\n;]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x
        }
        const filas = [['Pedido', 'Fecha', 'Estado', 'Clienta', 'Teléfono', 'Dirección', 'Canal', 'Productos', 'Envío', 'Total', 'Entrega']]
        for (const p of db.pedidos) {
          filas.push([p.id, fecha(p.creado), ESTADOS[p.estado].nombre, p.nombre, p.telefono, p.direccion, p.canal,
            p.lineas.map((l) => `${l.cantidad} x ${nombreLinea(l)}${l.encargo ? ' (encargo)' : ''}`).join(' | '), p.envio || 0, p.total, p.entrega || ''])
        }
        acciones.push({ tipo: 'duena', a: remitente, texto: `📁 ${db.pedidos.length} pedido${db.pedidos.length === 1 ? '' : 's'}. Ábrelo con Excel o Google Sheets.`, archivo: { nombre: `pedidos-${new Date(ahora()).toLocaleDateString('en-CA', { timeZone: config.zonaHoraria || 'America/Mexico_City' })}.csv`, mime: 'text/csv', contenido: '\ufeff' + filas.map((f) => f.map(celda).join(',')).join('\r\n') } })
        break
      }
      case 'version':
        responder(`🤖 Versión instalada: ${version || 'desconocida'}`)
        break
      case 'quitarfoto': {
        const p = buscarProducto(resto[0] || '')
        if (!p) { responder('Usa: *quitarfoto R01*'); break }
        delete p.foto
        responder(`Listo, *${p.nombre}* ya no tiene foto.`)
        break
      }
      case 'foto':
        responder('Para poner foto: envía la *imagen* con el texto *foto R01* (el código del producto).')
        break
      case 'cerrar': {
        const caso = buscarCaso(resto[0])
        if (!caso || caso.estado !== 'abierto') { responder('No encontré ese caso abierto. Escribe *casos* para ver la lista.'); break }
        caso.estado = 'cerrado'
        const mensaje = resto.slice(1).join(' ')
        const c = db.clientes[caso.clienteId]
        if (caso.tipo === 'atencion' && c?.paso === 'humano' && c.casoAtencion === caso.id) c.paso = 'menu'
        const aviso = caso.tipo === 'queja'
          ? `✅ Tu reporte *${caso.id}* quedó resuelto.${mensaje ? `\n${mensaje}` : ''}`
          : `Gracias por escribirnos. 💖${mensaje ? `\n${mensaje}` : ''}\n\nCuando necesites algo más, escribe *menu*.`
        acciones.push({ tipo: 'cliente', a: caso.clienteId, texto: aviso })
        responder(`Caso *${caso.id}* cerrado. La clienta ya fue avisada.`)
        break
      }
      case 'stock': {
        const p = buscarProducto(resto[0] || '')
        if (!p) { responder('No encontré ese código. Ejemplo: *stock R01*'); break }
        if (resto.length >= 3) {
          const v = p.variantes[Number(resto[1]) - 1]
          const cantidad = Number(resto[2])
          if (!v || !Number.isInteger(cantidad) || cantidad < 0) { responder(`Usa: *stock ${p.id} 1 10* (opción y cantidad).`); break }
          v.stock = cantidad
        }
        responder(`📦 *${p.nombre}* (${p.id}) · ${dinero(p.precio)}\n\n${p.variantes.map((v, i) => `${i + 1}. ${detalle(v) || 'Pieza'}: ${v.stock}`).join('\n')}`)
        break
      }
      case 'precio': {
        const p = buscarProducto(resto[0] || '')
        const precio = Number(resto[1])
        if (!p || !Number.isFinite(precio) || precio <= 0) { responder('Usa: *precio R01 299*'); break }
        p.precio = precio
        responder(`Listo: *${p.nombre}* ahora cuesta ${dinero(precio)}. Los pedidos ya hechos conservan su precio.`)
        break
      }
      case 'registrar': {
        const campos = String(texto).trim().slice(partes[0].length).split('|').map((x) => x.trim())
        if (campos.length < 5) {
          responder('Para pedidos de Instagram u otra red, usa una sola línea:\n\n*registrar Nombre | teléfono | Instagram | dirección | R01 1 2; A01 1 1*\n\nCada producto va como: código, número de opción y cantidad. Ve las opciones con *stock R01*.')
          break
        }
        const [nombre, telefono, canal, direccion, productos] = campos
        const lineas = []
        const errores = []
        for (const item of productos.split(';').map((x) => x.trim()).filter(Boolean)) {
          const [codigo, op, cant] = item.split(/\s+/)
          const p = buscarProducto(codigo || '')
          const indice = Number(op) - 1
          const v = p?.variantes[indice]
          const cantidad = Number(cant)
          if (!v || !Number.isInteger(cantidad) || cantidad < 1) { errores.push(item); continue }
          const encargo = v.stock < cantidad
          if (encargo && !p.encargable) { errores.push(`${item} (quedan ${v.stock})`); continue }
          lineas.push({ productoId: p.id, variante: indice, nombre: p.nombre, talla: v.talla || '', color: v.color || '', cantidad, precio: p.precio, encargo })
        }
        if (errores.length || !lineas.length) { responder(`No registré el pedido. Revisa: ${errores.join(', ') || 'productos vacíos'}`); break }
        const tel = soloDigitos(telefono)
        const envio = costoEnvio()
        const p = {
          id: db.sigPedido++, clienteId: tel.length >= 10 ? `tel:${tel}` : null, nombre: nombre.slice(0, 60), telefono: tel,
          direccion: direccion.slice(0, 250), canal: canal.slice(0, 30) || 'Otra red', lineas, envio, total: total(lineas) + envio,
          estado: 'pendiente_pago', historial: [{ estado: 'pendiente_pago', fecha: ahora() }], comprobantes: 0, creado: ahora()
        }
        reservar(lineas)
        db.pedidos.push(p)
        avisarCliente(p, `🎉 Registramos tu pedido *#${p.id}* de *${config.tienda}*. Está *pendiente de pago*.\n\n${textoPago(p)}\n\nEnvíame aquí tu comprobante cuando transfieras.`)
        responder(`Registrado.\n\n${fichaDuena(p)}`)
        break
      }
      default:
        if (/^\d+$/.test(cmd)) responder('Ese número no corresponde a ningún menú abierto. Escribe *ajustes* y después el número de la opción.')
        else responder('No conozco ese comando. Escribe *ayuda* para ver la lista.')
    }
    return fin()
  }

  // Recordatorios de pago y cancelación de pedidos vencidos. Se llama cada pocos minutos.
  function revisarPendientes() {
    const acciones = []
    const hora = 3600000
    for (const p of db.pedidos) {
      if (p.estado !== 'pendiente_pago') continue
      const desde = [...p.historial].reverse().find((h) => h.estado === 'pendiente_pago')?.fecha || p.creado
      const horas = (ahora() - desde) / hora
      if (config.vencimientoHoras && horas >= config.vencimientoHoras) {
        devolverStock(p)
        registrarEstado(p, 'cancelado')
        if (p.clienteId) acciones.push({ tipo: 'cliente', a: p.clienteId, texto: `⌛ Tu pedido *#${p.id}* se canceló porque no recibimos el pago a tiempo.\n\nSi todavía lo quieres, escribe *menu* y haz tu pedido de nuevo. 💖` })
        acciones.push({ tipo: 'duena', texto: `⌛ Pedido *#${p.id}* de ${p.nombre} cancelado por falta de pago. Su stock regresó al catálogo.` })
      } else if (config.recordatorioHoras && horas >= config.recordatorioHoras && p.recordadoEn !== desde) {
        p.recordadoEn = desde
        if (p.clienteId) acciones.push({ tipo: 'cliente', a: p.clienteId, texto: `👋 Te recordamos que tu pedido *#${p.id}* está pendiente de pago.\n\n${textoPago(p)}\n\nEnvíame aquí tu comprobante cuando transfieras.${config.vencimientoHoras ? `\n_Si no recibimos el pago, el pedido se cancelará en unas ${Math.max(1, Math.round(config.vencimientoHoras - horas))} horas._` : ''}` })
      }
    }
    if (acciones.length) guardar()
    return acciones
  }

  // Valida el código antes de que se descargue la foto.
  function productoParaFoto(texto) {
    const m = norm(texto).match(/^foto\s+(\S+)$/)
    return m ? buscarProducto(m[1]) || null : undefined
  }

  function ponerFoto(id, archivo) {
    const p = buscarProducto(id)
    if (!p) return []
    p.foto = archivo
    guardar()
    return [{ tipo: 'duena', texto: `📷 Foto guardada para *${p.nombre}* (${p.id}). Las clientas la verán al abrir el producto.` }]
  }

  return { mensajeCliente, mensajeDuena, enModoClienta, salirModoClienta, revisarPendientes, productoParaFoto, ponerFoto, esDuena, hayDuenas, destinosDuena, activarDuena, db, catalogo, config }
}
