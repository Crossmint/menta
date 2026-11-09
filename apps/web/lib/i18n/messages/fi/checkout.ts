import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Kassa",
    shareTitle: "Kirjaudu turvallisesti",
    description:
      "Kirjoita kaupan salasanat ja koodit tänne, älä chattiin. Avustajasi ei koskaan näe niitä.",
  },
  titles: {
    payment: "Hyväksy maksu",
    store: "Kauppa tarvitsee sinua",
    working: "Ostos käynnissä",
    done: "Tilaus tehty",
    stopped: "Ostos pysähtyi",
    expired: "Pyyntö vanheni",
    cancelled: "Ostos peruttu",
    approved: "Hyväksytty",
    sent: "Lähetetty",
    missing: "Ostosta ei löytynyt",
  },
  returnTo: "Palaa palveluun {host}",
  returnToSentence: "Palaa palveluun {host}.",
  cancel: {
    ask: "Peru tämä ostos",
  },
  done: {
    approved: "Hyväksytty",
    sent: "Lähetetty",
    goBack: "Palaa palveluun {host} ja kerro, että olet valmis.",
    goBackAssistant: "Palaa avustajasi luo ja kerro, että olet valmis.",
    yourAssistant: "Avustajasi",
    placing: "Tilaustasi tehdään nyt.",
    sayDone:
      "{step} Palaa palveluun {host} ja kerro olevasi valmis, niin kuulet tuloksen.",
    placingResult:
      "Tilaustasi tehdään nyt. {host} saa tuloksen, kun kauppa vahvistaa tilauksen.",
    paidUpTo: "Maksettu enintään",
    item: "Tuote",
    store: "Kauppa",
  },
  watching: {
    title: "Ostos käynnissä",
    upTo: "Enintään {amount}",
    noLiveView: "Suora näkymä tulee esiin, kun ostoksen selain aukeaa.",
    watchOnly: "Voit seurata, mutta et voi klikata näkymässä.",
  },
  loading: "Ladataan ostosta",
  unavailable: {
    title: "Ostoksen lataaminen ei onnistunut",
    body: "Tarkista verkkoyhteytesi.",
    retry: "Yritä uudelleen",
  },
  dashboard: "Siirry etusivulle",
  missing: {
    title: "Ostosta ei löydy",
    signedInAs: "Olet kirjautunut tilillä {email}. ",
    body: "Linkki voi olla vanha, tai ostos voi kuulua toiselle tilille. {switch}.",
    switch: "Vaihda tiliä",
  },
  ended: {
    seeOrder: "Katso tilauksesi",
    placed: "Tilaus tehty",
    doneNote: "Sinulta ei tarvita enää mitään.",
  },
  expired: {
    request: "Tämä pyyntö vanheni",
    approval: "Tämä hyväksyntä vanheni",
  },
  cancelled: {
    title: "Ostos peruttu",
    body: "Mitään ei veloitettu.",
    closeTab: "Voit nyt sulkea tämän välilehden ja palata palveluun {host}.",
    closeTabAny: "Voit nyt sulkea tämän välilehden ja palata avustajaasi.",
  },
  payment: {
    needsYou: "{store} tarvitsee sinua",
    title: "Hyväksy maksu",
    over: "{over} yli rajasi ({limit})",
    within: "Rajasi sisällä ({limit})",
    limit: "Rajasi: {limit}",
    section: "Turvallinen maksun hyväksyntä",
  },
  store: {
    needsInfo:
      "{menta} tarvitsee joitakin tietoja tehtävän viimeistelyyn kaupassa {store}.",
    question: "Nopea kysymys kaupalta {store}",
    section: "Turvallinen syöttö kaupalle",
    secretNote:
      "Menee suoraan kauppaan {store}. Avustajasi ei koskaan näe tai tallenna sitä.",
    secretNoteNamed:
      "Menee suoraan kauppaan {store}. {host} ei koskaan näe tai tallenna sitä.",
  },
  limit: {
    allow: "Anna palvelun {host} käyttää korttiasi omilla ehdoillasi.",
    allowAny: "Anna avustajasi käyttää korttiasi omilla ehdoillasi.",
    cardNote: "Korttisi pysyy Crossmintillä. Avustajasi ei koskaan näe sitä.",
    cardNoteNamed: "Korttisi pysyy Crossmintillä. {host} ei koskaan näe sitä.",
    title: "Määritä kuluraja",
    setUp: "Määritä kuluraja",
    lede: "Määritä, paljonko avustajasi saa käyttää kortillasi tähän tilaukseen ja seuraaviin. Voit perua sen milloin tahansa.",
    amount: "Summa",
    name: "Käyttötarkoitus",
    anyStore: "Mikä tahansa kauppa",
    worksFor: "Käytössä",
    storeTitle: "Rajaa yhteen kauppaan",
    website: "Verkkosivusto",
    save: "Tallenna",
    onlyAt: "Vain kaupassa {store}",
    expires: "Päättyy",
    card: "Kortti",
    approved: "Kuluraja hyväksytty",
    approvedLede: "{name}: {amount}, {date} asti.",
    paying: "Maksetaan nyt {store} tällä.",
    invalidAmount: "Anna summa, esim. 50.",
    invalidName: "Kerro käyttötarkoitus, esim. Ruokaostokset.",
    missing: "Tämä pyyntö ei ole saatavilla",
    missingLede:
      "Se on vanhentunut tai tehty toiselle tilille. Pyydä avustajaltasi uusi.",
    cancel: "Peru",
    cancelled: "Kulurajaa ei hyväksytty",
    cancelledLede:
      "Mitään ei hyväksytty eikä maksettu. Voit sulkea tämän välilehden.",
  },
} satisfies typeof en;
