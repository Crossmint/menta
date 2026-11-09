import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Pomoc",
    description:
      "Jak dodać Mentę do asystenta, jak przebiega zakup i gdzie znajdziesz karty, adresy i zamówienia.",
  },
  title: "Pomoc Menty",
  lede: "Menta to wtyczka do ChatGPT, Claude, Grok Bot i innych asystentów. Powiedz asystentowi, co kupić, a Menta sfinalizuje zakup za ciebie w sklepach internetowych na całym świecie, dzięki Crossmint Agent Checkouts.",
  install: {
    title: "Dodaj Mentę do asystenta",
    lede: "Wybierz asystenta. Gdy poprosi, zaloguj się do Menty i zezwól na dostęp.",
    server: "Adres URL serwera",
    listed:
      "Gdy Menta pojawi się w {directory}, dodaj ją stamtąd. Do tego czasu dodaj ją samodzielnie:",
    chatgptDirectory: "katalogu wtyczek ChatGPT",
    claudeDirectory: "katalogu konektorów Claude",
    grokBot:
      "Gdy Menta pojawi się w Marketplace Grok Bota, otwórz Marketplace, dodaj Mentę i zaloguj się.",
    signIn: "zaloguj się do Menty i zezwól na dostęp.",
    otherApp: "Inna aplikacja",
    example:
      "Kup na Amazonie 4 baterie AA za mniej niż 60 zł, z dostawą do domu.",
    apps: {
      chatgpt: [
        "Otwórz {plugins} i wybierz {add}. Nie widzisz tej opcji? Najpierw włącz Developer mode w ustawieniach.",
        "Nazwij go Menta, wklej adres URL i wybierz {oauth}.",
        "Wybierz {create}, a potem {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Otwórz {connectors} i wybierz {add}.",
        "Nazwij go Menta i wklej adres URL dokładnie, bez ukośnika na końcu.",
        "Zostaw logowanie wykryte przez Claude, wybierz {confirm}, a potem {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Znajdź w swojej aplikacji miejsce, gdzie dodaje się serwery MCP lub konektory (często nazywane własnymi konektorami albo integracjami).",
        "Dodaj zdalny serwer HTTP z powyższym adresem URL. Logowanie odbywa się przez OAuth, więc pole klucza API zostaw puste.",
        "Gdy pojawi się prośba, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Jak przebiega zakup",
    steps: [
      {
        title: "Powiedz, co kupić",
        text: "Powiedz asystentowi, czego chcesz i gdzie, na przykład: „{example}”",
      },
      {
        title: "Menta składa zamówienie",
        text: "Menta rozpoczyna zakup w sklepie i pokazuje ci jego postęp.",
      },
      {
        title: "Odpowiedz sklepowi",
        text: "Jeśli sklep czegoś od ciebie potrzebuje, na przykład rozmiaru albo godziny dostawy, asystent zapyta, a ty odpowiesz.",
      },
      {
        title: "Zatwierdź limit wydatków",
        text: "Gdy sklep jest gotowy pobrać płatność, Menta płaci w ramach zatwierdzonego przez ciebie limitu wydatków, jeśli któryś pokrywa kwotę. Jeśli żaden nie pokrywa, zatwierdzasz go sam w bezpiecznym formularzu Crossmint, w asystencie lub na stronie Menta. Nic nie zostanie zapłacone ponad twoje limity.",
      },
    ],
    never:
      "Twój asystent nigdy nie może zatwierdzić ani podnieść limitu wydatków. Numery kart, kody weryfikacyjne i hasła nigdy nie trafiają do czatu: gdy któryś jest potrzebny, wpisujesz go w bezpiecznym formularzu Crossmint.",
  },
  saved: {
    title: "Karty i adresy",
    cards:
      "Crossmint zapisuje twoje karty na twoim koncie Menty. Dodawaj je i zarządzaj nimi w sekcji {wallet}. Asystent widzi tylko markę karty i ostatnie 4 cyfry.",
    addresses:
      "Twoje adresy dostawy są zapisane w sekcji {addresses}. Asystent odczytuje je tylko wtedy, gdy to potrzebne: nazwę i miasto adresu domyślnego, żeby powiedzieć, dokąd trafiają dostawy, a resztę, gdy poprosisz o to ty albo sklep.",
    signIn: "Obie strony wymagają zalogowania się do Menty.",
  },
  orders: {
    title: "Sprawdzanie lub anulowanie zamówienia",
    text: "Zapytaj asystenta, jak idzie zakup, albo poproś go o anulowanie. Wszystko, co Menta dla ciebie kupiła, z dowolnego asystenta, znajdziesz w sekcji {transactions}.",
    store:
      "Zamówienia są w sklepie na twoje nazwisko, więc po złożeniu zamówienia zmiany i zwroty załatwiasz ze sklepem.",
  },
  limits: {
    title: "Czego Menta nie potrafi",
    items: [
      "Niektóre sklepy blokują zautomatyzowane przeglądarki, więc Menta nie może w nich kupować.",
      "Menta kupuje produkty fizyczne i składa zamówienia w sklepach internetowych, z dostawą lub do odbioru.",
      "Menta płaci tylko zapisaną przez ciebie kartą i tylko w ramach zatwierdzonego przez ciebie limitu wydatków.",
    ],
  },
  contact: {
    title: "Prywatność, regulamin i pomoc",
    text: "Mentę tworzy Crossmint. Jeśli potrzebujesz pomocy, napisz na {email} albo oznacz {x} na X.",
  },
  legal: {
    terms: "Regulamin",
    privacy: "Polityka prywatności",
    englishOnly: "Ten dokument jest dostępny tylko po angielsku.",
    agree: "Kontynuując, akceptujesz {terms} i {privacy} Menty.",
    agreeTerms: "regulamin",
    agreePrivacy: "politykę prywatności",
  },
} satisfies typeof en;
