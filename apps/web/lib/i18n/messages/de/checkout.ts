import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Checkout",
    shareTitle: "Sicher anmelden",
    description:
      "Gib Passwörter und Codes für den Shop hier ein, nicht im Chat. Dein Assistent sieht sie nie.",
  },
  titles: {
    payment: "Zahlung freigeben",
    store: "Der Shop braucht dich",
    working: "Live-Checkout",
    done: "Bestellt",
    stopped: "Checkout gestoppt",
    expired: "Anfrage abgelaufen",
    cancelled: "Checkout abgebrochen",
    approved: "Freigegeben",
    sent: "Gesendet",
    missing: "Checkout nicht gefunden",
  },
  returnTo: "Zurück zu {host}",
  returnToSentence: "Geh zurück zu {host}.",
  cancel: {
    ask: "Diesen Checkout abbrechen",
  },
  done: {
    approved: "Freigegeben",
    sent: "Gesendet",
    goBack: "Geh zurück zu {host} und sag, dass du fertig bist.",
    goBackAssistant:
      "Geh zurück zu deinem Assistenten und sag, dass du fertig bist.",
    yourAssistant: "Dein Assistent",
    placing: "Der Checkout gibt deine Bestellung auf.",
    sayDone:
      "{step} Sag zurück in {host}, dass du fertig bist, dann erfährst du das Ergebnis.",
    placingResult:
      "Der Checkout gibt deine Bestellung auf. {host} bekommt das Ergebnis, sobald der Shop sie bestätigt.",
    paidUpTo: "Bezahlt bis zu",
    item: "Artikel",
    store: "Shop",
  },
  watching: {
    title: "Live-Checkout",
    upTo: "Bis zu {amount}",
    noLiveView:
      "Die Live-Ansicht erscheint, sobald sich der Browser des Checkouts öffnet.",
    watchOnly: "Du kannst zusehen, aber nicht hineinklicken.",
  },
  loading: "Checkout wird geladen",
  unavailable: {
    title: "Dieser Checkout wurde nicht geladen",
    body: "Prüfe deine Verbindung.",
    retry: "Erneut versuchen",
  },
  dashboard: "Zu deinem Dashboard",
  missing: {
    title: "Checkout nicht gefunden",
    signedInAs: "Du bist als {email} angemeldet. ",
    body: "Der Link ist vielleicht alt, oder der Checkout gehört zu einem anderen Konto. {switch}.",
    switch: "Konto wechseln",
  },
  ended: {
    seeOrder: "Bestellung ansehen",
    placed: "Bestellt",
    doneNote: "Du musst nichts weiter tun.",
  },
  expired: {
    request: "Diese Anfrage ist abgelaufen",
    approval: "Diese Freigabe ist abgelaufen",
  },
  cancelled: {
    title: "Checkout abgebrochen",
    body: "Es wurde nichts abgebucht.",
    closeTab:
      "Du kannst diesen Tab jetzt schließen und zu {host} zurückkehren.",
    closeTabAny:
      "Du kannst diesen Tab jetzt schließen und zu deinem Assistenten zurückkehren.",
  },
  payment: {
    needsYou: "{store} braucht dich",
    title: "Gib die Zahlung frei",
    over: "{over} über deinem Limit von {limit}",
    within: "Innerhalb deines Limits von {limit}",
    limit: "Dein Limit: {limit}",
    section: "Sichere Zahlungsfreigabe",
  },
  store: {
    needsInfo:
      "{menta} braucht ein paar Angaben, um die Aufgabe auf {store} abzuschließen.",
    question: "Eine kurze Frage von {store}",
    section: "Sichere Eingabe für den Shop",
    secretNote:
      "Geht direkt an {store}. Dein Assistent sieht es nie und speichert es nicht.",
    secretNoteNamed:
      "Geht direkt an {store}. {host} sieht es nie und speichert es nicht.",
  },
  limit: {
    allow: "Erlaube {host}, deine Karte zu deinen Bedingungen zu nutzen.",
    allowAny:
      "Erlaube deinem Assistenten, deine Karte zu deinen Bedingungen zu nutzen.",
    cardNote: "Deine Karte bleibt bei Crossmint. Dein Assistent sieht sie nie.",
    cardNoteNamed: "Deine Karte bleibt bei Crossmint. {host} sieht sie nie.",
    title: "Richte ein Ausgabenlimit ein",
    setUp: "Ausgabenlimit einrichten",
    lede: "Leg fest, wie viel dein Assistent mit deiner Karte ausgeben darf, für diese Bestellung und die nächsten. Jederzeit widerrufbar.",
    amount: "Betrag",
    name: "Zweck",
    anyStore: "Jeder Shop",
    worksFor: "Gilt für",
    storeTitle: "Auf einen Shop begrenzen",
    website: "Website",
    save: "Speichern",
    onlyAt: "Nur bei {store}",
    expires: "Läuft ab in",
    card: "Karte",
    approved: "Ausgabenlimit freigegeben",
    approvedLede: "{name}: {amount}, bis {date}.",
    paying: "{store} wird jetzt damit bezahlt.",
    invalidAmount: "Gib einen Betrag ein, z. B. 50.",
    invalidName: "Gib einen Zweck an, z. B. Lebensmittel.",
    missing: "Diese Anfrage ist nicht verfügbar",
    missingLede:
      "Sie ist abgelaufen oder war für ein anderes Konto. Bitte deinen Assistenten um eine neue.",
    cancel: "Abbrechen",
    cancelled: "Kein Ausgabenlimit freigegeben",
    cancelledLede:
      "Es wurde nichts freigegeben oder bezahlt. Du kannst diesen Tab schließen.",
  },
} satisfies typeof en;
