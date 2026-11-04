import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Hjälp",
    description:
      "Så lägger du till Menta i din assistent, så fungerar ett köp och här hittar du dina kort, adresser och beställningar.",
  },
  title: "Hjälp för Menta",
  lede: "Menta är ett plugin för ChatGPT, Claude, Grok Bot och andra assistenter. Säg till din assistent vad du vill köpa, så går Menta till kassan åt dig i webbutiker över hela världen, via Crossmint Agent Checkouts.",
  install: {
    title: "Lägg till Menta i din assistent",
    lede: "Välj din assistent. När den ber dig, logga in på Menta och ge åtkomst.",
    server: "Serverns URL",
    listed:
      "När Menta finns i {directory} lägger du till det därifrån. Tills dess lägger du till det själv:",
    chatgptDirectory: "ChatGPT:s pluginkatalog",
    claudeDirectory: "Claudes katalog över connectors",
    grokBot:
      "När Menta finns i Grok Bots Marketplace öppnar du Marketplace, lägger till Menta och loggar in.",
    signIn: "logga in på Menta och ge åtkomst.",
    otherApp: "Annan app",
    example:
      "Köp ett 4-pack AA-batterier på Amazon, under 150 kr, levererat hem.",
    apps: {
      chatgpt: [
        "Öppna {plugins} och välj {add}. Finns det inte där? Slå först på utvecklarläget i Inställningar.",
        "Döp det till Menta, klistra in URL:en och välj {oauth}.",
        "Välj {create}, sedan {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Öppna {connectors} och välj {add}.",
        "Döp den till Menta och klistra in URL:en exakt som den är, utan snedstreck på slutet.",
        "Behåll inloggningen som Claude hittar, välj {confirm}, sedan {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Leta upp var din app lägger till MCP-servrar eller connectors (kallas ofta anpassade connectors eller integrationer).",
        "Lägg till en HTTP-fjärrserver med URL:en ovan. Inloggningen sker med OAuth, så lämna eventuella fält för API-nyckel tomma.",
        "När du blir tillfrågad: {signIn}",
      ],
    },
  },
  purchase: {
    title: "Så fungerar ett köp",
    steps: [
      {
        title: "Säg vad du vill köpa",
        text: "Berätta för din assistent vad du vill ha och var, till exempel: ”{example}”",
      },
      {
        title: "Menta går till kassan",
        text: "Menta startar ett köp i butiken och visar hur det går.",
      },
      {
        title: "Svara butiken",
        text: "Om butiken behöver något av dig, som en storlek eller en leveranstid, frågar din assistent och du svarar.",
      },
      {
        title: "Godkänn en utgiftsgräns",
        text: "När butiken är redo att debitera betalar Menta med en utgiftsgräns du har godkänt, om någon täcker beloppet. Gör ingen det godkänner du en själv i Crossmints säkra formulär, i din assistent eller på en Menta-sida. Inget betalas utöver dina gränser.",
      },
    ],
    never:
      "Din assistent kan aldrig godkänna eller höja en utgiftsgräns. Kortnummer, verifieringskoder och lösenord går aldrig via chatten: när något sådant behövs skriver du det i Crossmints säkra formulär.",
  },
  saved: {
    title: "Kort och adresser",
    cards:
      "Crossmint sparar dina kort på ditt Menta-konto. Lägg till och hantera dem under {wallet}. Din assistent ser bara kortets märke och de 4 sista siffrorna.",
    addresses:
      "Dina leveransadresser sparas under {addresses}. Din assistent läser dem bara när det behövs: namnet och orten för din standardadress för att säga vart leveranser går, och resten när du eller en butik ber om det.",
    signIn: "Båda sidorna kräver att du loggar in på Menta.",
  },
  orders: {
    title: "Kolla eller avbryta en beställning",
    text: "Fråga din assistent hur ett köp går, eller be den avbryta det. Allt Menta har köpt åt dig, från vilken assistent som helst, finns under {transactions}.",
    store:
      "Beställningar står i ditt namn hos butiken, så när en beställning är lagd sköter du ändringar och returer med butiken.",
  },
  limits: {
    title: "Det här kan Menta inte göra",
    items: [
      "Vissa butiker blockerar automatiserade webbläsare, så där kan Menta inte handla.",
      "Menta köper fysiska varor och lägger beställningar i webbutiker, med leverans eller för upphämtning.",
      "Menta betalar bara med ett kort du har sparat, och bara inom en utgiftsgräns du har godkänt.",
    ],
  },
  contact: {
    title: "Integritet, villkor och support",
    text: "Menta är gjort av Crossmint. Behöver du hjälp kan du mejla {email} eller tagga {x} på X.",
  },
  legal: {
    terms: "Användarvillkor",
    privacy: "Integritetspolicy",
    englishOnly: "Det här dokumentet finns bara på engelska.",
    agree: "Genom att fortsätta godkänner du Mentas {terms} och {privacy}.",
    agreeTerms: "användarvillkor",
    agreePrivacy: "integritetspolicy",
  },
} satisfies typeof en;
