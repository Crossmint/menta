import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Zaloguj się",
    heading: "Zaloguj się do Menta",
    lede: "Pierwszy raz? Logowanie od razu tworzy konto.",
    arrivals: {
      checkout: {
        kicker: "Zakup czeka na ciebie",
        title: "Zaloguj się, aby kontynuować",
        lede: "Asystent przysłał cię tu w jednej sprawie. Szczegóły zobaczysz po zalogowaniu na konto, z którego rozpoczęto zakup.",
        footer:
          "Zatwierdzaj płatności tylko w Mencie. Nigdy nie wpisuj danych karty na czacie.",
      },
      connect: {
        kicker: "Asystent chce się połączyć",
        title: "Zaloguj się, aby połączyć",
        lede: "Zaloguj się, a potem zdecyduj, czy asystent może robić zakupy przez Mentę.",
        ledeNamed:
          "Zaloguj się, a potem zdecyduj, czy {name} może robić zakupy przez Mentę.",
        footer:
          "Każdy limit wydatków zatwierdzasz tutaj, nigdy w czacie asystenta.",
      },
    },
    googleFailed: "Logowanie przez Google nie powiodło się. Spróbuj ponownie.",
    invalidEmail: "Wpisz prawidłowy adres e-mail.",
    sendFailed: "Nie udało się wysłać kodu. Spróbuj ponownie.",
    codeFailed: "Ten kod nie działa. Spróbuj ponownie lub poproś o nowy.",
    checkEmail: "Sprawdź pocztę",
    codeSent: "Wpisz kod, który wysłaliśmy na {email}.",
    google: "Kontynuuj z Google",
    continueEmail: "Kontynuuj przez e-mail",
    or: "lub",
    email: "E-mail",
    code: "Kod",
    emailPlaceholder: "Twój e-mail",
    openInbox: "Otwórz {provider}",
    sendCode: "Wyślij kod",
    signIn: "Zaloguj się",
    differentEmail: "Użyj innego adresu",
    resend: "Wyślij nowy kod",
    resendIn: "Wyślij nowy kod za {seconds} s",
    codeResent: "Wysłaliśmy nowy kod na {email}.",
    password: "Hasło",
    passwordFailed: "To hasło nie zadziałało. Spróbuj ponownie.",
  },
  authorize: {
    title: "Zezwól na dostęp",
    can: [
      "Rozpoczynać zakupy do ustalonego przez ciebie limitu",
      "Widzieć status i potwierdzenia",
      "Anulować zakup, gdy o to poprosisz",
    ],
    cannot: [
      "Zatwierdzać płatności",
      "Widzieć numerów kart ani kodów",
      "Zmieniać twoich kart",
    ],
    offline: "Nie możemy połączyć się z Mentą. Sprawdź połączenie.",
    failed: "Coś poszło nie tak. Spróbuj ponownie z poziomu asystenta.",
    cantConnect: "Nie można teraz połączyć",
    returning: "Wracasz do asystenta…",
    checking: "Sprawdzamy prośbę…",
    thisAssistant: "Ten asystent",
    heading: "{name} chce korzystać z Menty. Zezwolić?",
    signedInAs: "Zalogowano jako {email} · ",
    notYou: "To nie ty?",
    itCan: "Może",
    itCant: "Nie może",
    ungrantable:
      "Twoje konto nie może przyznać uprawnień {scopes}, więc {name} może nie działać w pełni.",
    cancel: "Anuluj",
    allow: "Zezwól",
    returnsTo:
      "Wrócisz do {returnsTo}. Asystenta możesz odłączyć w każdej chwili w zakładce {connections}.",
    connections: "Połączenia",
  },
  notFound: {
    title: "Nie znaleziono strony",
    lede: "Ta strona nie istnieje albo została przeniesiona.",
    home: "Przejdź do Menty",
  },
  codeEmail: {
    subject: "Twój kod logowania do Menta",
    heading: "Twój kod logowania",
    enter: "Wpisz ten kod w Mencie, aby się zalogować.",
    label: "Kod weryfikacyjny",
    expires: "Wygaśnie za {minutes} minut.",
    share: "Nie udostępniaj go nikomu, nawet swojemu asystentowi.",
    ignore: "Jeśli to nie Ty próbujesz się zalogować, zignoruj tę wiadomość.",
  },
} satisfies typeof en;
