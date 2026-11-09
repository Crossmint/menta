import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Hilfe",
    description:
      "So fügst du Menta zu deinem Assistenten hinzu, so läuft ein Kauf ab, und hier findest du deine Karten, Adressen und Bestellungen.",
  },
  title: "Menta-Hilfe",
  lede: "Menta ist ein Plugin für ChatGPT, Claude, Grok Bot und andere Assistenten. Sag deinem Assistenten, was du kaufen möchtest, und Menta erledigt den Checkout für dich in Onlineshops weltweit, mit Crossmint Agent Checkouts.",
  install: {
    title: "Füge Menta zu deinem Assistenten hinzu",
    lede: "Wähle deinen Assistenten. Wenn er fragt, melde dich bei Menta an und erlaube den Zugriff.",
    server: "Server-URL",
    listed:
      "Sobald Menta im {directory} gelistet ist, füge es dort hinzu. Bis dahin fügst du es selbst hinzu:",
    chatgptDirectory: "Plugin-Verzeichnis von ChatGPT",
    claudeDirectory: "Connector-Verzeichnis von Claude",
    grokBot:
      "Sobald Menta im Marketplace von Grok Bot ist, öffne den Marketplace, füge Menta hinzu und melde dich an.",
    signIn: "melde dich bei Menta an und erlaube den Zugriff.",
    otherApp: "Andere App",
    example:
      "Kauf mir eine 4er-Packung AA-Batterien bei Amazon, unter 15 €, Lieferung nach Hause.",
    apps: {
      chatgpt: [
        "Öffne {plugins} und wähle {add}. Nicht da? Schalte zuerst in den Einstellungen den Entwicklermodus ein.",
        "Nenn es Menta, füge die URL ein und wähle {oauth}.",
        "Wähle {create}, dann {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Öffne {connectors} und wähle {add}.",
        "Nenn ihn Menta und füge die URL genau so ein, ohne Schrägstrich am Ende.",
        "Behalte die Anmeldung, die Claude erkennt, wähle {confirm}, dann {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Such die Stelle, an der deine App MCP-Server oder Connectors hinzufügt (oft „benutzerdefinierte Connectors“ oder „Integrationen“ genannt).",
        "Füge einen Remote-HTTP-Server mit der URL von oben hinzu. Die Anmeldung läuft über OAuth, lass ein API-Key-Feld also leer.",
        "Wenn du gefragt wirst, {signIn}",
      ],
    },
  },
  purchase: {
    title: "So läuft ein Kauf ab",
    steps: [
      {
        title: "Sag, was du kaufen möchtest",
        text: "Sag deinem Assistenten, was du willst und wo, zum Beispiel: „{example}“",
      },
      {
        title: "Menta bestellt",
        text: "Menta startet den Checkout im Shop und zeigt dir, wie weit er ist.",
      },
      {
        title: "Antworte dem Shop",
        text: "Braucht der Shop etwas von dir, etwa eine Größe oder eine Lieferzeit, fragt dein Assistent nach und du antwortest.",
      },
      {
        title: "Gib ein Ausgabenlimit frei",
        text: "Ist der Shop bereit abzubuchen, zahlt Menta mit einem von dir freigegebenen Ausgabenlimit, sofern eines den Betrag abdeckt. Deckt keines ihn ab, gibst du selbst eines frei, im sicheren Formular von Crossmint, in deinem Assistenten oder auf einer Menta-Seite. Über deine Limits hinaus wird nichts bezahlt.",
      },
    ],
    never:
      "Dein Assistent kann nie ein Ausgabenlimit freigeben oder erhöhen. Kartennummern, Bestätigungscodes und Passwörter laufen nie über den Chat: Wenn eines davon nötig ist, gibst du es im sicheren Formular von Crossmint ein.",
  },
  saved: {
    title: "Karten und Adressen",
    cards:
      "Crossmint speichert deine Karten in deinem Menta-Konto. Füge sie unter {wallet} hinzu und verwalte sie dort. Dein Assistent sieht nur die Marke und die letzten 4 Ziffern einer Karte.",
    addresses:
      "Deine Lieferadressen sind unter {addresses} gespeichert. Dein Assistent liest sie nur bei Bedarf: Name und Ort deiner Standardadresse, um zu sagen, wohin geliefert wird, und den Rest, wenn du oder ein Shop danach fragt.",
    signIn: "Für beide Seiten meldest du dich bei Menta an.",
  },
  orders: {
    title: "Eine Bestellung prüfen oder stornieren",
    text: "Frag deinen Assistenten, wie ein Checkout läuft, oder bitte ihn, einen zu stornieren. Alles, was Menta für dich gekauft hat, über jeden Assistenten, findest du unter {transactions}.",
    store:
      "Bestellungen laufen im Shop auf deinen Namen. Nach der Bestellung klärst du Änderungen und Rücksendungen also mit dem Shop.",
  },
  limits: {
    title: "Was Menta nicht kann",
    items: [
      "Manche Shops blockieren automatisierte Browser, dort kann Menta nicht bestellen.",
      "Menta kauft physische Waren und gibt Bestellungen in Onlineshops auf, geliefert zu dir oder zur Abholung bereit.",
      "Menta bezahlt nur mit einer Karte, die du gespeichert hast, und nur innerhalb eines Ausgabenlimits, das du freigegeben hast.",
    ],
  },
  contact: {
    title: "Datenschutz, Bedingungen und Support",
    text: "Menta wird von Crossmint entwickelt. Wenn du Hilfe brauchst, schreib an {email} oder erwähne {x} auf X.",
  },
  legal: {
    terms: "Nutzungsbedingungen",
    privacy: "Datenschutzerklärung",
    englishOnly: "Dieses Dokument gibt es nur auf Englisch.",
    agree:
      "Wenn du fortfährst, stimmst du den {terms} und der {privacy} von Menta zu.",
    agreeTerms: "Nutzungsbedingungen",
    agreePrivacy: "Datenschutzerklärung",
  },
} satisfies typeof en;
