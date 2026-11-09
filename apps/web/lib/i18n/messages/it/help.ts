import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Aiuto",
    description:
      "Come aggiungere Menta al tuo assistente, come funziona un acquisto e dove trovi carte, indirizzi e ordini.",
  },
  title: "Aiuto di Menta",
  lede: "Menta è un plugin per ChatGPT, Claude, Grok Bot e altri assistenti. Di' al tuo assistente cosa comprare e Menta completa l'acquisto per te nei negozi online di tutto il mondo, con Crossmint Agent Checkouts.",
  install: {
    title: "Aggiungi Menta al tuo assistente",
    lede: "Scegli il tuo assistente. Quando te lo chiede, accedi a Menta e consenti l'accesso.",
    server: "URL del server",
    listed:
      "Quando Menta sarà nella {directory}, aggiungilo da lì. Nel frattempo, aggiungilo tu:",
    chatgptDirectory: "directory dei plugin di ChatGPT",
    claudeDirectory: "directory dei connettori di Claude",
    grokBot:
      "Quando Menta sarà nel Marketplace di Grok Bot, apri il Marketplace, aggiungi Menta e accedi.",
    signIn: "accedi a Menta e consenti l'accesso.",
    otherApp: "Altra app",
    example:
      "Compra una confezione da 4 pile AA su Amazon, sotto i 15 dollari, con consegna a casa.",
    apps: {
      chatgpt: [
        "Apri {plugins} e scegli {add}. Non c'è? Attiva prima la modalità sviluppatore nelle impostazioni.",
        "Chiamalo Menta, incolla l'URL e scegli {oauth}.",
        "Scegli {create}, poi {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Apri {connectors} e scegli {add}.",
        "Chiamalo Menta e incolla l'URL esattamente così, senza barra finale.",
        "Mantieni l'accesso rilevato da Claude, scegli {confirm}, poi {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Trova dove la tua app aggiunge server MCP o connettori (spesso chiamati connettori personalizzati o integrazioni).",
        "Aggiungi un server HTTP remoto con l'URL qui sopra. L'accesso avviene tramite OAuth, quindi lascia vuoto qualsiasi campo per la chiave API.",
        "Quando richiesto, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Come funziona un acquisto",
    steps: [
      {
        title: "Di' cosa comprare",
        text: "Di' al tuo assistente cosa vuoi e dove, per esempio: “{example}”",
      },
      {
        title: "Menta completa l'acquisto",
        text: "Menta avvia l'acquisto nel negozio e ti mostra a che punto è.",
      },
      {
        title: "Rispondi al negozio",
        text: "Se al negozio serve qualcosa da te, come una taglia o un orario di consegna, il tuo assistente te lo chiede e tu rispondi.",
      },
      {
        title: "Autorizza un limite di spesa",
        text: "Quando il negozio è pronto ad addebitare, Menta paga con un limite di spesa che hai autorizzato, se ce n'è uno che copre l'importo. Altrimenti ne autorizzi uno tu stesso nel modulo sicuro di Crossmint, nel tuo assistente o in una pagina di Menta. Non viene pagato nulla oltre i tuoi limiti.",
      },
    ],
    never:
      "Il tuo assistente non può mai approvare né aumentare un limite di spesa. Numeri di carta, codici di verifica e password non passano mai dalla chat: quando ne serve uno, lo inserisci nel modulo sicuro di Crossmint.",
  },
  saved: {
    title: "Carte e indirizzi",
    cards:
      "Crossmint salva le tue carte nel tuo account Menta. Aggiungile e gestiscile in {wallet}. Il tuo assistente vede solo il circuito della carta e le ultime 4 cifre.",
    addresses:
      "I tuoi indirizzi di consegna sono salvati in {addresses}. Il tuo assistente li legge solo quando serve: nome e città del tuo indirizzo predefinito per dire dove arrivano le consegne, e il resto quando lo chiedi tu o un negozio.",
    signIn: "Entrambe le pagine ti chiedono di accedere a Menta.",
  },
  orders: {
    title: "Controllare o annullare un ordine",
    text: "Chiedi al tuo assistente a che punto è un acquisto, o chiedigli di annullarlo. Tutto quello che Menta ha comprato per te, da qualsiasi assistente, è in {transactions}.",
    store:
      "Gli ordini sono a tuo nome presso il negozio: dopo l'ordine, modifiche e resi passano dal negozio.",
  },
  limits: {
    title: "Cosa Menta non può fare",
    items: [
      "Alcuni negozi bloccano i browser automatizzati, quindi Menta non può acquistare lì.",
      "Menta compra prodotti fisici ed effettua ordini nei negozi online, con consegna o ritiro.",
      "Menta paga solo con una carta che hai salvato, e solo entro un limite di spesa che hai autorizzato.",
    ],
  },
  contact: {
    title: "Privacy, termini e assistenza",
    text: "Menta è realizzato da Crossmint. Per ricevere aiuto, scrivi a {email} o menziona {x} su X.",
  },
  legal: {
    terms: "Termini di servizio",
    privacy: "Informativa sulla privacy",
    englishOnly: "Questo documento è disponibile solo in inglese.",
    agree: "Continuando, accetti i {terms} e l'{privacy} di Menta.",
    agreeTerms: "termini di servizio",
    agreePrivacy: "informativa sulla privacy",
  },
} satisfies typeof en;
