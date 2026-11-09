import type { UiMessages } from "./en.js";

export const de: UiMessages = {
  common: {
    yes: "Ja",
    no: "Nein",
    tryAgain: "Erneut versuchen",
    cancel: "Abbrechen",
    poweredBy: "Bereitgestellt von {logo}",
    quoted: "„{text}“",
  },
  status: {
    starting: "Startet",
    working: "Läuft",
    readyToPay: "Bereit zum Bezahlen",
    needsAnswer: "Wartet auf deine Antwort",
    needsSecureStep: "Sicherer Schritt nötig",
    storeQuestion: "Frage vom Shop",
    needsYou: "Braucht dich",
    orderPlaced: "Bestellt",
    couldntBuy: "Kauf fehlgeschlagen",
    couldntBuyBecause: "Kauf fehlgeschlagen · {reason}",
    blocked: "Blockiert",
    notConfirmed: "Nicht bestätigt",
    stopped: "Gestoppt",
    canceled: "Abgebrochen",
    done: "Fertig",
    cancelingWaiting: "Wird abgebrochen · wartet auf den Shop",
    approvedWaiting: "Freigegeben · wartet auf den Shop",
    sentWaiting: "Gesendet · wartet auf den Shop",
  },
  blocked: {
    "merchant.access_blocked": "Shop hat den Zugriff blockiert",
    "merchant.checkout_error": "Fehler im Checkout des Shops",
    "merchant.fulfillment_unavailable": "Keine Lieferung dorthin",
    "merchant.human_verification_required":
      "Shop verlangt eine menschliche Prüfung",
    "merchant.no_safe_path": "Kein sicherer Weg zum Bezahlen",
    "merchant.payment_declined": "Zahlung abgelehnt",
    "policy.max_cost_exceeded": "Über deinem Limit",
    "product.item_unavailable": "Artikel nicht verfügbar",
    "product.requested_option_unavailable": "Option nicht verfügbar",
  },
  failures: {
    browser_session_lost: "Die Verbindung zum Shop ist abgebrochen.",
    browser_location_unsupported:
      "Der Shop ist von unserem Standort aus nicht erreichbar.",
    cost_limit: "Der Gesamtbetrag hätte dein Limit überschritten.",
    input_expired:
      "Die Anfrage des Shops ist abgelaufen, bevor sie beantwortet wurde.",
    model_error: "Der Checkout-Agent hatte ein Problem.",
    runtime_error: "Der Checkout wurde vor dem Abschluss gestoppt.",
    accounting_unavailable:
      "Crossmint konnte den Zahlungsstatus nicht bestätigen.",
    cancelled: "Der Checkout wurde abgebrochen.",
    reconciliation_required:
      "Wir wissen nicht, ob der Shop diese Bestellung aufgegeben hat. Kauf es noch nicht erneut: Es könnte dir doppelt abgebucht werden.",
    other: "Der Checkout wurde vor dem Abschluss gestoppt.",
  },
  outcome: {
    receipt: "Bestellung vom Shop bestätigt. Beleg gespeichert.",
    noReceipt:
      "Der Shop hat die Bestellung bestätigt. Es wurde kein Beleg gespeichert, schau also in deinen E-Mails nach der Bestätigung des Shops.",
    total: "Gesamt",
    order: "Bestellung {id}",
    deliveringTo: "Lieferung an {label} · {place}",
  },
  progress: {
    stillWorking: "Läuft noch…",
  },
  settled: {
    answered: "Beantwortet",
    approved: "Freigegeben",
    sentSecurely: "Sicher gesendet",
    doneThen: "{done} · {outcome}",
    shownAbove: "Oben angezeigt",
    waitingBelow: "Wartet unten auf dich",
    started: "Checkout gestartet · bis zu {amount}",
    showItHere: "Hier anzeigen",
  },
  form: {
    choosePlaceholder: "Auswählen…",
    showMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
    somethingElse: "Etwas anderes",
    somethingElsePlaceholder: "Sag dem Shop, was du stattdessen möchtest",
    backToOptions: "Zurück zu den Optionen",
    sentWaiting: "Gesendet. Wartet auf den Shop.",
    answerInChat: "Antworte im Chat.",
    choose: "{name} wählen",
    sending: "Wird gesendet…",
    send: "Senden",
    sendSecurely: "Sicher senden",
    secretNote: "Geht direkt an den Shop. Ich sehe es nie.",
    secretNoteAssistant:
      "Geht direkt an den Shop. Dein Assistent sieht es nie.",
    expiresIn: "läuft in {time} ab",
    expiresAt: "gültig bis {time}",
    expiringNow: "läuft gleich ab",
  },
  payment: {
    exactTo: "Genauer Betrag an {merchant}",
    upToTo: "Bis zu diesem Betrag an {merchant}",
    deliveryTo: "Lieferung an {label} · {place}",
    approvedWaiting: "Freigegeben. Wartet auf den Shop.",
    sending: "Deine Freigabe wird an den Shop gesendet…",
    securedNote:
      "Gesichert durch Crossmint. Es wird nichts abgebucht, bevor du freigibst.",
    setUpLimit: "Ausgabenlimit einrichten",
    lede: "Leg fest, wie viel dein Assistent mit deiner Karte ausgeben darf, für diese Bestellung und die nächsten. Jederzeit widerrufbar.",
  },
  approval: {
    payWith: "Bezahlen mit",
    chooseCard: "Karte auswählen",
    addCard: "Karte hinzufügen",
    saveCard: "Karte speichern",
    savingCard: "Wird gespeichert…",
    securityCode: "Sicherheitscode",
    cvcFront: "Gib den 4-stelligen Code auf der Vorderseite deiner Karte ein.",
    cvcBack: "Gib den 3-stelligen Code auf der Rückseite deiner Karte ein.",
    cvcNote:
      "Crossmint behält diesen Code. Der Shop und dein Assistent sehen ihn nie.",
    useDifferentCard: "Andere Karte verwenden",
    cardsDidntLoad: "Deine gespeicherten Karten wurden nicht geladen.",
    orAddHere: "oder füge hier eine hinzu.",
    addHereOrMenta: "Füge hier eine hinzu oder gib auf Menta frei.",
    approve: "{amount} freigeben",
    approving: "Wird freigegeben…",
    waitingCheck: "Warte auf die Prüfung deiner Karte…",
    confirming: "Wird mit deiner Karte bestätigt…",
    approved: "Freigegeben",
    expires: "Gültig bis {date}",
    noRail:
      "Diese Karte kann noch nicht für Agentenzahlungen genutzt werden. Versuch eine andere Karte.",
    visaRefused:
      "Visa hat diesen Shop für Agentenzahlungen nicht akzeptiert. Versuch eine andere Karte.",
    mastercardRefused:
      "Mastercard hat diesen Shop für Agentenzahlungen nicht akzeptiert. Versuch eine andere Karte.",
    expired:
      "Diese Freigabe ist abgelaufen. Bitte deinen Assistenten, es noch einmal zu versuchen.",
    create:
      "Die Zahlung mit dieser Karte konnte nicht gestartet werden. Versuch es noch einmal.",
    register:
      "Diese Karte konnte nicht für Agentenzahlungen eingerichtet werden. Versuch es noch einmal.",
    check:
      "Die Kartenprüfung hat nicht geklappt. Versuch es noch einmal oder nimm eine andere Karte.",
    slow: "Deine Karte hat noch nicht bestätigt. Versuch es gleich noch einmal.",
    notRevoked:
      "Dieses Ausgabenlimit konnte nicht storniert werden. Widerrufe es unter Ausgabenlimits auf Menta.",
  },
  secure: {
    signInTitle: "Bei {store} anmelden",
    signInLine:
      "{store} bittet dich, dich anzumelden, um die Bestellung fortzusetzen.",
    newPasswordTitle: "Dein Passwort für {store} erstellen",
    codeTitle: "Gib den Code von {store} ein",
    codeLine: "Schau in deine E-Mails oder auf dein Handy.",
    detailsTitle: "{store} braucht ein paar private Angaben",
    fillOnMenta: "Auf Menta ausfüllen",
    fillOnMentaNote:
      "Gib es sicher auf Menta ein. Es geht direkt an den Shop, und dein Assistent sieht es nie.",
    loading: "Sicheres Formular von Crossmint wird geladen…",
    notReady: "Das sichere Feld ist noch nicht bereit.",
  },
  header: {
    more: "weitere",
    moreLabel: "Nächsten Checkout anzeigen ({count} weitere)",
    watchLive: "Live ansehen",
    watching: "Du schaust zu",
    closeLiveView: "Live-Ansicht schließen",
    cancelCheckout: "Checkout abbrechen",
  },
  card: {
    noCheckout: "Kein Checkout",
    waiting: "Warte auf den Checkout…",
    connecting: "Verbindung zur App…",
    onlyInHosts: "Diese Ansicht zeigt Checkouts in ChatGPT oder Claude.",
    nothingToShow:
      "Hier gibt es keinen Checkout zu zeigen. Frag im Chat nach dem Status.",
    whichAddress: "An welche Adresse soll es gehen? Antworte im Chat.",
    whereTo: "Wohin soll es gehen? Antworte im Chat.",
    didntStart: "Nicht gestartet: {reason}",
    cantShow:
      "Menta konnte diesen Checkout hier nicht anzeigen. Frag im Chat nach dem Status.",
    cantRefresh: "Aktualisieren gerade nicht möglich. Neuer Versuch läuft.",
    couldntSend:
      "Senden fehlgeschlagen. Versuch es noch einmal oder antworte im Chat.",
    answerFailed: "Diese Antwort kam nicht durch. Hier ist der neueste Stand.",
    somethingWrong: "Etwas ist schiefgelaufen. Versuch es noch einmal.",
    pausedUpdates: "Updates pausiert.",
    checkAgain: "Erneut prüfen",
    backToChat: "Zurück zum Chat",
    backInChat: "Zurück im Chat",
  },
};
