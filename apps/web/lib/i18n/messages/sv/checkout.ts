import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Kassa",
    shareTitle: "Logga in säkert",
    description:
      "Skriv butikens lösenord och koder här, inte i chatten. Din assistent ser dem aldrig.",
  },
  titles: {
    payment: "Godkänn betalning",
    store: "Butiken behöver dig",
    working: "Köpet pågår",
    done: "Beställning lagd",
    stopped: "Köpet stoppades",
    expired: "Begäran har gått ut",
    cancelled: "Köpet avbröts",
    approved: "Godkänt",
    sent: "Skickat",
    missing: "Köpet hittades inte",
  },
  returnTo: "Tillbaka till {host}",
  returnToSentence: "Gå tillbaka till {host}.",
  cancel: {
    ask: "Avbryt det här köpet",
  },
  done: {
    approved: "Godkänt",
    sent: "Skickat",
    goBack: "Gå tillbaka till {host} och säg att du är klar.",
    goBackAssistant: "Gå tillbaka till din assistent och säg att du är klar.",
    yourAssistant: "Din assistent",
    placing: "Din beställning läggs nu.",
    sayDone:
      "{step} Gå tillbaka till {host} och säg att du är klar, så får du höra resultatet.",
    placingResult:
      "Din beställning läggs nu. {host} får resultatet när butiken bekräftar den.",
    paidUpTo: "Betalt upp till",
    item: "Vara",
    store: "Butik",
  },
  watching: {
    title: "Följ köpet live",
    upTo: "Upp till {amount}",
    noLiveView: "Livevyn visas när köpets webbläsare har öppnats.",
    watchOnly: "Du kan titta, men inte klicka i den.",
  },
  loading: "Laddar köpet",
  unavailable: {
    title: "Köpet kunde inte laddas",
    body: "Kontrollera din anslutning.",
    retry: "Försök igen",
  },
  dashboard: "Gå till din översikt",
  missing: {
    title: "Köpet hittades inte",
    signedInAs: "Du är inloggad som {email}. ",
    body: "Länken kan vara gammal, eller så hör köpet till ett annat konto. {switch}.",
    switch: "Byt konto",
  },
  ended: {
    seeOrder: "Se din beställning",
    placed: "Beställning lagd",
    doneNote: "Du behöver inte göra något mer.",
  },
  expired: {
    request: "Begäran har gått ut",
    approval: "Godkännandet har gått ut",
  },
  cancelled: {
    title: "Köpet avbröts",
    body: "Inget har dragits.",
    closeTab: "Du kan nu stänga fliken och gå tillbaka till {host}.",
    closeTabAny: "Du kan nu stänga fliken och gå tillbaka till din assistent.",
  },
  payment: {
    needsYou: "{store} behöver dig",
    title: "Godkänn betalningen",
    over: "{over} över din gräns på {limit}",
    within: "Inom din gräns på {limit}",
    limit: "Din gräns: {limit}",
    section: "Säkert godkännande av betalning",
  },
  store: {
    needsInfo:
      "{menta} behöver lite information för att slutföra uppgiften på {store}.",
    question: "En snabb fråga från {store}",
    section: "Säker inmatning till butiken",
    secretNote:
      "Går direkt till {store}. Din assistent ser eller sparar det aldrig.",
    secretNoteNamed:
      "Går direkt till {store}. {host} ser det aldrig och sparar det inte.",
  },
  limit: {
    allow: "Låt {host} använda ditt kort på dina villkor.",
    allowAny: "Låt din assistent använda ditt kort på dina villkor.",
    cardNote: "Ditt kort stannar hos Crossmint. Din assistent ser det aldrig.",
    cardNoteNamed: "Ditt kort stannar hos Crossmint. {host} ser det aldrig.",
    title: "Skapa en utgiftsgräns",
    setUp: "Skapa utgiftsgräns",
    lede: "Ange hur mycket din assistent får spendera på ditt kort, för den här beställningen och kommande. Du kan återkalla den när som helst.",
    amount: "Belopp",
    name: "Syfte",
    anyStore: "Valfri butik",
    worksFor: "Gäller för",
    storeTitle: "Begränsa till en butik",
    website: "Webbplats",
    save: "Spara",
    onlyAt: "Bara hos {store}",
    expires: "Går ut om",
    card: "Kort",
    approved: "Utgiftsgränsen är godkänd",
    approvedLede: "{name}: {amount}, till {date}.",
    paying: "Betalar {store} med den nu.",
    invalidAmount: "Ange ett belopp, t.ex. 50.",
    invalidName: "Ange vad den är till för, t.ex. Matvaror.",
    missing: "Den här förfrågan är inte tillgänglig",
    missingLede:
      "Den har gått ut eller gjordes för ett annat konto. Be din assistent om en ny.",
    cancel: "Avbryt",
    cancelled: "Ingen utgiftsgräns godkänd",
    cancelledLede:
      "Inget godkändes eller betalades. Du kan stänga den här fliken.",
  },
} satisfies typeof en;
