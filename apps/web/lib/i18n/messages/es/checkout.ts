import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Compra",
    shareTitle: "Aprueba tu compra · {brand}",
    description:
      "Inicia sesión en Menta para terminar este paso. Solo tú puedes aprobar un límite de gasto; tu asistente nunca ve tu tarjeta.",
  },
  titles: {
    payment: "Aprobar pago",
    store: "La tienda te necesita",
    working: "Compra en vivo",
    done: "Pedido realizado",
    stopped: "Compra detenida",
    expired: "Solicitud vencida",
    cancelled: "Compra cancelada",
    approved: "Aprobado",
    sent: "Enviado",
    missing: "Compra no encontrada",
  },
  returnTo: "Volver a {host}",
  returnToSentence: "Vuelve a {host}.",
  from: "Desde {host}",
  cancel: {
    confirm: "¿Cancelar la compra? No se ha cobrado nada.",
    keep: "Seguir",
    cancel: "Cancelar compra",
    ask: "Cancelar esta compra",
  },
  done: {
    approved: "Aprobado",
    sent: "Enviado",
    yourAssistant: "Tu asistente",
    placing: "La compra está haciendo tu pedido.",
    continuing: "La compra continúa con tu respuesta.",
    sayDone:
      "{step} De vuelta en {host}, di que ya terminaste para conocer el resultado.",
    placingResult:
      "La compra está haciendo tu pedido. {host} recibe el resultado cuando la tienda lo confirma.",
    continuingResult:
      "La compra continúa con tu respuesta. {host} recibe el resultado cuando la tienda confirma el pedido.",
    paidUpTo: "Pagado hasta",
    item: "Artículo",
    store: "Tienda",
  },
  watching: {
    title: "Compra en vivo",
    upTo: "Hasta {amount}",
    noLiveView:
      "La vista en vivo aparece cuando se abre el navegador de la compra.",
    watchOnly: "Puedes mirar, pero no hacer clic dentro.",
  },
  loading: "Cargando la compra",
  unavailable: {
    title: "Esta compra no se cargó",
    body: "Revisa tu conexión.",
    retry: "Reintentar",
  },
  missing: {
    title: "No encontramos esta compra",
    signedInAs: "Iniciaste sesión como {email}. ",
    body: "Puede que el enlace sea antiguo o que la compra sea de otra cuenta. {switch} o {home}.",
    switch: "Cambia de cuenta",
    home: "ve a tu panel",
  },
  ended: {
    placed: "Pedido realizado",
    finished: "Compra terminada",
    unconfirmed: "Aún sin confirmar",
    stopped: "Esta compra se detuvo",
    doneNote: "No tienes que hacer nada más.",
    unconfirmedNote:
      "Espera el correo de la tienda antes de volver a comprarlo.",
    stoppedNote: "No se cobró nada. Pídele a {host} que lo intente de nuevo.",
    yourAssistant: "tu asistente",
  },
  expired: {
    request: "Esta solicitud venció",
    approval: "Esta aprobación venció",
    body: "Pídele a tu asistente que lo intente de nuevo; empezará una nueva.",
  },
  cancelled: {
    title: "Compra cancelada",
    body: "No se cobró nada.",
  },
  payment: {
    needsYou: "{store} te necesita",
    title: "Aprueba el pago",
    over: "Supera tu límite de {limit} en {over}",
    within: "Dentro de tu límite de {limit}",
    limit: "Tu límite: {limit}",
    section: "Aprobación de pago segura",
  },
  store: {
    private: "Solo tú puedes escribir esto",
    question: "Una pregunta rápida de {store}",
    section: "Datos seguros para la tienda",
    secretNote: "Va directo a {store}. Tu asistente nunca lo ve ni lo guarda.",
    secretNoteNamed: "Va directo a {store}. {host} nunca lo ve ni lo guarda.",
  },
  limit: {
    cardNote: "Tu tarjeta se queda en Crossmint. Tu asistente nunca la ve.",
    cardNoteNamed: "Tu tarjeta se queda en Crossmint. {host} nunca la ve.",
    title: "Configura un límite de gasto",
    setUp: "Configurar límite de gasto",
    lede: "Define cuánto puede gastar tu asistente con tu tarjeta, en este pedido y los siguientes. Revócalo cuando quieras.",
    ledeNamed:
      "Define cuánto puede gastar {host} con tu tarjeta, en este pedido y los siguientes. Revócalo cuando quieras.",
    amount: "Importe",
    name: "Propósito",
    anyStore: "Cualquier tienda",
    worksFor: "Vale para",
    storeTitle: "Limitar a una tienda",
    website: "Sitio web",
    save: "Guardar",
    onlyAt: "Solo en {store}",
    expires: "Vence en",
    card: "Tarjeta",
    approved: "Límite de gasto aprobado",
    approvedLede: "{name}: {amount}, hasta el {date}.",
    paying: "Pagando {store} con él ahora.",
    invalidAmount: "Introduce un importe, como 50.",
    invalidName: "Di para qué es, como Supermercado.",
    missing: "Esta solicitud no está disponible",
    missingLede:
      "Caducó o se hizo para otra cuenta. Pide una nueva a tu asistente.",
    yourLimits: "Ver tus límites de gasto",
    cancel: "Cancelar",
    cancelled: "Ningún límite de gasto aprobado",
    cancelledLede: "No se aprobó ni se pagó nada. Puedes cerrar esta pestaña.",
  },
} satisfies typeof en;
