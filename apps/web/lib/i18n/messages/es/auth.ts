import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Iniciar sesión",
    heading: "Inicia sesión en Menta",
    lede: "¿Eres nuevo? Al iniciar sesión se crea tu cuenta.",
    arrivals: {
      checkout: {
        kicker: "Una compra te necesita",
        title: "Inicia sesión para continuar",
        lede: "Tu asistente te envió aquí para un solo paso. Verás los detalles después de iniciar sesión con la cuenta que empezó la compra.",
        footer:
          "Aprueba pagos solo en Menta. Nunca escribas los datos de tu tarjeta en un chat.",
      },
      connect: {
        kicker: "Un asistente quiere conectarse",
        title: "Inicia sesión para conectar",
        lede: "Inicia sesión y luego decide si dejas que tu asistente compre con Menta.",
        ledeNamed:
          "Inicia sesión y luego decide si dejas que {name} compre con Menta.",
        footer:
          "Tú apruebas cada límite de gasto aquí, nunca en el chat del asistente.",
      },
    },
    googleFailed:
      "No se completó el inicio de sesión con Google. Inténtalo de nuevo.",
    invalidEmail: "Introduce un correo electrónico válido.",
    sendFailed: "No pudimos enviar un código. Inténtalo de nuevo.",
    codeFailed: "Ese código no funcionó. Inténtalo de nuevo o pide uno nuevo.",
    checkEmail: "Revisa tu correo",
    codeSent: "Introduce el código que enviamos a {email}.",
    google: "Continuar con Google",
    continueEmail: "Continuar con correo",
    or: "o",
    email: "Correo electrónico",
    code: "Código",
    emailPlaceholder: "Tu correo",
    openInbox: "Abrir {provider}",
    sendCode: "Enviar código",
    signIn: "Iniciar sesión",
    differentEmail: "Usar otro correo",
    resend: "Enviar un código nuevo",
    resendIn: "Enviar un código nuevo en {seconds} s",
    codeResent: "Enviamos un código nuevo a {email}.",
    password: "Contraseña",
    passwordFailed: "Esa contraseña no funcionó. Inténtalo de nuevo.",
  },
  authorize: {
    title: "Permitir acceso",
    can: [
      "Iniciar compras hasta el límite que fijes",
      "Ver el estado y los recibos",
      "Cancelar una compra cuando se lo pidas",
    ],
    cannot: [
      "Aprobar pagos",
      "Ver números de tarjeta ni códigos",
      "Cambiar tus tarjetas",
    ],
    offline: "No pudimos conectar con Menta. Revisa tu conexión.",
    failed: "Algo salió mal. Vuelve a intentarlo desde tu asistente.",
    cantConnect: "No se puede conectar ahora",
    returning: "Volviendo a tu asistente…",
    checking: "Revisando la solicitud…",
    thisAssistant: "Este asistente",
    heading: "¿Dejar que {name} use Menta?",
    signedInAs: "Sesión iniciada como {email} · ",
    notYou: "¿No eres tú?",
    itCan: "Puede",
    itCant: "No puede",
    ungrantable:
      "Tu cuenta no puede conceder {scopes}, así que puede que {name} no funcione del todo.",
    cancel: "Cancelar",
    allow: "Permitir",
    returnsTo:
      "Volverás a {returnsTo}. Puedes desconectarlo cuando quieras en {connections}.",
    connections: "Conexiones",
  },
  notFound: {
    title: "Página no encontrada",
    lede: "Esta página no existe o se ha movido.",
    home: "Ir a Menta",
  },
  codeEmail: {
    subject: "Tu código para iniciar sesión en Menta",
    heading: "Tu código de inicio de sesión",
    enter: "Introduce este código en Menta para iniciar sesión.",
    label: "Código de verificación",
    expires: "Caduca en {minutes} minutos.",
    share: "No lo compartas con nadie, ni siquiera con tu asistente.",
    ignore: "¿No intentaste iniciar sesión? Puedes ignorar este correo.",
  },
} satisfies typeof en;
