import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Kassen",
    shareTitle: "Godkjenn kjøpet ditt · {brand}",
    description:
      "Logg inn på Menta for å fullføre dette steget. Bare du kan godkjenne en utgiftsgrense; assistenten din ser aldri kortet ditt.",
  },
  titles: {
    payment: "Godkjenn betaling",
    store: "Butikken trenger deg",
    working: "Kjøpet pågår",
    done: "Bestilt",
    stopped: "Kjøpet stoppet",
    expired: "Forespørselen utløp",
    cancelled: "Kjøpet avbrutt",
    approved: "Godkjent",
    sent: "Sendt",
    missing: "Fant ikke kjøpet",
  },
  returnTo: "Tilbake til {host}",
  returnToSentence: "Gå tilbake til {host}.",
  from: "Fra {host}",
  cancel: {
    confirm: "Avbryte kjøpet? Ingenting er belastet.",
    keep: "Behold",
    cancel: "Avbryt kjøpet",
    ask: "Avbryt dette kjøpet",
  },
  done: {
    approved: "Godkjent",
    sent: "Sendt",
    yourAssistant: "Assistenten din",
    placing: "Bestillingen din blir lagt inn.",
    continuing: "Kjøpet fortsetter med svaret ditt.",
    sayDone:
      "{step} Gå tilbake til {host} og si at du er ferdig, så får du resultatet.",
    placingResult:
      "Bestillingen din blir lagt inn. {host} får resultatet når butikken bekrefter den.",
    continuingResult:
      "Kjøpet fortsetter med svaret ditt. {host} får resultatet når butikken bekrefter bestillingen.",
    paidUpTo: "Betalt opptil",
    item: "Vare",
    store: "Butikk",
  },
  watching: {
    title: "Kjøpet pågår",
    upTo: "Opptil {amount}",
    noLiveView: "Direktevisningen vises når nettleseren for kjøpet åpnes.",
    watchOnly: "Du kan se på, men ikke klikke i den.",
  },
  loading: "Laster inn kjøpet",
  unavailable: {
    title: "Kunne ikke laste inn kjøpet",
    body: "Sjekk tilkoblingen din.",
    retry: "Prøv igjen",
  },
  missing: {
    title: "Finner ikke dette kjøpet",
    signedInAs: "Du er logget inn som {email}. ",
    body: "Lenken kan være gammel, eller kjøpet kan høre til en annen konto. {switch} eller {home}.",
    switch: "Bytt konto",
    home: "gå til oversikten din",
  },
  ended: {
    placed: "Bestilt",
    finished: "Kjøpet er fullført",
    unconfirmed: "Ikke bekreftet ennå",
    stopped: "Kjøpet stoppet",
    doneNote: "Du trenger ikke gjøre noe mer.",
    unconfirmedNote: "Vent på e-post fra butikken før du kjøper det på nytt.",
    stoppedNote: "Ingenting ble belastet. Be {host} prøve igjen.",
    yourAssistant: "assistenten din",
  },
  expired: {
    request: "Denne forespørselen er utløpt",
    approval: "Denne godkjenningen er utløpt",
    body: "Be assistenten din prøve igjen, så starter den en ny.",
  },
  cancelled: {
    title: "Kjøpet avbrutt",
    body: "Ingenting ble belastet.",
  },
  payment: {
    needsYou: "{store} trenger deg",
    title: "Godkjenn betalingen",
    over: "{over} over grensen din på {limit}",
    within: "Innenfor grensen din på {limit}",
    limit: "Grensen din: {limit}",
    section: "Sikker godkjenning av betaling",
  },
  store: {
    private: "Bare du kan skrive inn dette",
    question: "Et raskt spørsmål fra {store}",
    section: "Sikker inntasting for butikken",
    secretNote:
      "Går rett til {store}. Assistenten din ser det aldri og lagrer det ikke.",
    secretNoteNamed:
      "Går rett til {store}. {host} ser det aldri og lagrer det ikke.",
  },
  limit: {
    cardNote: "Kortet ditt blir hos Crossmint. Assistenten din ser det aldri.",
    cardNoteNamed: "Kortet ditt blir hos Crossmint. {host} ser det aldri.",
    title: "Opprett en utgiftsgrense",
    setUp: "Opprett utgiftsgrense",
    lede: "Angi hvor mye assistenten din kan bruke på kortet ditt, for denne bestillingen og de neste. Du kan tilbakekalle den når som helst.",
    ledeNamed:
      "Angi hvor mye {host} kan bruke på kortet ditt, for denne bestillingen og de neste. Du kan tilbakekalle den når som helst.",
    amount: "Beløp",
    name: "Formål",
    anyStore: "Hvilken som helst butikk",
    worksFor: "Gjelder for",
    storeTitle: "Begrens til én butikk",
    website: "Nettsted",
    save: "Lagre",
    onlyAt: "Bare hos {store}",
    expires: "Utløper om",
    card: "Kort",
    approved: "Utgiftsgrensen er godkjent",
    approvedLede: "{name}: {amount}, til {date}.",
    paying: "Betaler {store} med den nå.",
    invalidAmount: "Skriv inn et beløp, f.eks. 50.",
    invalidName: "Skriv hva den er til, f.eks. Dagligvarer.",
    missing: "Denne forespørselen er ikke tilgjengelig",
    missingLede:
      "Den har utløpt, eller den ble laget for en annen konto. Be assistenten din om en ny.",
    yourLimits: "Se utgiftsgrensene dine",
    cancel: "Avbryt",
    cancelled: "Ingen utgiftsgrense godkjent",
    cancelledLede:
      "Ingenting ble godkjent eller betalt. Du kan lukke denne fanen.",
  },
} satisfies typeof en;
