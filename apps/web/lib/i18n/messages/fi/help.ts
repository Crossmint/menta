import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Ohje",
    description:
      "Näin lisäät Mentan avustajaasi, näin ostos etenee ja täältä löydät korttisi, osoitteesi ja tilauksesi.",
  },
  title: "Mentan ohje",
  lede: "Menta on lisäosa ChatGPT:lle, Claudelle, Grok Botille ja muille avustajille. Kerro avustajallesi, mitä haluat ostaa, niin Menta hoitaa kassan puolestasi verkkokaupoissa ympäri maailmaa Crossmint Agent Checkoutsin avulla.",
  install: {
    title: "Lisää Menta avustajaasi",
    lede: "Valitse avustajasi. Kun se pyytää, kirjaudu Mentaan ja salli käyttöoikeus.",
    server: "Palvelimen URL-osoite",
    listed:
      "Kun Menta löytyy {directory}, lisää se sieltä. Siihen asti lisää se itse:",
    chatgptDirectory: "ChatGPT:n lisäosahakemistosta",
    claudeDirectory: "Clauden liitinhakemistosta",
    grokBot:
      "Kun Menta on Grok Botin Marketplacessa, avaa Marketplace, lisää Menta ja kirjaudu sisään.",
    signIn: "kirjaudu Mentaan ja anna käyttöoikeus.",
    otherApp: "Muu sovellus",
    example:
      "Osta Amazonista neljän AA-pariston pakkaus alle 15 eurolla, toimitus kotiin.",
    apps: {
      chatgpt: [
        "Avaa {plugins} ja valitse {add}. Eikö sitä näy? Ota ensin kehittäjätila käyttöön asetuksista.",
        "Anna nimeksi Menta, liitä URL ja valitse {oauth}.",
        "Valitse {create}, sitten {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Avaa {connectors} ja valitse {add}.",
        "Anna nimeksi Menta ja liitä URL täsmälleen sellaisenaan, ilman kauttaviivaa lopussa.",
        "Pidä kirjautumistapa, jonka Claude tunnistaa, valitse {confirm}, sitten {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Etsi kohta, jossa sovelluksesi lisää MCP-palvelimia tai liittimiä (usein nimeltään ”mukautetut liittimet” tai ”integraatiot”).",
        "Lisää etä-HTTP-palvelin yllä olevalla URL-osoitteella. Kirjautuminen hoituu OAuthilla, joten jätä mahdollinen API-avaimen kenttä tyhjäksi.",
        "Kun sitä pyydetään, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Näin ostos etenee",
    steps: [
      {
        title: "Kerro, mitä ostaa",
        text: "Kerro avustajallesi, mitä haluat ja mistä, esimerkiksi: ”{example}”",
      },
      {
        title: "Menta hoitaa kassan",
        text: "Menta aloittaa ostoksen kaupassa ja näyttää, miten se etenee.",
      },
      {
        title: "Vastaa kaupalle",
        text: "Jos kauppa tarvitsee sinulta jotain, kuten koon tai toimitusajan, avustajasi kysyy ja sinä vastaat.",
      },
      {
        title: "Hyväksy kuluraja",
        text: "Kun kauppa on valmis veloittamaan, Menta maksaa hyväksymäsi kulurajan puitteissa, jos jokin niistä kattaa summan. Jos mikään ei kata, hyväksyt sellaisen itse Crossmintin suojatussa lomakkeessa avustajassasi tai Mentan sivulla. Mitään ei makseta rajojesi yli.",
      },
    ],
    never:
      "Avustajasi ei voi koskaan hyväksyä tai nostaa kulurajaa. Korttinumerot, vahvistuskoodit ja salasanat eivät koskaan kulje chatin kautta: kun sellaista tarvitaan, kirjoitat sen Crossmintin suojattuun lomakkeeseen.",
  },
  saved: {
    title: "Kortit ja osoitteet",
    cards:
      "Crossmint tallentaa korttisi Menta-tilillesi. Lisää ja hallinnoi niitä kohdassa {wallet}. Avustajasi näkee vain kortin merkin ja 4 viimeistä numeroa.",
    addresses:
      "Toimitusosoitteesi on tallennettu kohtaan {addresses}. Avustajasi lukee niitä vain tarvittaessa: oletusosoitteesi nimen ja kaupungin kertoakseen, minne toimitukset menevät, ja loput, kun sinä tai kauppa pyydätte niitä.",
    signIn: "Molemmat sivut pyytävät sinua kirjautumaan Mentaan.",
  },
  orders: {
    title: "Tilauksen tarkistaminen tai peruminen",
    text: "Kysy avustajaltasi, miten ostos etenee, tai pyydä sitä perumaan se. Kaikki, mitä Menta on ostanut puolestasi mistä tahansa avustajasta, löytyy kohdasta {transactions}.",
    store:
      "Tilaukset ovat kaupassa sinun nimissäsi, joten kun tilaus on tehty, muutokset ja palautukset hoidetaan kaupan kanssa.",
  },
  limits: {
    title: "Mitä Menta ei osaa",
    items: [
      "Jotkin kaupat estävät automatisoidut selaimet, joten niissä Menta ei voi asioida.",
      "Menta ostaa fyysisiä tuotteita ja tekee tilauksia verkkokaupoissa, toimitettuna tai noudettavaksi.",
      "Menta maksaa vain tallentamallasi kortilla ja vain hyväksymäsi kulurajan puitteissa.",
    ],
  },
  contact: {
    title: "Tietosuoja, ehdot ja tuki",
    text: "Mentan on tehnyt Crossmint. Jos tarvitset apua, lähetä sähköpostia osoitteeseen {email} tai mainitse {x} X:ssä.",
  },
  legal: {
    terms: "Käyttöehdot",
    privacy: "Tietosuojakäytäntö",
    englishOnly: "Tämä asiakirja on saatavilla vain englanniksi.",
    agree: "Jatkamalla hyväksyt Mentan {terms} ja {privacy}.",
    agreeTerms: "käyttöehdot",
    agreePrivacy: "tietosuojakäytännön",
  },
} satisfies typeof en;
