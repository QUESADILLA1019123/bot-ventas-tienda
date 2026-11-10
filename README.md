# Bot de ventas para WhatsApp

Asistente de ventas para tiendas en línea: catálogo por categorías, precios y stock, ficha de pedido, comprobantes de pago, seguimiento por estados, preguntas frecuentes, quejas y atención personal. Todo se configura desde WhatsApp.

## Instalar en Cafirexos

En el servidor, sección **Variables**:

| Campo | Valor |
|---|---|
| Repositorio Git | la URL `https://github.com/...git` de este repositorio |
| Rama Git | vacío |
| Archivo de inicio | `src/index.js` |
| Actualización automática | **True** |
| Subida manual de archivos | False |
| Comando de inicio | vacío |

Después:

1. **Reinstala** el servidor para que descargue el código. Hazlo antes de vincular: reinstalar puede borrar los archivos del servidor.
2. Enciéndelo. En la consola escribe el número del chip del bot (México: `521` + 10 dígitos).
3. En el celular del bot: WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, y escribe el código de 8 caracteres.
4. Cuando salga `Bot conectado`, aparece la **CLAVE DE DUEÑA**. Envíasela al bot desde tu WhatsApp personal.

Listo. Desde tu WhatsApp escribe `ajustes` para configurar la tienda, `agregar` para crear productos y `ayuda` para ver todos los comandos.

## Actualizaciones

Con la actualización automática activada, cada vez que el servidor se reinicia descarga la última versión de este repositorio. Tus datos no se pierden: la sesión, los productos, los pedidos y los ajustes viven en carpetas que Git no toca.

Para que se actualice solo cada día, en Cafirexos crea una **tarea programada** (Schedules) que reinicie el servidor de madrugada. Para ver la versión instalada, escríbele `version` al bot.

Si una actualización cambia las dependencias de `package.json`, reinstala los paquetes desde el panel.

## Carpetas privadas

No las borres ni las compartas. Están en `.gitignore` y nunca se suben a GitHub.

- `sesion/`: la vinculación con WhatsApp. Quien la tenga controla el número del bot.
- `datos/`: ajustes, productos, fotos, pedidos y clientas, con respaldo automático `.bak`.
- `comprobantes/`: los comprobantes de pago recibidos.

## Desarrollo

Requiere Node.js 20 o más nuevo.

```
npm install
npm test
npm start
```

La lógica de la tienda está en `src/logica.js` y no depende de WhatsApp. La conexión con WhatsApp (Baileys) está en `src/index.js`. Las pruebas están en `pruebas/`.

Baileys es una librería no oficial: usa un número dedicado para el bot y no envíes mensajes masivos a personas que no te escribieron.
