import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Kassa",
    shareTitle: "Hyväksy ostoksesi · {brand}",
    description:
      "Kirjaudu Mentaan ja viimeistele tämä vaihe. Vain sinä voit hyväksyä kulurajan; avustajasi ei koskaan näe korttiasi.",
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
  from: "Lähde: {host}",
  cancel: {
    confirm: "Perutaanko ostos? Mitään ei ole veloitettu.",
    keep: "Älä peru",
    cancel: "Peru ostos",
    ask: "Peru tämä ostos",
  },
  done: {
    approved: "Hyväksytty",
    sent: "Lähetetty",
    yourAssistant: "Avustajasi",
    placing: "Tilaustasi tehdään nyt.",
    continuing: "Ostos jatkuu vastauksesi perusteella.",
    sayDone:
      "{step} Palaa palveluun {host} ja kerro olevasi valmis, niin kuulet tuloksen.",
    placingResult:
      "Tilaustasi tehdään nyt. {host} saa tuloksen, kun kauppa vahvistaa tilauksen.",
    continuingResult:
      "Ostos jatkuu vastauksesi perusteella. {host} saa tuloksen, kun kauppa vahvistaa tilauksen.",
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
  missing: {
    title: "Ostosta ei löydy",
    signedInAs: "Olet kirjautunut tilillä {email}. ",
    body: "Linkki voi olla vanha, tai ostos voi kuulua toiselle tilille. {switch} tai {home}.",
    switch: "Vaihda tiliä",
    home: "siirry etusivulle",
  },
  ended: {
    placed: "Tilaus tehty",
    finished: "Ostos valmis",
    unconfirmed: "Ei vielä vahvistettu",
    stopped: "Tämä ostos pysähtyi",
    doneNote: "Sinulta ei tarvita enää mitään.",
    unconfirmedNote: "Odota kaupan sähköpostia ennen kuin ostat uudelleen.",
    stoppedNote:
      "Mitään ei veloitettu. {host} voi yrittää uudelleen, kun pyydät.",
    yourAssistant: "Avustajasi",
  },
  expired: {
    request: "Tämä pyyntö vanheni",
    approval: "Tämä hyväksyntä vanheni",
    body: "Pyydä avustajaasi yrittämään uudelleen; se aloittaa uuden.",
  },
  cancelled: {
    title: "Ostos peruttu",
    body: "Mitään ei veloitettu.",
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
    private: "Vain sinä voit kirjoittaa tämän",
    question: "Nopea kysymys kaupalta {store}",
    section: "Turvallinen syöttö kaupalle",
    secretNote:
      "Menee suoraan kauppaan {store}. Avustajasi ei koskaan näe tai tallenna sitä.",
    secretNoteNamed:
      "Menee suoraan kauppaan {store}. {host} ei koskaan näe tai tallenna sitä.",
  },
  limit: {
    cardNote: "Korttisi pysyy Crossmintillä. Avustajasi ei koskaan näe sitä.",
    cardNoteNamed: "Korttisi pysyy Crossmintillä. {host} ei koskaan näe sitä.",
    title: "Määritä kuluraja",
    setUp: "Määritä kuluraja",
    lede: "Määritä, paljonko avustajasi saa käyttää kortillasi tähän tilaukseen ja seuraaviin. Voit perua sen milloin tahansa.",
    ledeNamed:
      "Määritä, paljonko {host} saa käyttää kortillasi tähän tilaukseen ja seuraaviin. Voit perua sen milloin tahansa.",
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
    yourLimits: "Näytä kulurajasi",
    cancel: "Peru",
    cancelled: "Kulurajaa ei hyväksytty",
    cancelledLede:
      "Mitään ei hyväksytty eikä maksettu. Voit sulkea tämän välilehden.",
  },
} satisfies typeof en;
