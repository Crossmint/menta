import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Kassa",
    shareTitle: "Godkänn ditt köp · {brand}",
    description:
      "Logga in på Menta för att slutföra det här steget. Bara du kan godkänna en utgiftsgräns; din assistent ser aldrig ditt kort.",
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
  from: "Från {host}",
  cancel: {
    confirm: "Avbryta köpet? Inget har dragits.",
    keep: "Fortsätt",
    cancel: "Avbryt köpet",
    ask: "Avbryt det här köpet",
  },
  done: {
    approved: "Godkänt",
    sent: "Skickat",
    yourAssistant: "Din assistent",
    placing: "Din beställning läggs nu.",
    continuing: "Köpet fortsätter med ditt svar.",
    sayDone:
      "{step} Gå tillbaka till {host} och säg att du är klar, så får du höra resultatet.",
    placingResult:
      "Din beställning läggs nu. {host} får resultatet när butiken bekräftar den.",
    continuingResult:
      "Köpet fortsätter med ditt svar. {host} får resultatet när butiken bekräftar beställningen.",
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
  missing: {
    title: "Köpet hittades inte",
    signedInAs: "Du är inloggad som {email}. ",
    body: "Länken kan vara gammal, eller så hör köpet till ett annat konto. {switch} eller {home}.",
    switch: "Byt konto",
    home: "gå till din översikt",
  },
  ended: {
    placed: "Beställning lagd",
    finished: "Köpet är klart",
    unconfirmed: "Inte bekräftat än",
    stopped: "Köpet stoppades",
    doneNote: "Du behöver inte göra något mer.",
    unconfirmedNote: "Vänta på mejlet från butiken innan du köper igen.",
    stoppedNote: "Inget har dragits. Be {host} att försöka igen.",
    yourAssistant: "din assistent",
  },
  expired: {
    request: "Begäran har gått ut",
    approval: "Godkännandet har gått ut",
    body: "Be din assistent att försöka igen, så startas en ny.",
  },
  cancelled: {
    title: "Köpet avbröts",
    body: "Inget har dragits.",
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
    private: "Bara du kan skriva det här",
    question: "En snabb fråga från {store}",
    section: "Säker inmatning till butiken",
    secretNote:
      "Går direkt till {store}. Din assistent ser eller sparar det aldrig.",
    secretNoteNamed:
      "Går direkt till {store}. {host} ser det aldrig och sparar det inte.",
  },
  limit: {
    cardNote: "Ditt kort stannar hos Crossmint. Din assistent ser det aldrig.",
    cardNoteNamed: "Ditt kort stannar hos Crossmint. {host} ser det aldrig.",
    title: "Skapa en utgiftsgräns",
    setUp: "Skapa utgiftsgräns",
    lede: "Ange hur mycket din assistent får spendera på ditt kort, för den här beställningen och kommande. Du kan återkalla den när som helst.",
    ledeNamed:
      "Ange hur mycket {host} får spendera på ditt kort, för den här beställningen och kommande. Du kan återkalla den när som helst.",
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
    yourLimits: "Se dina utgiftsgränser",
    cancel: "Avbryt",
    cancelled: "Ingen utgiftsgräns godkänd",
    cancelledLede:
      "Inget godkändes eller betalades. Du kan stänga den här fliken.",
  },
} satisfies typeof en;
