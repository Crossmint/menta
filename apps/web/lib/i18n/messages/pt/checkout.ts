import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Compra",
    shareTitle: "Entre com segurança",
    description:
      "Digite aqui as senhas e os códigos da loja, não no chat. Seu assistente nunca os vê.",
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
  cancel: {
    ask: "Cancelar esta compra",
  },
  done: {
    approved: "Aprovado",
    sent: "Enviado",
    goBack: "Volte para {host} e diga que terminou.",
    goBackAssistant: "Volte para seu assistente e diga que terminou.",
    yourAssistant: "Seu assistente",
    placing: "A compra está fazendo o seu pedido.",
    sayDone:
      "{step} Volte para {host} e diga que terminou para saber o resultado.",
    placingResult:
      "A compra está fazendo o seu pedido. {host} recebe o resultado quando a loja confirmar.",
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
  dashboard: "Ir para o seu painel",
  missing: {
    title: "Não encontramos esta compra",
    signedInAs: "Você entrou como {email}. ",
    body: "O link pode ser antigo, ou a compra pode ser de outra conta. {switch}.",
    switch: "Troque de conta",
  },
  ended: {
    seeOrder: "Ver seu pedido",
    placed: "Pedido feito",
    doneNote: "Você não precisa fazer mais nada.",
  },
  expired: {
    request: "Esta solicitação expirou",
    approval: "Esta aprovação expirou",
  },
  cancelled: {
    title: "Compra cancelada",
    body: "Nada foi cobrado.",
    closeTab: "Agora você pode fechar esta aba e voltar para {host}.",
    closeTabAny:
      "Agora você pode fechar esta aba e voltar para seu assistente.",
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
    needsInfo:
      "{menta} precisa de algumas informações para concluir a tarefa em {store}.",
    question: "Uma pergunta rápida de {store}",
    section: "Dados seguros para a loja",
    secretNote: "Vai direto para {store}. Seu assistente nunca vê nem guarda.",
    secretNoteNamed:
      "Vai direto para {store}. {host} nunca vê nem guarda isso.",
  },
  limit: {
    allow: "Permita que {host} use seu cartão do seu jeito.",
    allowAny: "Permita que seu assistente use seu cartão do seu jeito.",
    cardNote: "Seu cartão fica com a Crossmint. Seu assistente nunca o vê.",
    cardNoteNamed: "Seu cartão fica com a Crossmint. {host} nunca o vê.",
    title: "Configure um limite de gastos",
    setUp: "Configurar limite de gastos",
    lede: "Defina quanto seu assistente pode gastar no seu cartão, neste pedido e nos próximos. Revogue quando quiser.",
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
    cancel: "Cancelar",
    cancelled: "Nenhum limite de gastos aprovado",
    cancelledLede: "Nada foi aprovado nem pago. Você pode fechar esta aba.",
  },
} satisfies typeof en;
