import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Płatność",
    shareTitle: "Zatwierdź zakup · {brand}",
    description:
      "Zaloguj się do Menty, aby dokończyć ten krok. Tylko ty możesz zatwierdzić limit wydatków; twój asystent nigdy nie widzi twojej karty.",
  },
  titles: {
    payment: "Zatwierdź płatność",
    store: "Sklep czeka na ciebie",
    working: "Zakup na żywo",
    done: "Zamówienie złożone",
    stopped: "Zakup zatrzymany",
    expired: "Prośba wygasła",
    cancelled: "Zakup anulowany",
    approved: "Zatwierdzono",
    sent: "Wysłano",
    missing: "Nie znaleziono zakupu",
  },
  returnTo: "Wróć do {host}",
  returnToSentence: "Wróć do {host}.",
  from: "Z {host}",
  cancel: {
    confirm: "Anulować zakup? Nic nie zostało pobrane.",
    keep: "Zostaw",
    cancel: "Anuluj zakup",
    ask: "Anuluj ten zakup",
  },
  done: {
    approved: "Zatwierdzono",
    sent: "Wysłano",
    yourAssistant: "Twój asystent",
    placing: "Trwa składanie zamówienia.",
    continuing: "Zakup jest kontynuowany z twoją odpowiedzią.",
    sayDone: "{step} Wróć do {host} i napisz, że gotowe, aby poznać wynik.",
    placingResult:
      "Trwa składanie zamówienia. {host} dostanie wynik, gdy sklep je potwierdzi.",
    continuingResult:
      "Zakup jest kontynuowany z twoją odpowiedzią. {host} dostanie wynik, gdy sklep potwierdzi zamówienie.",
    paidUpTo: "Zapłacono do",
    item: "Produkt",
    store: "Sklep",
  },
  watching: {
    title: "Zakup na żywo",
    upTo: "Do {amount}",
    noLiveView:
      "Podgląd na żywo pojawi się, gdy otworzy się przeglądarka zakupu.",
    watchOnly: "Możesz oglądać, ale nie możesz w nim klikać.",
  },
  loading: "Wczytywanie zakupu",
  unavailable: {
    title: "Nie udało się wczytać zakupu",
    body: "Sprawdź połączenie.",
    retry: "Spróbuj ponownie",
  },
  missing: {
    title: "Nie możemy znaleźć tego zakupu",
    signedInAs: "Zalogowano jako {email}. ",
    body: "Link może być nieaktualny albo zakup należy do innego konta. {switch} lub {home}.",
    switch: "Zmień konto",
    home: "przejdź do swojego panelu",
  },
  ended: {
    placed: "Zamówienie złożone",
    finished: "Zakup zakończony",
    unconfirmed: "Jeszcze niepotwierdzone",
    stopped: "Ten zakup został zatrzymany",
    doneNote: "Nic więcej nie musisz robić.",
    unconfirmedNote: "Zanim kupisz to ponownie, poczekaj na e-mail od sklepu.",
    stoppedNote: "Nic nie zostało pobrane. Poproś {host} o ponowną próbę.",
    yourAssistant: "swojego asystenta",
  },
  expired: {
    request: "Ta prośba wygasła",
    approval: "To zatwierdzenie wygasło",
    body: "Poproś asystenta o ponowną próbę; rozpocznie wszystko od nowa.",
  },
  cancelled: {
    title: "Zakup anulowany",
    body: "Nic nie zostało pobrane.",
  },
  payment: {
    needsYou: "{store} czeka na ciebie",
    title: "Zatwierdź płatność",
    over: "Przekracza limit {limit} o {over}",
    within: "W ramach limitu {limit}",
    limit: "Twój limit: {limit}",
    section: "Bezpieczne zatwierdzanie płatności",
  },
  store: {
    private: "Tylko ty możesz to wpisać",
    question: "Szybkie pytanie od {store}",
    section: "Bezpieczne dane dla sklepu",
    secretNote:
      "Trafia prosto do {store}. Twój asystent nigdy tego nie widzi ani nie zapisuje.",
    secretNoteNamed:
      "Trafia prosto do {store}. {host} nigdy tego nie widzi ani nie przechowuje.",
  },
  limit: {
    cardNote:
      "Twoja karta zostaje w Crossmint. Twój asystent nigdy jej nie widzi.",
    cardNoteNamed:
      "Twoja karta zostaje w Crossmint. {host} nigdy jej nie widzi.",
    title: "Ustaw limit wydatków",
    setUp: "Ustaw limit wydatków",
    lede: "Ustal, ile twój asystent może wydać z twojej karty, na to zamówienie i kolejne. Możesz go cofnąć w dowolnej chwili.",
    ledeNamed:
      "Ustal, ile {host} może wydać z twojej karty, na to zamówienie i kolejne. Możesz go cofnąć w dowolnej chwili.",
    amount: "Kwota",
    name: "Cel",
    anyStore: "Dowolny sklep",
    worksFor: "Obowiązuje w",
    storeTitle: "Ogranicz do jednego sklepu",
    website: "Strona",
    save: "Zapisz",
    onlyAt: "Tylko w {store}",
    expires: "Wygasa za",
    card: "Karta",
    approved: "Limit wydatków zatwierdzony",
    approvedLede: "{name}: {amount}, do {date}.",
    paying: "Płacę nim teraz w {store}.",
    invalidAmount: "Wpisz kwotę, np. 50.",
    invalidName: "Podaj cel, np. Zakupy spożywcze.",
    missing: "Ta prośba jest niedostępna",
    missingLede: "Wygasła albo była dla innego konta. Poproś asystenta o nową.",
    yourLimits: "Zobacz swoje limity wydatków",
    cancel: "Anuluj",
    cancelled: "Nie zatwierdzono limitu wydatków",
    cancelledLede:
      "Nic nie zostało zatwierdzone ani zapłacone. Możesz zamknąć tę kartę.",
  },
} satisfies typeof en;
