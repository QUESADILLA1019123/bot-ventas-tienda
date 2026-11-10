import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from 'baileys'
import pino from 'pino'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { crearTienda } from './logica.js'

// ===== Rutas: todo relativo a la carpeta del proyecto, sin importar desde dónde se arranque =====
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ruta = (...partes) => path.join(RAIZ, ...partes)
const DIR_DATOS = ruta('datos')
const DIR_FOTOS = ruta('datos', 'fotos')
const DIR_COMPROBANTES = ruta('comprobantes')
const DIR_SESION = ruta('sesion')
const ARCHIVOS = {
  pedidos: path.join(DIR_DATOS, 'pedidos.json'),
  catalogo: path.join(DIR_DATOS, 'catalogo.json'),
  ajustes: path.join(DIR_DATOS, 'ajustes.json')
}
const MAX_ARCHIVO = 15 * 1024 * 1024
const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const VENTANA_MENSAJES_S = 2 * 60 * 60 // contesta mensajes recibidos mientras estuvo apagado, hasta 2 horas

for (const dir of [DIR_DATOS, DIR_FOTOS, DIR_COMPROBANTES]) fs.mkdirSync(dir, { recursive: true })

const log = (...x) => console.log(new Date().toLocaleTimeString('es-MX', { hour12: false }), ...x)

// ===== Archivos: lectura tolerante a daños y escritura atómica con respaldo =====
function leerJson(archivo, porDefecto) {
  for (const candidato of [archivo, `${archivo}.bak`]) {
    if (!fs.existsSync(candidato)) continue
    try {
      return JSON.parse(fs.readFileSync(candidato, 'utf8'))
    } catch {
      const danado = `${candidato}.danado-${Date.now()}`
      fs.renameSync(candidato, danado)
      log(`⚠️ ${path.basename(candidato)} estaba dañado. Lo guardé como ${path.basename(danado)} y usaré el respaldo.`)
    }
  }
  return porDefecto
}

function escribirJson(archivo, datos) {
  const temporal = `${archivo}.tmp`
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2))
  if (fs.existsSync(archivo)) fs.copyFileSync(archivo, `${archivo}.bak`)
  fs.renameSync(temporal, archivo)
}

function leerVersion() {
  const paquete = leerJson(ruta('package.json'), {})
  let commit = ''
  try {
    const head = fs.readFileSync(ruta('.git', 'HEAD'), 'utf8').trim()
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5)
      const suelto = ruta('.git', ref)
      if (fs.existsSync(suelto)) commit = fs.readFileSync(suelto, 'utf8').trim()
      else {
        const empacados = fs.readFileSync(ruta('.git', 'packed-refs'), 'utf8')
        commit = empacados.split('\n').find((l) => l.endsWith(` ${ref}`))?.split(' ')[0] || ''
      }
    } else commit = head
  } catch {
    // Sin carpeta .git (subida manual).
  }
  return `${paquete.version || '?'}${commit ? ` (${commit.slice(0, 7)})` : ''}`
}

// Lo que se edita desde WhatsApp vive en datos/, así que git pull nunca lo pisa.
const config = leerJson(ARCHIVOS.ajustes, null) || leerJson(ruta('config.json'), {})
const catalogo = leerJson(ARCHIVOS.catalogo, null) || leerJson(ruta('catalogo.json'), [])

let guardadoPendiente = null
function guardarAhora() {
  clearTimeout(guardadoPendiente)
  guardadoPendiente = null
  try {
    escribirJson(ARCHIVOS.pedidos, tienda.db)
    escribirJson(ARCHIVOS.catalogo, tienda.catalogo)
    escribirJson(ARCHIVOS.ajustes, tienda.config)
  } catch (error) {
    log('❌ No se pudieron guardar los datos:', error.message)
  }
}

const tienda = crearTienda({
  config,
  catalogo,
  datos: leerJson(ARCHIVOS.pedidos, {}),
  version: leerVersion(),
  // Agrupa varias escrituras seguidas en una sola.
  guardar: () => { guardadoPendiente ||= setTimeout(guardarAhora, 800) }
})
const claveDuena = crypto.randomBytes(4).toString('hex').toUpperCase()

const logger = pino({ level: 'silent' })
const recientes = new Map()
const jidsResueltos = new Map()
const vistos = new Set()
const colas = new Map()
const enviados = new Map()
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const digitos = (jid = '') => jid.split(/[:@]/)[0].replace(/\D/g, '')
const esPrivado = (jid = '') => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')
let sockActual = null

