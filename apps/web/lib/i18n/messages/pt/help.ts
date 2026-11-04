import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Ajuda",
    description:
      "Como adicionar o Menta ao seu assistente, como funciona uma compra e onde ficam seus cartões, endereços e pedidos.",
  },
  title: "Ajuda do Menta",
  lede: "O Menta é um plugin para ChatGPT, Claude, Grok Bot e outros assistentes. Diga ao seu assistente o que comprar, e o Menta finaliza a compra para você em lojas online do mundo todo, com o Crossmint Agent Checkouts.",
  install: {
    title: "Adicione o Menta ao seu assistente",
    lede: "Escolha seu assistente. Quando ele pedir, entre no Menta e permita o acesso.",
    server: "URL do servidor",
    listed:
      "Quando o Menta estiver no {directory}, adicione por lá. Até lá, adicione você mesmo:",
    chatgptDirectory: "diretório de plugins do ChatGPT",
    claudeDirectory: "diretório de conectores do Claude",
    grokBot:
      "Quando o Menta estiver no Marketplace do Grok Bot, abra o Marketplace, adicione o Menta e faça login.",
    signIn: "entre no Menta e permita o acesso.",
    otherApp: "Outro app",
    example:
      "Compre um pacote com 4 pilhas AA na Amazon, por menos de US$ 15, com entrega em casa.",
    apps: {
      chatgpt: [
        "Abra {plugins} e escolha {add}. Não aparece? Ative antes o modo de desenvolvedor nas configurações.",
        "Dê o nome Menta, cole a URL e escolha {oauth}.",
        "Escolha {create} e depois {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Abra {connectors} e escolha {add}.",
        "Dê o nome Menta e cole a URL exatamente como está, sem barra no final.",
        "Mantenha o login que o Claude detectar, escolha {confirm} e depois {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Encontre onde o seu app adiciona servidores MCP ou conectores (muitas vezes chamados de conectores personalizados ou integrações).",
        "Adicione um servidor HTTP remoto com a URL acima. O login é por OAuth, então deixe vazio qualquer campo de chave de API.",
        "Quando for solicitado, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Como funciona uma compra",
    steps: [
      {
        title: "Diga o que comprar",
        text: "Diga ao seu assistente o que você quer e onde, por exemplo: “{example}”",
      },
      {
        title: "O Menta finaliza a compra",
        text: "O Menta inicia a compra na loja e mostra o andamento para você.",
      },
      {
        title: "Responda à loja",
        text: "Se a loja precisar de algo, como um tamanho ou um horário de entrega, seu assistente pergunta e você responde.",
      },
      {
        title: "Aprove um limite de gastos",
        text: "Quando a loja está pronta para cobrar, o Menta paga com um limite de gastos que você aprovou, se algum cobrir o valor. Se nenhum cobrir, você aprova um no formulário seguro da Crossmint, no seu assistente ou em uma página do Menta. Nada é pago além dos seus limites.",
      },
    ],
    never:
      "Seu assistente nunca pode aprovar nem aumentar um limite de gastos. Números de cartão, códigos de verificação e senhas nunca passam pelo chat: quando um deles é necessário, você digita no formulário seguro da Crossmint.",
  },
  saved: {
    title: "Cartões e endereços",
    cards:
      "A Crossmint salva seus cartões na sua conta do Menta. Adicione e gerencie em {wallet}. Seu assistente vê só a bandeira e os 4 últimos dígitos do cartão.",
    addresses:
      "Seus endereços de entrega ficam salvos em {addresses}. Seu assistente só os consulta quando precisa: o nome e a cidade do seu endereço padrão para dizer para onde vão as entregas, e o resto quando você ou uma loja pedirem.",
    signIn: "As duas páginas pedem que você entre no Menta.",
  },
  orders: {
    title: "Acompanhar ou cancelar um pedido",
    text: "Pergunte ao seu assistente como está uma compra, ou peça para ele cancelar. Tudo o que o Menta comprou para você, de qualquer assistente, está em {transactions}.",
    store:
      "Os pedidos ficam no seu nome na loja, então, depois que o pedido é feito, alterações e devoluções são com a loja.",
  },
  limits: {
    title: "O que o Menta não faz",
    items: [
      "Algumas lojas bloqueiam navegadores automatizados, então o Menta não consegue comprar nelas.",
      "O Menta compra produtos físicos e faz pedidos em lojas online, com entrega ou para retirada.",
      "O Menta paga só com um cartão que você salvou, e só dentro de um limite de gastos que você aprovou.",
    ],
  },
  contact: {
    title: "Privacidade, termos e suporte",
    text: "O Menta é feito pela Crossmint. Para ajuda, escreva para {email} ou marque {x} no X.",
  },
  legal: {
    terms: "Termos de serviço",
    privacy: "Política de privacidade",
    englishOnly: "Este documento está disponível apenas em inglês.",
    agree: "Ao continuar, você aceita os {terms} e a {privacy} do Menta.",
    agreeTerms: "termos de serviço",
    agreePrivacy: "política de privacidade",
  },
} satisfies typeof en;
