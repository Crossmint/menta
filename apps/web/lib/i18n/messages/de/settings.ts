import type en from "../en/settings";

/** Settings and the pages that came out of it: account, addresses, cards, connected agents and notifications. */
export default {
  loading: "Wird geladen…",
  account: {
    signOut: "Abmelden",
    signingOut: "Wird abgemeldet…",
    storeSignIns: "Shop-Anmeldungen",
    storesRemember: "Shops erinnern sich an dich",
    storesRememberNote:
      "Checkouts nutzen Anmeldungen und Cookies aus früheren Checkouts erneut.",
    noStoreSignIns: "Keine gespeicherten Shop-Anmeldungen",
    noStoreSignInsNote:
      "Wenn du dich während eines Checkouts bei einem Shop anmeldest, bleibt der nächste Checkout angemeldet.",
    signOutStores: "Von allen Shops abmelden",
    updateFailed:
      "Shop-Anmeldungen konnten nicht aktualisiert werden. Versuch es noch einmal.",
  },
  addresses: {
    title: "Adressen",
    first: "Füge deine erste Adresse hinzu",
    label: "Bezeichnung",
    labelPlaceholder: "Zuhause, Arbeit, Mama…",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    phone: "Telefon (optional)",
    address: "Adresse",
    address2: "Wohnung, Etage usw. (optional)",
    city: "Stadt",
    defaultForMe: "Standard für meine Lieferungen",
    cancel: "Abbrechen",
    save: "Speichern",
    default: "Standard",
    makeDefault: "Als Standard festlegen",
    removeDefault: "Nicht mehr Standard",
    edit: "Bearbeiten",
    editNamed: "{label} bearbeiten",
    delete: "Löschen",
    moreNamed: "Mehr für {label}",
    deleteTitle: "{label} löschen?",
    deleteText: "Du kannst diese Adresse jederzeit wieder hinzufügen.",
    deleting: "Wird gelöscht…",
    defaultFailed:
      "Der Standard konnte nicht geändert werden. Versuch es noch einmal.",
    deleteFailed:
      "{label} konnte nicht gelöscht werden. Versuch es noch einmal.",
    loadFailed:
      "Deine Adressen konnten nicht geladen werden. Lade die Seite neu, um es noch einmal zu versuchen.",
    empty:
      "Füge hinzu, wohin Bestellungen geliefert werden sollen. Checkouts tragen sie für dich ein.",
    add: "Adresse hinzufügen",
    defaultNote:
      "Lieferungen gehen an deine Standardadresse, außer du nennst eine andere, etwa „schick es an Arbeit“.",
    step: "Schritt {n} von {total}",
    stepAddress: "Adresse",
    stepContact: "Kontakt",
    continue: "Weiter",
    back: "Zurück",
  },
  addressForm: {
    country: "Land",
    phoneCountry: "Ländervorwahl",
    invalidPhone: "Gib eine gültige Telefonnummer ein.",
  },
  cardManager: {
    unavailable:
      "Crossmint ist gerade nicht erreichbar. Aktualisiere die Seite, um es noch einmal zu versuchen.",
    connecting: "Verbindung zu Crossmint…",
    loadingCards: "Deine Karten werden geladen…",
    remove: "Entfernen",
    removeCard: "Karte entfernen",
    removeTitle: "{card} entfernen?",
    removeText:
      "Menta kann erst wieder damit zahlen, wenn du sie erneut hinzufügst.",
    removing: "Wird entfernt…",
    removeFailed:
      "{card} konnte nicht entfernt werden. Versuch es noch einmal.",
    loadFailed: "Deine gespeicherten Karten wurden nicht geladen.",
    tryAgain: "Erneut versuchen",
    first: "Füge deine erste Karte hinzu",
    firstNote:
      "Menta zahlt mit deiner eigenen Karte, so behältst du deine Prämien. Crossmint speichert sie, und dein Agent sieht sie nie.",
    choose: "Karte auswählen",
    add: "Karte hinzufügen",
    cancel: "Abbrechen",
    save: "Karte speichern",
    saving: "Wird gespeichert…",
    default: "Standard",
    open: "{card} öffnen",
    close: "Karte schließen",
    cardName: "Kartenname",
    rename: "Karte umbenennen",
    renameFailed:
      "Die Karte konnte nicht umbenannt werden. Versuche es erneut.",
    setDefault: "Als Standard festlegen",
    defaultFailed:
      "Die Karte konnte nicht als Standard festgelegt werden. Versuche es erneut.",
    updateCvc: "Sicherheitscode aktualisieren",
    cvcDone: "Sicherheitscode aktualisiert.",
    cvcFailed:
      "Der Sicherheitscode konnte nicht aktualisiert werden. Versuche es später erneut.",
    limits: "Ausgabenlimits",
  },
  connections: {
    title: "Verbundene Agenten",
    loadFailed: "Verbundene Apps konnten nicht geladen werden.",
    disconnect: "Trennen",
    confirmTitle: "{name} trennen?",
    confirmText:
      "{name} kann erst wieder mit Menta einkaufen, wenn du ihn erneut verbindest.",
    cancel: "Abbrechen",
    disconnecting: "Wird getrennt…",
    updateFailed:
      "Verbundene Apps konnten nicht aktualisiert werden. Versuch es noch einmal.",
  },
  notifications: {
    loadFailed: "Benachrichtigungen konnten nicht geladen werden.",
    updateFailed: "Benachrichtigungen konnten nicht aktualisiert werden.",
    testFailed: "Der Test konnte nicht gesendet werden.",
    unsupported:
      "In diesem Browser nicht unterstützt. Auf dem iPhone oder iPad füge Menta zuerst zum Home-Bildschirm hinzu.",
    couldntLoad: "Konnte nicht geladen werden.",
    unavailable: "Gerade nicht verfügbar.",
    blocked:
      "Blockiert. Erlaube Benachrichtigungen in den Website-Einstellungen deines Browsers.",
    on: "An für diesen Browser",
    reconnect: "In diesem Browser neu verbinden",
    off: "Aus",
    thisBrowser: "Dieser Browser",
    sendTest: "Test senden",
    turnOff: "Ausschalten",
    switchLabel: "Benachrichtigungen in diesem Browser",
    testSent:
      "Test gesendet. Schau in die Benachrichtigungen deines Computers.",
    retry: "Erneut versuchen",
  },
  grokBot: {
    copied: "Kopiert",
    copy: "Kopieren",
    copyInstruction: "Anweisung kopieren",
    pasteIntro: "Füge dann ein, was das Routine-Panel von Grok Bot anzeigt.",
    webhookUrl: "Webhook-URL",
    key: "Schlüssel",
    keyPlaceholder: "Webhook-Schlüssel oder Authorization-Header",
    saveFailed: "Speichern fehlgeschlagen. Versuch es noch einmal.",
    saving: "Wird gespeichert…",
    save: "Speichern",
    cancel: "Abbrechen",
    savingSendsTest: "Beim Speichern wird ein Test gesendet.",
    byHand: "Manuell einrichten",
    hideSteps: "Schritte ausblenden",
    steps: {
      create: "Erstelle in Grok Bot eine Routine mit dieser Anweisung.",
      trigger:
        "Bitte den Bot, ihr einen {trigger} hinzuzufügen, und öffne dann das Panel der Routine.",
      triggerName: "Webhook-Trigger",
      paste:
        "Füge oben ihre {url} und ihren {key} ein und tippe auf Speichern.",
      url: "Webhook URL",
      key: "Webhook key",
    },
    keyUnreadable:
      "Der gespeicherte Schlüssel ist nicht mehr lesbar. Füge URL und Schlüssel erneut ein.",
    loadFailed: "Konnte nicht geladen werden.",
    notSetUp: "Nicht eingerichtet",
    status: "Schlüssel …{hint} · {delivery}",
    statusPaused: "Pausiert · Schlüssel …{hint} · {delivery}",
    sending: "Wird gesendet…",
    sendTest: "Test senden",
    remove: "Entfernen",
    removing: "Wird entfernt…",
    switchLabel: "Updates über Grok Bot",
    setUp: "Einrichten",
    replace: "URL und Schlüssel ersetzen",
    say: "Sag in Grok Bot:",
    updateFailed:
      "Updates über Grok Bot konnten nicht geändert werden. Versuch es noch einmal.",
    explainer:
      "Grok Bot sagt dir dann auf Computer und Handy Bescheid, wenn ein Checkout dich braucht oder fertig ist. Der Schlüssel wird verschlüsselt gespeichert und nie wieder angezeigt, und jedes Update startet einen Durchlauf der Routine in Grok Bot.",
    setUpTitle: "Grok Bot-Updates einrichten",
    removeTitle: "Grok Bot-Updates entfernen?",
    removeText:
      "Grok Bot erfährt nicht mehr, wenn ein Checkout dich braucht. Du kannst es jederzeit neu einrichten.",
  },
} satisfies typeof en;
