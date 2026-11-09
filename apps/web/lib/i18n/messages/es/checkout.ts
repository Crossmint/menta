import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Compra",
    shareTitle: "Inicia sesión de forma segura",
    description:
      "Escribe aquí las contraseñas y los códigos de la tienda, no en el chat. Tu asistente nunca los ve.",
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
  cancel: {
    ask: "Cancelar esta compra",
  },
  done: {
    approved: "Aprobado",
    sent: "Enviado",
    goBack: "Vuelve a {host} y di que ya está.",
    goBackAssistant: "Vuelve a tu asistente y di que ya está.",
    yourAssistant: "Tu asistente",
    placing: "La compra está haciendo tu pedido.",
    sayDone:
      "{step} De vuelta en {host}, di que ya terminaste para conocer el resultado.",
    placingResult:
      "La compra está haciendo tu pedido. {host} recibe el resultado cuando la tienda lo confirma.",
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
  dashboard: "Ir a tu panel",
  missing: {
    title: "No encontramos esta compra",
    signedInAs: "Iniciaste sesión como {email}. ",
    body: "Puede que el enlace sea antiguo o que la compra sea de otra cuenta. {switch}.",
    switch: "Cambia de cuenta",
  },
  ended: {
    seeOrder: "Ver tu pedido",
    placed: "Pedido realizado",
    doneNote: "No tienes que hacer nada más.",
  },
  expired: {
    request: "Esta solicitud venció",
    approval: "Esta aprobación venció",
  },
  cancelled: {
    title: "Compra cancelada",
    body: "No se cobró nada.",
    closeTab: "Ya puedes cerrar esta pestaña y volver a {host}.",
    closeTabAny: "Ya puedes cerrar esta pestaña y volver a tu asistente.",
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
    needsInfo:
      "{menta} necesita algunos datos para completar la tarea en {store}.",
    question: "Una pregunta rápida de {store}",
    section: "Datos seguros para la tienda",
    secretNote: "Va directo a {store}. Tu asistente nunca lo ve ni lo guarda.",
    secretNoteNamed: "Va directo a {store}. {host} nunca lo ve ni lo guarda.",
  },
  limit: {
    allow: "Permite que {host} use tu tarjeta con tus condiciones.",
    allowAny: "Permite que tu asistente use tu tarjeta con tus condiciones.",
    cardNote: "Tu tarjeta se queda en Crossmint. Tu asistente nunca la ve.",
    cardNoteNamed: "Tu tarjeta se queda en Crossmint. {host} nunca la ve.",
    title: "Configura un límite de gasto",
    setUp: "Configurar límite de gasto",
    lede: "Define cuánto puede gastar tu asistente con tu tarjeta, en este pedido y los siguientes. Revócalo cuando quieras.",
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
    cancel: "Cancelar",
    cancelled: "Ningún límite de gasto aprobado",
    cancelledLede: "No se aprobó ni se pagó nada. Puedes cerrar esta pestaña.",
  },
} satisfies typeof en;