function abrir(msg) {
  let m = msg.message
  for (let i = 0; i < 5 && (m?.ephemeralMessage || m?.viewOnceMessage || m?.viewOnceMessageV2 || m?.documentWithCaptionMessage); i++) {
    m = (m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.documentWithCaptionMessage).message
  }
  return m || {}
}

function leerMensaje(msg) {
  const m = abrir(msg)
  const archivo = m.imageMessage || m.documentMessage || m.audioMessage || m.videoMessage || m.stickerMessage
  return {
    texto: m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || m.videoMessage?.caption
      || m.buttonsResponseMessage?.selectedDisplayText || m.listResponseMessage?.title || '',
    media: archivo ? { mime: String(archivo.mimetype || '').split(';')[0], tamano: Number(archivo.fileLength) || 0 } : null
  }
}

async function telefonoDe(sock, msg) {
  for (const jid of [msg.key.remoteJid, msg.key.remoteJidAlt, msg.key.senderPn]) {
    if (jid?.endsWith('@s.whatsapp.net')) return digitos(jid)
  }
  try {
    const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(msg.key.remoteJid)
    return pn ? digitos(pn) : null
  } catch {
    return null
  }
}

function hayFlood(jid) {
  const ahora = Date.now()
  const lista = (recientes.get(jid) || []).filter((t) => ahora - t < 10_000)
  lista.push(ahora)
  recientes.set(jid, lista)
  return lista.length > 8
}

// Un mensaje a la vez por chat, para que las respuestas no se crucen.
function enCola(jid, tarea) {
  const anterior = colas.get(jid) || Promise.resolve()
  const siguiente = anterior.then(tarea).catch((error) => log('Error al atender un mensaje:', error.message))
  colas.set(jid, siguiente)
  siguiente.finally(() => { if (colas.get(jid) === siguiente) colas.delete(jid) })
}

async function resolverJid(sock, destino) {
  if (destino.includes('@')) return destino
  const numero = destino.replace(/\D/g, '')
  if (jidsResueltos.has(numero)) return jidsResueltos.get(numero)
  let jid = `${numero}@s.whatsapp.net`
  try {
    const [resultado] = await sock.onWhatsApp(numero)
    if (resultado?.exists && resultado.jid) jid = resultado.jid
  } catch {
    // Si la consulta falla, se usa el número tal cual.
  }
  jidsResueltos.set(numero, jid)
  return jid
}

async function enviar(sock, jid, contenido) {
  const enviado = await sock.sendMessage(jid, contenido)
  // Se guarda un tiempo por si WhatsApp pide reenviarlo (evita el "Esperando el mensaje").
  if (enviado?.key?.id && enviado.message) {
    enviados.set(enviado.key.id, enviado.message)
    if (enviados.size > 500) enviados.delete(enviados.keys().next().value)
  }
}

async function bajarArchivo(sock, msg, media, carpeta, nombreBase) {
  const extension = EXTENSIONES[media.mime]
  if (!extension || media.tamano > MAX_ARCHIVO) return null
  const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage })
  if (!buffer?.length || buffer.length > MAX_ARCHIVO) return null
  const nombre = `${nombreBase}.${extension}`
  fs.writeFileSync(path.join(carpeta, nombre), buffer)
  return { buffer, nombre, mime: media.mime }
}

const fotoSegura = (nombre) => {
  const archivo = path.join(DIR_FOTOS, path.basename(String(nombre || '')))
  return archivo.startsWith(DIR_FOTOS + path.sep) && fs.existsSync(archivo) ? archivo : null
}

async function enviarADuena(sock, accion, archivo) {
  const destinos = accion.a ? [accion.a] : tienda.destinosDuena()
  for (const destino of destinos) {
    const jid = await resolverJid(sock, destino)
    if (accion.archivo) {
      await enviar(sock, jid, { document: Buffer.from(accion.archivo.contenido, 'utf8'), mimetype: accion.archivo.mime, fileName: accion.archivo.nombre, caption: accion.texto })
    } else if (archivo?.mime === 'application/pdf') {
      await enviar(sock, jid, { document: archivo.buffer, mimetype: archivo.mime, fileName: archivo.nombre, caption: accion.texto })
    } else if (archivo) {
      await enviar(sock, jid, { image: archivo.buffer, caption: accion.texto })
    } else {
      await enviar(sock, jid, { text: accion.texto })
    }
  }
}

