import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Acquisto",
    shareTitle: "Approva il tuo acquisto · {brand}",
    description:
      "Accedi a Menta per completare questo passaggio. Solo tu puoi autorizzare un limite di spesa; il tuo assistente non vede mai la tua carta.",
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
  from: "Da {host}",
  cancel: {
    confirm: "Annullare l'acquisto? Non è stato addebitato nulla.",
    keep: "Mantieni",
    cancel: "Annulla acquisto",
    ask: "Annulla questo acquisto",
  },
  done: {
    approved: "Approvato",
    sent: "Inviato",
    yourAssistant: "Il tuo assistente",
    placing: "L'acquisto sta inviando il tuo ordine.",
    continuing: "L'acquisto prosegue con la tua risposta.",
    sayDone: "{step} Torna su {host} e di' che hai finito per sapere l'esito.",
    placingResult:
      "L'acquisto sta inviando il tuo ordine. {host} riceve l'esito quando il negozio lo conferma.",
    continuingResult:
      "L'acquisto prosegue con la tua risposta. {host} riceve l'esito quando il negozio conferma l'ordine.",
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
  missing: {
    title: "Impossibile trovare questo acquisto",
    signedInAs: "Hai effettuato l'accesso come {email}. ",
    body: "Il link potrebbe essere vecchio, oppure l'acquisto appartiene a un altro account. {switch} o {home}.",
    switch: "Cambia account",
    home: "vai alla tua dashboard",
  },
  ended: {
    placed: "Ordine effettuato",
    finished: "Acquisto completato",
    unconfirmed: "Non ancora confermato",
    stopped: "Questo acquisto si è interrotto",
    doneNote: "Non devi fare nient'altro.",
    unconfirmedNote: "Aspetta l'email del negozio prima di comprarlo di nuovo.",
    stoppedNote: "Non è stato addebitato nulla. Chiedi a {host} di riprovare.",
    yourAssistant: "il tuo assistente",
  },
  expired: {
    request: "Questa richiesta è scaduta",
    approval: "Questa approvazione è scaduta",
    body: "Chiedi al tuo assistente di riprovare: ne avvierà una nuova.",
  },
  cancelled: {
    title: "Acquisto annullato",
    body: "Non è stato addebitato nulla.",
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
    private: "Solo tu puoi scriverlo",
    question: "Una domanda veloce da {store}",
    section: "Dati sicuri per il negozio",
    secretNote:
      "Va direttamente a {store}. Il tuo assistente non lo vede né lo conserva.",
    secretNoteNamed:
      "Va direttamente a {store}. {host} non lo vede mai e non lo conserva.",
  },
  limit: {
    cardNote:
      "La tua carta resta su Crossmint. Il tuo assistente non la vede mai.",
    cardNoteNamed: "La tua carta resta su Crossmint. {host} non la vede mai.",
    title: "Imposta un limite di spesa",
    setUp: "Imposta limite di spesa",
    lede: "Imposta quanto può spendere il tuo assistente con la tua carta, per questo ordine e i prossimi. Puoi revocarlo in qualsiasi momento.",
    ledeNamed:
      "Imposta quanto può spendere {host} con la tua carta, per questo ordine e i prossimi. Puoi revocarlo in qualsiasi momento.",
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
    yourLimits: "Vedi i tuoi limiti di spesa",
    cancel: "Annulla",
    cancelled: "Nessun limite di spesa autorizzato",
    cancelledLede:
      "Non è stato autorizzato né pagato nulla. Puoi chiudere questa scheda.",
  },
} satisfies typeof en;
