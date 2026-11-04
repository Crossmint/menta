import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Afrekenen",
    shareTitle: "Keur je checkout goed · {brand}",
    description:
      "Log in bij Menta om deze stap af te ronden. Alleen jij kunt een bestedingslimiet goedkeuren; je assistent ziet je kaart nooit.",
  },
  titles: {
    payment: "Betaling goedkeuren",
    store: "De winkel heeft je nodig",
    working: "Live checkout",
    done: "Besteld",
    stopped: "Checkout gestopt",
    expired: "Verzoek verlopen",
    cancelled: "Checkout geannuleerd",
    approved: "Goedgekeurd",
    sent: "Verstuurd",
    missing: "Checkout niet gevonden",
  },
  returnTo: "Terug naar {host}",
  returnToSentence: "Ga terug naar {host}.",
  from: "Vanuit {host}",
  cancel: {
    confirm: "Checkout annuleren? Er is niets afgeschreven.",
    keep: "Behouden",
    cancel: "Checkout annuleren",
    ask: "Deze checkout annuleren",
  },
  done: {
    approved: "Goedgekeurd",
    sent: "Verstuurd",
    yourAssistant: "Je assistent",
    placing: "De checkout plaatst je bestelling.",
    continuing: "De checkout gaat verder met je antwoord.",
    sayDone:
      "{step} Ga terug naar {host} en zeg dat je klaar bent; dan hoor je het resultaat.",
    placingResult:
      "De checkout plaatst je bestelling. {host} krijgt het resultaat zodra de winkel die bevestigt.",
    continuingResult:
      "De checkout gaat verder met je antwoord. {host} krijgt het resultaat zodra de winkel de bestelling bevestigt.",
    paidUpTo: "Betaald tot",
    item: "Artikel",
    store: "Winkel",
  },
  watching: {
    title: "Live checkout",
    upTo: "Tot {amount}",
    noLiveView:
      "De live weergave verschijnt zodra de browser van de checkout opent.",
    watchOnly: "Je kunt meekijken, maar niet klikken.",
  },
  loading: "Checkout laden",
  unavailable: {
    title: "Deze checkout is niet geladen",
    body: "Controleer je verbinding.",
    retry: "Opnieuw proberen",
  },
  missing: {
    title: "Checkout niet gevonden",
    signedInAs: "Je bent ingelogd als {email}. ",
    body: "De link is misschien oud, of de checkout hoort bij een ander account. {switch} of {home}.",
    switch: "Wissel van account",
    home: "ga naar je dashboard",
  },
  ended: {
    placed: "Besteld",
    finished: "Checkout afgerond",
    unconfirmed: "Nog niet bevestigd",
    stopped: "Deze checkout is gestopt",
    doneNote: "Je hoeft verder niets te doen.",
    unconfirmedNote:
      "Wacht op de e-mail van de winkel voordat je het opnieuw koopt.",
    stoppedNote:
      "Er is niets afgeschreven. Vraag {host} om het opnieuw te proberen.",
    yourAssistant: "je assistent",
  },
  expired: {
    request: "Dit verzoek is verlopen",
    approval: "Deze goedkeuring is verlopen",
    body: "Vraag je assistent om het opnieuw te proberen; die start dan een nieuwe.",
  },
  cancelled: {
    title: "Checkout geannuleerd",
    body: "Er is niets afgeschreven.",
  },
  payment: {
    needsYou: "{store} heeft je nodig",
    title: "Keur de betaling goed",
    over: "{over} boven je limiet van {limit}",
    within: "Binnen je limiet van {limit}",
    limit: "Je limiet: {limit}",
    section: "Veilige goedkeuring van betaling",
  },
  store: {
    private: "Alleen jij kunt dit invullen",
    question: "Een korte vraag van {store}",
    section: "Veilige invoer voor de winkel",
    secretNote:
      "Gaat rechtstreeks naar {store}. Je assistent ziet het nooit en bewaart het niet.",
    secretNoteNamed:
      "Gaat rechtstreeks naar {store}. {host} ziet het nooit en bewaart het niet.",
  },
  limit: {
    cardNote: "Je kaart blijft bij Crossmint. Je assistent ziet hem nooit.",
    cardNoteNamed: "Je kaart blijft bij Crossmint. {host} ziet hem nooit.",
    title: "Stel een bestedingslimiet in",
    setUp: "Bestedingslimiet instellen",
    lede: "Stel in hoeveel je assistent met je kaart mag uitgeven, voor deze bestelling en de volgende. Je kunt hem altijd intrekken.",
    ledeNamed:
      "Stel in hoeveel {host} met je kaart mag uitgeven, voor deze bestelling en de volgende. Je kunt hem altijd intrekken.",
    amount: "Bedrag",
    name: "Doel",
    anyStore: "Elke winkel",
    worksFor: "Geldt voor",
    storeTitle: "Beperk tot één winkel",
    website: "Website",
    save: "Opslaan",
    onlyAt: "Alleen bij {store}",
    expires: "Verloopt over",
    card: "Kaart",
    approved: "Bestedingslimiet goedgekeurd",
    approvedLede: "{name}: {amount}, tot {date}.",
    paying: "{store} wordt er nu mee betaald.",
    invalidAmount: "Vul een bedrag in, zoals 50.",
    invalidName: "Geef een doel op, zoals Boodschappen.",
    missing: "Dit verzoek is niet beschikbaar",
    missingLede:
      "Het is verlopen of was voor een ander account. Vraag je assistent om een nieuw verzoek.",
    yourLimits: "Bekijk je bestedingslimieten",
    cancel: "Annuleren",
    cancelled: "Geen bestedingslimiet goedgekeurd",
    cancelledLede:
      "Er is niets goedgekeurd of betaald. Je kunt dit tabblad sluiten.",
  },
} satisfies typeof en;
