import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Ayuda",
    description:
      "Cómo añadir Menta a tu asistente, cómo funciona una compra y dónde están tus tarjetas, direcciones y pedidos.",
  },
  title: "Ayuda de Menta",
  lede: "Menta es un plugin para ChatGPT, Claude, Grok Bot y otros asistentes. Dile a tu asistente qué comprar y Menta completa la compra por ti en tiendas online de todo el mundo, con Crossmint Agent Checkouts.",
  install: {
    title: "Añade Menta a tu asistente",
    lede: "Elige tu asistente. Cuando te lo pida, inicia sesión en Menta y permite el acceso.",
    server: "URL del servidor",
    listed:
      "Cuando Menta aparezca en {directory}, añádelo desde allí. Mientras tanto, añádelo tú mismo:",
    chatgptDirectory: "el directorio de plugins de ChatGPT",
    claudeDirectory: "el directorio de conectores de Claude",
    grokBot:
      "Cuando Menta esté en el Marketplace de Grok Bot, abre el Marketplace, añade Menta e inicia sesión.",
    signIn: "inicia sesión en Menta y permite el acceso.",
    otherApp: "Otra app",
    example:
      "Compra un paquete de 4 pilas AA en Amazon, por menos de 15 dólares, con entrega a domicilio.",
    apps: {
      chatgpt: [
        "Abre {plugins} y elige {add}. ¿No aparece? Activa primero el modo de desarrollador en los ajustes.",
        "Llámalo Menta, pega la URL y elige {oauth}.",
        "Elige {create} y luego {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Abre {connectors} y elige {add}.",
        "Llámalo Menta y pega la URL tal cual, sin barra al final.",
        "Mantén el inicio de sesión que detecta Claude, elige {confirm} y luego {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Busca dónde añade tu app servidores MCP o conectores (suelen llamarse conectores personalizados o integraciones).",
        "Añade un servidor HTTP remoto con la URL de arriba. El inicio de sesión es por OAuth, así que deja vacío cualquier campo de clave de API.",
        "Cuando te lo pida, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Cómo funciona una compra",
    steps: [
      {
        title: "Di qué comprar",
        text: "Dile a tu asistente qué quieres y dónde, por ejemplo: “{example}”",
      },
      {
        title: "Menta completa la compra",
        text: "Menta inicia la compra en la tienda y te muestra cómo avanza.",
      },
      {
        title: "Responde a la tienda",
        text: "Si la tienda necesita algo de ti, como una talla o una hora de entrega, tu asistente te lo pregunta y tú respondes.",
      },
      {
        title: "Aprueba un límite de gasto",
        text: "Cuando la tienda está lista para cobrar, Menta paga con un límite de gasto que hayas aprobado, si alguno lo cubre. Si ninguno lo cubre, lo apruebas tú mismo en el formulario seguro de Crossmint, en tu asistente o en una página de Menta. No se paga nada más allá de tus límites.",
      },
    ],
    never:
      "Tu asistente nunca puede aprobar ni aumentar un límite de gasto. Los números de tarjeta, los códigos de verificación y las contraseñas nunca pasan por el chat: cuando hace falta uno, lo escribes en el formulario seguro de Crossmint.",
  },
  saved: {
    title: "Tarjetas y direcciones",
    cards:
      "Crossmint guarda tus tarjetas en tu cuenta de Menta. Añádelas y gestiónalas en {wallet}. Tu asistente solo ve la marca de la tarjeta y los últimos 4 dígitos.",
    addresses:
      "Tus direcciones de entrega se guardan en {addresses}. Tu asistente las consulta solo cuando hace falta: la etiqueta y la ciudad de tu dirección predeterminada para decir adónde van las entregas, y el resto cuando lo pides tú o una tienda.",
    signIn: "Ambas páginas te piden iniciar sesión en Menta.",
  },
  orders: {
    title: "Consultar o cancelar un pedido",
    text: "Pregúntale a tu asistente cómo va una compra o pídele que la cancele. Todo lo que Menta ha comprado por ti, desde cualquier asistente, está en {transactions}.",
    store:
      "Los pedidos están a tu nombre en la tienda, así que, una vez hecho el pedido, los cambios y las devoluciones se gestionan con la tienda.",
  },
  limits: {
    title: "Lo que Menta no puede hacer",
    items: [
      "Algunas tiendas bloquean los navegadores automatizados, así que Menta no puede comprar en ellas.",
      "Menta compra productos físicos y hace pedidos en tiendas online, con entrega a domicilio o para recoger.",
      "Menta solo paga con una tarjeta que hayas guardado, y solo dentro de un límite de gasto que hayas aprobado.",
    ],
  },
  contact: {
    title: "Privacidad, condiciones y soporte",
    text: "Menta es obra de Crossmint. Si necesitas ayuda, escribe a {email} o menciona a {x} en X.",
  },
  legal: {
    terms: "Condiciones del servicio",
    privacy: "Política de privacidad",
    englishOnly: "Este documento solo está disponible en inglés.",
    agree: "Al continuar, aceptas las {terms} y la {privacy} de Menta.",
    agreeTerms: "condiciones del servicio",
    agreePrivacy: "política de privacidad",
  },
} satisfies typeof en;
