import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Acquisto",
    shareTitle: "Accedi in sicurezza",
    description:
      "Scrivi qui le password e i codici del negozio, non in chat. Il tuo assistente non li vede mai.",
  },
  titles: {
    payment: "Approva il pagamento",
    store: "Il negozio ha bisogno di te",
    working: "Acquisto in diretta",
    done: "Ordine effettuato",
    stopped: "Acquisto interrotto",
    expired: "Richiesta scaduta",
    cancelled: "Acquisto annullato",
    approved: "Approvato",
    sent: "Inviato",
    missing: "Acquisto non trovato",
  },
  returnTo: "Torna a {host}",
  returnToSentence: "Torna a {host}.",
  cancel: {
    ask: "Annulla questo acquisto",
  },
  done: {
    approved: "Approvato",
    sent: "Inviato",
    goBack: "Torna su {host} e di' che hai fatto.",
    goBackAssistant: "Torna dal tuo assistente e di' che hai fatto.",
    yourAssistant: "Il tuo assistente",
    placing: "L'acquisto sta inviando il tuo ordine.",
    sayDone: "{step} Torna su {host} e di' che hai finito per sapere l'esito.",
    placingResult:
      "L'acquisto sta inviando il tuo ordine. {host} riceve l'esito quando il negozio lo conferma.",
    paidUpTo: "Pagato fino a",
    item: "Articolo",
    store: "Negozio",
  },
  watching: {
    title: "Acquisto in diretta",
    upTo: "Fino a {amount}",
    noLiveView:
      "La vista in diretta compare quando si apre il browser dell'acquisto.",
    watchOnly: "Puoi guardare, ma non puoi cliccare al suo interno.",
  },
  loading: "Caricamento dell'acquisto",
  unavailable: {
    title: "Questo acquisto non si è caricato",
    body: "Controlla la connessione.",
    retry: "Riprova",
  },
  dashboard: "Vai alla tua dashboard",
  missing: {
    title: "Impossibile trovare questo acquisto",
    signedInAs: "Hai effettuato l'accesso come {email}. ",
    body: "Il link potrebbe essere vecchio, oppure l'acquisto appartiene a un altro account. {switch}.",
    switch: "Cambia account",
  },
  ended: {
    seeOrder: "Vedi il tuo ordine",
    placed: "Ordine effettuato",
    doneNote: "Non devi fare nient'altro.",
  },
  expired: {
    request: "Questa richiesta è scaduta",
    approval: "Questa approvazione è scaduta",
  },
  cancelled: {
    title: "Acquisto annullato",
    body: "Non è stato addebitato nulla.",
    closeTab: "Ora puoi chiudere questa scheda e tornare su {host}.",
    closeTabAny: "Ora puoi chiudere questa scheda e tornare al tuo assistente.",
  },
  payment: {
    needsYou: "{store} ha bisogno di te",
    title: "Approva il pagamento",
    over: "Supera il tuo limite di {limit} di {over}",
    within: "Entro il tuo limite di {limit}",
    limit: "Il tuo limite: {limit}",
    section: "Approvazione sicura del pagamento",
  },
  store: {
    needsInfo:
      "{menta} ha bisogno di alcune informazioni per completare l'operazione su {store}.",
    question: "Una domanda veloce da {store}",
    section: "Dati sicuri per il negozio",
    secretNote:
      "Va direttamente a {store}. Il tuo assistente non lo vede né lo conserva.",
    secretNoteNamed:
      "Va direttamente a {store}. {host} non lo vede mai e non lo conserva.",
  },
  limit: {
    allow: "Consenti a {host} di usare la tua carta alle tue condizioni.",
    allowAny:
      "Consenti al tuo assistente di usare la tua carta alle tue condizioni.",
    cardNote:
      "La tua carta resta su Crossmint. Il tuo assistente non la vede mai.",
    cardNoteNamed: "La tua carta resta su Crossmint. {host} non la vede mai.",
    title: "Imposta un limite di spesa",
    setUp: "Imposta limite di spesa",
    lede: "Imposta quanto può spendere il tuo assistente con la tua carta, per questo ordine e i prossimi. Puoi revocarlo in qualsiasi momento.",
    amount: "Importo",
    name: "Scopo",
    anyStore: "Qualsiasi negozio",
    worksFor: "Valido per",
    storeTitle: "Limita a un negozio",
    website: "Sito web",
    save: "Salva",
    onlyAt: "Solo da {store}",
    expires: "Scade tra",
    card: "Carta",
    approved: "Limite di spesa autorizzato",
    approvedLede: "{name}: {amount}, fino al {date}.",
    paying: "Pagamento di {store} in corso con questo limite.",
    invalidAmount: "Inserisci un importo, come 50.",
    invalidName: "Indica lo scopo, come Spesa.",
    missing: "Questa richiesta non è disponibile",
    missingLede:
      "È scaduta o era per un altro account. Chiedine una nuova al tuo assistente.",
    cancel: "Annulla",
    cancelled: "Nessun limite di spesa autorizzato",
    cancelledLede:
      "Non è stato autorizzato né pagato nulla. Puoi chiudere questa scheda.",
  },
} satisfies typeof en;
