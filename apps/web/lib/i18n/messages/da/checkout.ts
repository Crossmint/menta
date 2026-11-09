import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Checkout",
    shareTitle: "Log ind sikkert",
    description:
      "Skriv butikkens adgangskoder og koder her, ikke i chatten. Din assistent ser dem aldrig.",
  },
  titles: {
    payment: "Godkend betaling",
    store: "Butikken har brug for dig",
    working: "Live-checkout",
    done: "Ordre afgivet",
    stopped: "Checkout stoppet",
    expired: "Anmodning udløbet",
    cancelled: "Checkout annulleret",
    approved: "Godkendt",
    sent: "Sendt",
    missing: "Checkout ikke fundet",
  },
  returnTo: "Tilbage til {host}",
  returnToSentence: "Gå tilbage til {host}.",
  cancel: {
    ask: "Annuller denne checkout",
  },
  done: {
    approved: "Godkendt",
    sent: "Sendt",
    goBack: "Gå tilbage til {host}, og sig, at du er færdig.",
    goBackAssistant: "Gå tilbage til din assistent, og sig, at du er færdig.",
    yourAssistant: "Din assistent",
    placing: "Checkouten afgiver din ordre.",
    sayDone:
      "{step} Gå tilbage til {host}, og sig, at du er færdig, så får du resultatet.",
    placingResult:
      "Checkouten afgiver din ordre. {host} får resultatet, når butikken bekræfter den.",
    paidUpTo: "Betalt op til",
    item: "Vare",
    store: "Butik",
  },
  watching: {
    title: "Live-checkout",
    upTo: "Op til {amount}",
    noLiveView: "Livevisningen dukker op, når checkoutens browser åbner.",
    watchOnly: "Du kan se med, men ikke klikke i den.",
  },
  loading: "Indlæser checkout",
  unavailable: {
    title: "Checkouten kunne ikke indlæses",
    body: "Tjek din forbindelse.",
    retry: "Prøv igen",
  },
  dashboard: "Gå til dit overblik",
  missing: {
    title: "Kan ikke finde checkouten",
    signedInAs: "Du er logget ind som {email}. ",
    body: "Linket er måske gammelt, eller checkouten hører til en anden konto. {switch}.",
    switch: "Skift konto",
  },
  ended: {
    seeOrder: "Se din ordre",
    placed: "Ordre afgivet",
    doneNote: "Du behøver ikke gøre mere.",
  },
  expired: {
    request: "Anmodningen er udløbet",
    approval: "Godkendelsen er udløbet",
  },
  cancelled: {
    title: "Checkout annulleret",
    body: "Der blev ikke trukket noget.",
    closeTab: "Du kan nu lukke fanen og gå tilbage til {host}.",
    closeTabAny: "Du kan nu lukke fanen og gå tilbage til din assistent.",
  },
  payment: {
    needsYou: "{store} har brug for dig",
    title: "Godkend betalingen",
    over: "{over} over din grænse på {limit}",
    within: "Inden for din grænse på {limit}",
    limit: "Din grænse: {limit}",
    section: "Sikker godkendelse af betaling",
  },
  store: {
    needsInfo:
      "{menta} skal bruge nogle oplysninger for at fuldføre opgaven på {store}.",
    question: "Et hurtigt spørgsmål fra {store}",
    section: "Sikker indtastning til butikken",
    secretNote:
      "Går direkte til {store}. Din assistent ser det aldrig og gemmer det ikke.",
    secretNoteNamed:
      "Går direkte til {store}. {host} ser den aldrig og gemmer den ikke.",
  },
  limit: {
    allow: "Lad {host} bruge dit kort på dine betingelser.",
    allowAny: "Lad din assistent bruge dit kort på dine betingelser.",
    cardNote: "Dit kort bliver hos Crossmint. Din assistent ser det aldrig.",
    cardNoteNamed: "Dit kort bliver hos Crossmint. {host} ser det aldrig.",
    title: "Opret en forbrugsgrænse",
    setUp: "Opret forbrugsgrænse",
    lede: "Angiv, hvor meget din assistent må bruge på dit kort, til denne ordre og de næste. Du kan til enhver tid tilbagekalde den.",
    amount: "Beløb",
    name: "Formål",
    anyStore: "Alle butikker",
    worksFor: "Gælder for",
    storeTitle: "Begræns til én butik",
    website: "Websted",
    save: "Gem",
    onlyAt: "Kun hos {store}",
    expires: "Udløber om",
    card: "Kort",
    approved: "Forbrugsgrænsen er godkendt",
    approvedLede: "{name}: {amount}, til {date}.",
    paying: "Betaler {store} med den nu.",
    invalidAmount: "Indtast et beløb, fx 50.",
    invalidName: "Skriv, hvad den er til, fx Dagligvarer.",
    missing: "Denne anmodning er ikke tilgængelig",
    missingLede:
      "Den er udløbet, eller den blev lavet til en anden konto. Bed din assistent om en ny.",
    cancel: "Annuller",
    cancelled: "Ingen forbrugsgrænse godkendt",
    cancelledLede: "Intet blev godkendt eller betalt. Du kan lukke denne fane.",
  },
} satisfies typeof en;
