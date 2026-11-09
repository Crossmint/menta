import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Kassen",
    shareTitle: "Logg inn trygt",
    description:
      "Skriv inn butikkens passord og koder her, ikke i chatten. Assistenten din ser dem aldri.",
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
  cancel: {
    ask: "Avbryt dette kjøpet",
  },
  done: {
    approved: "Godkjent",
    sent: "Sendt",
    goBack: "Gå tilbake til {host} og si at du er ferdig.",
    goBackAssistant: "Gå tilbake til assistenten din og si at du er ferdig.",
    yourAssistant: "Assistenten din",
    placing: "Bestillingen din blir lagt inn.",
    sayDone:
      "{step} Gå tilbake til {host} og si at du er ferdig, så får du resultatet.",
    placingResult:
      "Bestillingen din blir lagt inn. {host} får resultatet når butikken bekrefter den.",
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
  dashboard: "Gå til oversikten din",
  missing: {
    title: "Finner ikke dette kjøpet",
    signedInAs: "Du er logget inn som {email}. ",
    body: "Lenken kan være gammel, eller kjøpet kan høre til en annen konto. {switch}.",
    switch: "Bytt konto",
  },
  ended: {
    seeOrder: "Se bestillingen din",
    placed: "Bestilt",
    doneNote: "Du trenger ikke gjøre noe mer.",
  },
  expired: {
    request: "Denne forespørselen er utløpt",
    approval: "Denne godkjenningen er utløpt",
  },
  cancelled: {
    title: "Kjøpet avbrutt",
    body: "Ingenting ble belastet.",
    closeTab: "Du kan nå lukke fanen og gå tilbake til {host}.",
    closeTabAny: "Du kan nå lukke fanen og gå tilbake til assistenten din.",
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
    needsInfo:
      "{menta} trenger litt informasjon for å fullføre oppgaven på {store}.",
    question: "Et raskt spørsmål fra {store}",
    section: "Sikker inntasting for butikken",
    secretNote:
      "Går rett til {store}. Assistenten din ser det aldri og lagrer det ikke.",
    secretNoteNamed:
      "Går rett til {store}. {host} ser det aldri og lagrer det ikke.",
  },
  limit: {
    allow: "La {host} bruke kortet ditt på dine vilkår.",
    allowAny: "La assistenten din bruke kortet ditt på dine vilkår.",
    cardNote: "Kortet ditt blir hos Crossmint. Assistenten din ser det aldri.",
    cardNoteNamed: "Kortet ditt blir hos Crossmint. {host} ser det aldri.",
    title: "Opprett en utgiftsgrense",
    setUp: "Opprett utgiftsgrense",
    lede: "Angi hvor mye assistenten din kan bruke på kortet ditt, for denne bestillingen og de neste. Du kan tilbakekalle den når som helst.",
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
    cancel: "Avbryt",
    cancelled: "Ingen utgiftsgrense godkjent",
    cancelledLede:
      "Ingenting ble godkjent eller betalt. Du kan lukke denne fanen.",
  },
} satisfies typeof en;