async function ejecutar(sock, acciones, msg, media) {
  for (const accion of acciones) {
    try {
      if (accion.tipo === 'cliente') {
        const jid = await resolverJid(sock, accion.a.startsWith('tel:') ? accion.a.slice(4) : accion.a)
        await sock.sendPresenceUpdate('composing', jid).catch(() => {})
        await esperar(500 + Math.random() * 700)
        const foto = accion.imagen && fotoSegura(accion.imagen)
        await enviar(sock, jid, foto ? { image: fs.readFileSync(foto), caption: accion.texto } : { text: accion.texto })
        await sock.sendPresenceUpdate('paused', jid).catch(() => {})
        continue
      }
      let archivo = null
      let aviso = accion
      if (accion.adjuntarComprobante && msg) {
        try {
          archivo = await bajarArchivo(sock, msg, media, DIR_COMPROBANTES, `pedido-${Number(accion.adjuntarComprobante)}-${Date.now()}`)
        } catch (error) {
          log('No se pudo descargar el comprobante:', error.message)
        }
        if (!archivo) aviso = { ...accion, texto: `${accion.texto}\n\n⚠️ No pude adjuntar el archivo. Revísalo en el chat de la clienta.` }
      }
      await enviarADuena(sock, aviso, archivo)
    } catch (error) {
      log('No se pudo enviar un mensaje:', error.message)
    }
  }
}

async function atenderDuena(sock, msg, jid, texto, media) {
  if (media && media.mime.startsWith('image/')) {
    const producto = tienda.productoParaFoto(texto)
    if (producto === null) return ejecutar(sock, [{ tipo: 'duena', a: jid, texto: 'No encontré ese código. Escribe *productos* para ver la lista.' }])
    if (producto) {
      const id = producto.id.replace(/[^A-Za-z0-9_-]/g, '_')
      const archivo = await bajarArchivo(sock, msg, media, DIR_FOTOS, id).catch(() => null)
      if (!archivo) return ejecutar(sock, [{ tipo: 'duena', a: jid, texto: 'No pude guardar esa foto. Usa JPG o PNG de menos de 15 MB.' }])
      return ejecutar(sock, tienda.ponerFoto(producto.id, archivo.nombre))
    }
  }
  if (texto) await ejecutar(sock, tienda.mensajeDuena(texto, jid), msg, null)
}

async function atender(sock, msg) {
  const jid = msg.key.remoteJid
  if (msg.key.fromMe || !esPrivado(jid)) return
  if (Number(msg.messageTimestamp) < Date.now() / 1000 - VENTANA_MENSAJES_S) return

  const { texto, media } = leerMensaje(msg)
  if (!texto && !media) {
    if (!msg.message || msg.messageStubType) log('📩 Llegó un mensaje que todavía no puedo leer (cifrado). WhatsApp lo reenviará en unos segundos; si no, que lo manden otra vez.')
    return
  }

  const telefono = await telefonoDe(sock, msg)
  if (tienda.esDuena(jid, telefono)) return atenderDuena(sock, msg, jid, texto, media)
  if (hayFlood(jid)) return

  // Hasta activar a la dueña, el bot solo escucha la clave que aparece en la consola.
  if (!tienda.hayDuenas()) {
    const clave = texto.trim().split(/\s+/).pop().toUpperCase()
    if (clave.length === claveDuena.length && crypto.timingSafeEqual(Buffer.from(clave), Buffer.from(claveDuena))) {
      log('👑 Dueña activada')
      await ejecutar(sock, tienda.activarDuena(jid, telefono), msg, null)
    } else {
      log(`📩 Mensaje recibido, pero no es la clave de dueña (${texto.trim().slice(0, 20) || 'archivo'}). La clave es: ${claveDuena}`)
    }
    return
  }

  await sock.readMessages([msg.key]).catch(() => {})
  const acciones = tienda.mensajeCliente({ id: jid, nombre: msg.pushName || '', telefono, texto, media })
  await ejecutar(sock, acciones, msg, media)
}

// ===== Vinculación =====
const numeroValido = (n) => n.length >= 10 && n.length <= 15
let numeroBot = String(process.env.NUMERO_BOT || config.numeroBot || '').replace(/\D/g, '')
let promesaNumero = null

// Una sola pregunta para todo el proceso, aunque la conexión se reinicie mientras esperas.
function obtenerNumero() {
  if (numeroValido(numeroBot)) return Promise.resolve(numeroBot)
  promesaNumero ||= (async () => {
    const rl = readline.createInterface({ input: process.stdin, terminal: false })
    try {
      while (!numeroValido(numeroBot)) {
        console.log('\n👉 Escribe el número del bot con código de país, sin + ni espacios (México: 521 + 10 dígitos), y envíalo:')
        const linea = await new Promise((resolve) => rl.once('line', resolve))
        numeroBot = String(linea).replace(/\D/g, '')
        if (!numeroValido(numeroBot)) log('Ese número no parece correcto. Intenta otra vez.')
      }
      log(`Número recibido: ${numeroBot}. Pidiendo código...`)
      return numeroBot
    } finally {
      rl.close()
      promesaNumero = null
    }
  })()
  return promesaNumero
}

