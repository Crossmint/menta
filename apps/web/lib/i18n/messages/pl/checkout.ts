import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Płatność",
    shareTitle: "Zaloguj się bezpiecznie",
    description:
      "Wpisz tutaj hasła i kody do sklepu, nie na czacie. Twój asystent nigdy ich nie widzi.",
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
  cancel: {
    ask: "Anuluj ten zakup",
  },
  done: {
    approved: "Zatwierdzono",
    sent: "Wysłano",
    goBack: "Wróć do {host} i powiedz, że gotowe.",
    goBackAssistant: "Wróć do swojego asystenta i powiedz, że gotowe.",
    yourAssistant: "Twój asystent",
    placing: "Trwa składanie zamówienia.",
    sayDone: "{step} Wróć do {host} i napisz, że gotowe, aby poznać wynik.",
    placingResult:
      "Trwa składanie zamówienia. {host} dostanie wynik, gdy sklep je potwierdzi.",
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
  dashboard: "Przejdź do swojego panelu",
  missing: {
    title: "Nie możemy znaleźć tego zakupu",
    signedInAs: "Zalogowano jako {email}. ",
    body: "Link może być nieaktualny albo zakup należy do innego konta. {switch}.",
    switch: "Zmień konto",
  },
  ended: {
    seeOrder: "Zobacz swoje zamówienie",
    placed: "Zamówienie złożone",
    doneNote: "Nic więcej nie musisz robić.",
  },
  expired: {
    request: "Ta prośba wygasła",
    approval: "To zatwierdzenie wygasło",
  },
  cancelled: {
    title: "Zakup anulowany",
    body: "Nic nie zostało pobrane.",
    closeTab: "Możesz teraz zamknąć tę kartę i wrócić do {host}.",
    closeTabAny: "Możesz teraz zamknąć tę kartę i wrócić do asystenta.",
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
    needsInfo:
      "{menta} potrzebuje kilku informacji, aby dokończyć zadanie w {store}.",
    question: "Szybkie pytanie od {store}",
    section: "Bezpieczne dane dla sklepu",
    secretNote:
      "Trafia prosto do {store}. Twój asystent nigdy tego nie widzi ani nie zapisuje.",
    secretNoteNamed:
      "Trafia prosto do {store}. {host} nigdy tego nie widzi ani nie przechowuje.",
  },
  limit: {
    allow: "Pozwól {host} korzystać z Twojej karty na Twoich warunkach.",
    allowAny:
      "Pozwól asystentowi korzystać z Twojej karty na Twoich warunkach.",
    cardNote:
      "Twoja karta zostaje w Crossmint. Twój asystent nigdy jej nie widzi.",
    cardNoteNamed:
      "Twoja karta zostaje w Crossmint. {host} nigdy jej nie widzi.",
    title: "Ustaw limit wydatków",
    setUp: "Ustaw limit wydatków",
    lede: "Ustal, ile twój asystent może wydać z twojej karty, na to zamówienie i kolejne. Możesz go cofnąć w dowolnej chwili.",
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
    cancel: "Anuluj",
    cancelled: "Nie zatwierdzono limitu wydatków",
    cancelledLede:
      "Nic nie zostało zatwierdzone ani zapłacone. Możesz zamknąć tę kartę.",
  },
} satisfies typeof en;
