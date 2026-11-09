import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Entrar",
    heading: "Entrar no Menta",
    lede: "Novo por aqui? Ao entrar, sua conta é criada.",
    arrivals: {
      checkout: {
        kicker: "Uma compra precisa de você",
        title: "Entre para continuar",
        lede: "Seu assistente trouxe você aqui para uma etapa. Você vê os detalhes depois de entrar com a conta que iniciou a compra.",
        footer:
          "Aprove pagamentos só no Menta. Nunca digite dados do cartão em um chat.",
      },
      connect: {
        kicker: "Um assistente quer se conectar",
        title: "Entre para conectar",
        lede: "Entre e depois escolha se quer deixar seu assistente comprar com o Menta.",
        ledeNamed:
          "Entre e depois escolha se quer deixar {name} comprar com o Menta.",
        footer:
          "Você aprova cada limite de gastos aqui, nunca no chat do assistente.",
      },
    },
    googleFailed: "O login com o Google não foi concluído. Tente de novo.",
    invalidEmail: "Digite um e-mail válido.",
    sendFailed: "Não conseguimos enviar um código. Tente de novo.",
    codeFailed: "Esse código não funcionou. Tente de novo ou peça um novo.",
    checkEmail: "Confira seu e-mail",
    codeSent: "Digite o código que enviamos para {email}.",
    google: "Continuar com o Google",
    continueEmail: "Continuar com e-mail",
    or: "ou",
    email: "E-mail",
    code: "Código",
    emailPlaceholder: "Seu e-mail",
    openInbox: "Abrir {provider}",
    sendCode: "Enviar código",
    signIn: "Entrar",
    differentEmail: "Usar outro e-mail",
    resend: "Enviar um novo código",
    resendIn: "Enviar um novo código em {seconds} s",
    codeResent: "Enviamos um novo código para {email}.",
    password: "Senha",
    passwordFailed: "Essa senha não funcionou. Tente de novo.",
  },
  authorize: {
    title: "Permitir acesso",
    can: [
      "Iniciar compras até o limite que você definir",
      "Ver status e recibos",
      "Cancelar uma compra quando você pedir",
    ],
    cannot: [
      "Aprovar pagamentos",
      "Ver números de cartão ou códigos",
      "Alterar seus cartões",
    ],
    offline: "Não conseguimos acessar o Menta. Verifique sua conexão.",
    failed: "Algo deu errado. Tente de novo pelo seu assistente.",
    cantConnect: "Não é possível conectar agora",
    returning: "Voltando para o seu assistente…",
    checking: "Verificando a solicitação…",
    thisAssistant: "Este assistente",
    heading: "Permitir que {name} use o Menta?",
    signedInAs: "Conectado como {email} · ",
    notYou: "Não é você?",
    itCan: "Pode",
    itCant: "Não pode",
    ungrantable:
      "Sua conta não pode conceder {scopes}, então {name} pode não funcionar por completo.",
    cancel: "Cancelar",
    allow: "Permitir",
    returnsTo:
      "Você vai voltar para {returnsTo}. Pode desconectá-lo quando quiser em {connections}.",
    connections: "Conexões",
  },
  notFound: {
    title: "Página não encontrada",
    lede: "Esta página não existe ou mudou de endereço.",
    home: "Ir para o Menta",
  },
  codeEmail: {
    subject: "Seu código para entrar no Menta",
    heading: "Seu código de acesso",
    enter: "Digite este código no Menta para entrar.",
    label: "Código de verificação",
    expires: "Ele expira em {minutes} minutos.",
    share: "Não compartilhe com ninguém, nem mesmo com seu assistente.",
    ignore: "Não tentou entrar? Pode ignorar este e-mail.",
  },
} satisfies typeof en;