let intentos = 0
async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState(DIR_SESION)
  const sock = makeWASocket({
    auth: state,
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async (key) => enviados.get(key.id)
  })
  sockActual = sock
  let codigoPedido = false

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !codigoPedido && !sock.authState.creds.registered) {
      codigoPedido = true
      try {
        const numero = await obtenerNumero()
        // Si mientras escribías se reinició la conexión, el código lo pide la conexión nueva.
        if (sockActual !== sock || sock.cerrado) return
        const codigo = await sock.requestPairingCode(numero)
        log(`\n\n   CÓDIGO PARA VINCULAR: ${codigo}\n\n   En el celular del bot: WhatsApp > Dispositivos vinculados > Vincular con número de teléfono\n   Tienes unos 2 minutos. Si se vence, aquí aparece uno nuevo.\n`)
      } catch (error) {
        log('No se pudo pedir el código:', error.message)
      }
    }
    if (connection === 'open') {
      intentos = 0
      log(`✅ Bot conectado · versión ${leerVersion()}`)
      if (!tienda.hayDuenas()) log(`\n\n   CLAVE DE DUEÑA: ${claveDuena}\n   Envíasela al bot desde tu WhatsApp personal para activar tu número.\n`)
    }
    if (connection === 'close') {
      sock.cerrado = true
      if (sockActual !== sock) return
      const codigo = lastDisconnect?.error?.output?.statusCode
      if (codigo === DisconnectReason.loggedOut) {
        log(`⚠️ WhatsApp cerró la sesión del bot (motivo: ${lastDisconnect?.error?.message || codigo}). Hay que vincularlo de nuevo.`)
        fs.rmSync(DIR_SESION, { recursive: true, force: true })
        numeroBot = String(process.env.NUMERO_BOT || config.numeroBot || '').replace(/\D/g, '')
        intentos = 0
      }
      const vinculando = !sock.authState.creds.registered
      if (!vinculando) intentos++
      const espera = codigo === DisconnectReason.restartRequired || vinculando ? 1500 : Math.min(60_000, 2000 * 2 ** Math.min(intentos, 5))
      if (vinculando && codigo !== DisconnectReason.restartRequired) {
        const motivo = `${codigo ?? 'sin código'}${lastDisconnect?.error?.message ? ` · ${lastDisconnect.error.message}` : ''}`
        log(numeroValido(numeroBot) ? `Se cerró la conexión antes de vincular (motivo: ${motivo}). Te doy un código nuevo...` : 'Sigo esperando el número del bot.')
      }
      if (!vinculando || codigo === DisconnectReason.restartRequired) log(`Conexión perdida (${codigo ?? 'sin código'}). Reconectando en ${Math.round(espera / 1000)} s...`)
      setTimeout(() => iniciarBot().catch((error) => log('Error al reconectar:', error.message)), espera)
    }
  })

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      const id = msg.key?.id
      if (!id || vistos.has(id)) continue
      // Un mensaje que llegó cifrado vuelve con el mismo id cuando ya se puede leer: no se marca como visto.
      if (msg.message && !msg.messageStubType) vistos.add(id)
      if (vistos.size > 3000) vistos.delete(vistos.values().next().value)
      enCola(msg.key.remoteJid, () => atender(sock, msg))
    }
  })
}

// ===== Tareas periódicas =====
setInterval(() => {
  const limite = Date.now() - 60_000
  for (const [jid, tiempos] of recientes) if (!tiempos.some((t) => t > limite)) recientes.delete(jid)
}, 10 * 60_000).unref()

setInterval(() => {
  if (!sockActual?.user || !tienda.hayDuenas()) return
  const acciones = tienda.revisarPendientes()
  if (acciones.length) ejecutar(sockActual, acciones).catch((error) => log('Error en recordatorios:', error.message))
}, 5 * 60_000).unref()

// ===== Cierre ordenado y errores inesperados =====
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    log('Apagando: guardando datos...')
    guardarAhora()
    process.exit(0)
  })
}
process.on('exit', () => { if (guardadoPendiente) guardarAhora() })
process.on('unhandledRejection', (error) => log('Error no controlado:', error?.message || error))
process.on('uncaughtException', (error) => log('Error inesperado:', error?.message || error))

log(`Iniciando bot de ventas · versión ${leerVersion()}`)
iniciarBot().catch((error) => {
  log('No se pudo iniciar el bot:', error)
  process.exit(1)
})
