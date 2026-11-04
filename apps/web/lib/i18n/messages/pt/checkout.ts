import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Compra",
    shareTitle: "Aprove sua compra · {brand}",
    description:
      "Entre no Menta para concluir esta etapa. Só você pode aprovar um limite de gastos; seu assistente nunca vê seu cartão.",
  },
  titles: {
    payment: "Aprovar pagamento",
    store: "A loja precisa de você",
    working: "Compra ao vivo",
    done: "Pedido feito",
    stopped: "Compra interrompida",
    expired: "Solicitação expirada",
    cancelled: "Compra cancelada",
    approved: "Aprovado",
    sent: "Enviado",
    missing: "Compra não encontrada",
  },
  returnTo: "Voltar para {host}",
  returnToSentence: "Volte para {host}.",
  from: "De {host}",
  cancel: {
    confirm: "Cancelar a compra? Nada foi cobrado.",
    keep: "Manter",
    cancel: "Cancelar compra",
    ask: "Cancelar esta compra",
  },
  done: {
    approved: "Aprovado",
    sent: "Enviado",
    yourAssistant: "Seu assistente",
    placing: "A compra está fazendo o seu pedido.",
    continuing: "A compra continua com a sua resposta.",
    sayDone:
      "{step} Volte para {host} e diga que terminou para saber o resultado.",
    placingResult:
      "A compra está fazendo o seu pedido. {host} recebe o resultado quando a loja confirmar.",
    continuingResult:
      "A compra continua com a sua resposta. {host} recebe o resultado quando a loja confirmar o pedido.",
    paidUpTo: "Pago até",
    item: "Item",
    store: "Loja",
  },
  watching: {
    title: "Compra ao vivo",
    upTo: "Até {amount}",
    noLiveView:
      "A visualização ao vivo aparece quando o navegador da compra abrir.",
    watchOnly: "Você pode assistir, mas não pode clicar nela.",
  },
  loading: "Carregando a compra",
  unavailable: {
    title: "Esta compra não carregou",
    body: "Verifique sua conexão.",
    retry: "Tentar de novo",
  },
  missing: {
    title: "Não encontramos esta compra",
    signedInAs: "Você entrou como {email}. ",
    body: "O link pode ser antigo, ou a compra pode ser de outra conta. {switch} ou {home}.",
    switch: "Troque de conta",
    home: "vá para o seu painel",
  },
  ended: {
    placed: "Pedido feito",
    finished: "Compra concluída",
    unconfirmed: "Ainda não confirmado",
    stopped: "Esta compra foi interrompida",
    doneNote: "Você não precisa fazer mais nada.",
    unconfirmedNote: "Espere o e-mail da loja antes de comprar de novo.",
    stoppedNote: "Nada foi cobrado. Peça para {host} tentar de novo.",
    yourAssistant: "seu assistente",
  },
  expired: {
    request: "Esta solicitação expirou",
    approval: "Esta aprovação expirou",
    body: "Peça ao seu assistente para tentar de novo; ele inicia uma nova.",
  },
  cancelled: {
    title: "Compra cancelada",
    body: "Nada foi cobrado.",
  },
  payment: {
    needsYou: "{store} precisa de você",
    title: "Aprove o pagamento",
    over: "{over} acima do seu limite de {limit}",
    within: "Dentro do seu limite de {limit}",
    limit: "Seu limite: {limit}",
    section: "Aprovação de pagamento segura",
  },
  store: {
    private: "Só você pode digitar isto",
    question: "Uma pergunta rápida de {store}",
    section: "Dados seguros para a loja",
    secretNote: "Vai direto para {store}. Seu assistente nunca vê nem guarda.",
    secretNoteNamed:
      "Vai direto para {store}. {host} nunca vê nem guarda isso.",
  },
  limit: {
    cardNote: "Seu cartão fica com a Crossmint. Seu assistente nunca o vê.",
    cardNoteNamed: "Seu cartão fica com a Crossmint. {host} nunca o vê.",
    title: "Configure um limite de gastos",
    setUp: "Configurar limite de gastos",
    lede: "Defina quanto seu assistente pode gastar no seu cartão, neste pedido e nos próximos. Revogue quando quiser.",
    ledeNamed:
      "Defina quanto o {host} pode gastar no seu cartão, neste pedido e nos próximos. Revogue quando quiser.",
    amount: "Valor",
    name: "Finalidade",
    anyStore: "Qualquer loja",
    worksFor: "Vale para",
    storeTitle: "Limitar a uma loja",
    website: "Site",
    save: "Guardar",
    onlyAt: "Só em {store}",
    expires: "Vence em",
    card: "Cartão",
    approved: "Limite de gastos aprovado",
    approvedLede: "{name}: {amount}, até {date}.",
    paying: "Pagando {store} com ele agora.",
    invalidAmount: "Digite um valor, como 50.",
    invalidName: "Diga para que é, como Mercado.",
    missing: "Este pedido não está disponível",
    missingLede:
      "Expirou ou foi feito para outra conta. Peça um novo ao seu assistente.",
    yourLimits: "Ver os seus limites de gastos",
    cancel: "Cancelar",
    cancelled: "Nenhum limite de gastos aprovado",
    cancelledLede: "Nada foi aprovado nem pago. Você pode fechar esta aba.",
  },
} satisfies typeof en;
