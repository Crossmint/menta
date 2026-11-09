import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "로그인",
    heading: "Menta에 로그인",
    lede: "처음이신가요? 로그인하면 계정이 만들어져요.",
    arrivals: {
      checkout: {
        kicker: "결제에 확인이 필요해요",
        title: "로그인하고 계속하기",
        lede: "어시스턴트가 한 단계를 위해 이곳으로 안내했어요. 결제를 시작한 계정으로 로그인하면 자세한 내용을 볼 수 있어요.",
        footer:
          "결제 승인은 Menta에서만 하세요. 채팅에 카드 정보를 입력하지 마세요.",
      },
      connect: {
        kicker: "어시스턴트가 연결을 요청해요",
        title: "로그인하고 연결하기",
        lede: "로그인한 다음, 어시스턴트가 Menta로 쇼핑하도록 허용할지 정하세요.",
        ledeNamed:
          "로그인한 다음, {name}이(가) Menta로 쇼핑하도록 허용할지 정하세요.",
        footer:
          "지출 한도는 모두 여기에서 승인해요. 어시스턴트 채팅에서는 승인하지 않아요.",
      },
    },
    googleFailed: "Google 로그인이 완료되지 않았어요. 다시 시도해 주세요.",
    invalidEmail: "올바른 이메일 주소를 입력하세요.",
    sendFailed: "코드를 보내지 못했어요. 다시 시도해 주세요.",
    codeFailed: "코드가 맞지 않아요. 다시 입력하거나 새 코드를 요청하세요.",
    checkEmail: "이메일을 확인하세요",
    codeSent: "{email}(으)로 보낸 코드를 입력하세요.",
    google: "Google로 계속하기",
    continueEmail: "이메일로 계속하기",
    or: "또는",
    email: "이메일",
    code: "코드",
    emailPlaceholder: "이메일 주소",
    openInbox: "{provider} 열기",
    sendCode: "코드 보내기",
    signIn: "로그인",
    differentEmail: "다른 이메일 사용",
    resend: "새 코드 보내기",
    resendIn: "{seconds}초 후 새 코드 보내기",
    codeResent: "{email}(으)로 새 코드를 보냈습니다.",
    password: "비밀번호",
    passwordFailed: "비밀번호가 맞지 않습니다. 다시 시도하세요.",
  },
  authorize: {
    title: "접근 허용",
    can: [
      "내가 정한 한도 안에서 결제 시작",
      "진행 상태와 영수증 확인",
      "요청하면 결제 취소",
    ],
    cannot: ["결제 승인", "카드 번호나 코드 보기", "카드 변경"],
    offline: "Menta에 연결할 수 없어요. 인터넷 연결을 확인하세요.",
    failed: "문제가 생겼어요. 어시스턴트에서 다시 시도해 주세요.",
    cantConnect: "지금은 연결할 수 없어요",
    returning: "어시스턴트로 돌아가는 중…",
    checking: "요청을 확인하는 중…",
    thisAssistant: "이 어시스턴트",
    heading: "{name}에서 Menta를 사용하도록 허용할까요?",
    signedInAs: "{email} 계정으로 로그인됨 · ",
    notYou: "본인이 아닌가요?",
    itCan: "할 수 있는 일",
    itCant: "할 수 없는 일",
    ungrantable:
      "내 계정으로는 {scopes} 권한을 줄 수 없어서 {name}이(가) 일부 기능을 쓰지 못할 수 있어요.",
    cancel: "취소",
    allow: "허용",
    returnsTo:
      "{returnsTo}(으)로 돌아가요. 연결은 언제든 {connections} 페이지에서 해제할 수 있어요.",
    connections: "연결",
  },
  notFound: {
    title: "페이지를 찾을 수 없어요",
    lede: "페이지가 없거나 다른 곳으로 옮겨졌어요.",
    home: "Menta로 가기",
  },
  codeEmail: {
    subject: "Menta 로그인 코드",
    heading: "로그인 코드",
    enter: "Menta에서 이 코드를 입력해 로그인하세요.",
    label: "인증 코드",
    expires: "코드는 {minutes}분 후에 만료돼요.",
    share: "누구에게도, 어시스턴트에게도 이 코드를 알려 주지 마세요.",
    ignore: "로그인을 시도하지 않았다면 이 이메일은 무시해도 돼요.",
  },
} satisfies typeof en;
