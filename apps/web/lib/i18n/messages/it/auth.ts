import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Accedi",
    heading: "Accedi a Menta",
    lede: "Sei nuovo? Accedendo crei il tuo account.",
    arrivals: {
      checkout: {
        kicker: "Un acquisto ha bisogno di te",
        title: "Accedi per continuare",
        lede: "Il tuo assistente ti ha mandato qui per un solo passaggio. Vedrai i dettagli dopo aver effettuato l'accesso con l'account che ha avviato l'acquisto.",
        footer:
          "Approva i pagamenti solo su Menta. Non scrivere mai i dati della carta in una chat.",
      },
      connect: {
        kicker: "Un assistente vuole collegarsi",
        title: "Accedi per collegarlo",
        lede: "Accedi, poi scegli se lasciare che il tuo assistente faccia acquisti con Menta.",
        ledeNamed:
          "Accedi, poi scegli se lasciare che {name} faccia acquisti con Menta.",
        footer:
          "Ogni limite di spesa lo autorizzi qui, mai nella chat dell'assistente.",
      },
    },
    googleFailed: "L'accesso con Google non è stato completato. Riprova.",
    invalidEmail: "Inserisci un indirizzo email valido.",
    sendFailed: "Non siamo riusciti a inviare un codice. Riprova.",
    codeFailed:
      "Quel codice non ha funzionato. Riprova o richiedine uno nuovo.",
    checkEmail: "Controlla la tua email",
    codeSent: "Inserisci il codice che abbiamo inviato a {email}.",
    google: "Continua con Google",
    continueEmail: "Continua con l'email",
    or: "oppure",
    email: "Email",
    code: "Codice",
    emailPlaceholder: "La tua email",
    openInbox: "Apri {provider}",
    sendCode: "Invia codice",
    signIn: "Accedi",
    differentEmail: "Usa un'altra email",
    resend: "Invia un nuovo codice",
    resendIn: "Invia un nuovo codice tra {seconds} s",
    codeResent: "Abbiamo inviato un nuovo codice a {email}.",
    password: "Password",
    passwordFailed: "Quella password non ha funzionato. Riprova.",
  },
  authorize: {
    title: "Consenti l'accesso",
    can: [
      "Avviare acquisti fino al limite che imposti",
      "Vedere stato e ricevute",
      "Annullare un acquisto quando lo chiedi",
    ],
    cannot: [
      "Approvare pagamenti",
      "Vedere numeri di carta o codici",
      "Modificare le tue carte",
    ],
    offline: "Impossibile raggiungere Menta. Controlla la connessione.",
    failed: "Qualcosa è andato storto. Riprova dal tuo assistente.",
    cantConnect: "Impossibile collegarsi ora",
    returning: "Ritorno al tuo assistente…",
    checking: "Verifica della richiesta…",
    thisAssistant: "Questo assistente",
    heading: "Consentire a {name} di usare Menta?",
    signedInAs: "Accesso effettuato come {email} · ",
    notYou: "Non sei tu?",
    itCan: "Può",
    itCant: "Non può",
    ungrantable:
      "Il tuo account non può concedere {scopes}, quindi {name} potrebbe non funzionare del tutto.",
    cancel: "Annulla",
    allow: "Consenti",
    returnsTo:
      "Tornerai a {returnsTo}. Puoi scollegarlo in qualsiasi momento in {connections}.",
    connections: "Connessioni",
  },
  notFound: {
    title: "Pagina non trovata",
    lede: "Questa pagina non esiste o è stata spostata.",
    home: "Vai a Menta",
  },
  codeEmail: {
    subject: "Il tuo codice di accesso a Menta",
    heading: "Il tuo codice di accesso",
    enter: "Inserisci questo codice su Menta per accedere.",
    label: "Codice di verifica",
    expires: "Scade tra {minutes} minuti.",
    share: "Non condividerlo con nessuno, nemmeno con il tuo assistente.",
    ignore: "Non hai provato ad accedere? Puoi ignorare questa email.",
  },
} satisfies typeof en;
