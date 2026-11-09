import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "도움말",
    description:
      "Menta를 어시스턴트에 추가하는 방법, 구매가 진행되는 방식, 카드·주소·주문을 확인하는 곳을 알려 드려요.",
  },
  title: "Menta 도움말",
  lede: "Menta는 ChatGPT, Claude, Grok Bot 등 여러 어시스턴트용 플러그인이에요. 어시스턴트에게 살 것을 말하면 Menta가 Crossmint Agent Checkouts로 전 세계 온라인 스토어에서 구매 절차를 대신 진행해요.",
  install: {
    title: "어시스턴트에 Menta 추가하기",
    lede: "사용하는 어시스턴트를 고르세요. 요청이 나오면 Menta에 로그인하고 접근을 허용하세요.",
    server: "서버 URL",
    listed:
      "Menta가 {directory}에 등록되면 거기서 추가하세요. 그전까지는 직접 추가하세요:",
    chatgptDirectory: "ChatGPT 플러그인 디렉터리",
    claudeDirectory: "Claude 커넥터 디렉터리",
    grokBot:
      "Menta가 Grok Bot 마켓플레이스에 올라오면, 마켓플레이스를 열고 Menta를 추가한 뒤 로그인하세요.",
    signIn: "Menta에 로그인하고 접근을 허용하세요.",
    otherApp: "다른 앱",
    example: "아마존에서 AA 건전지 4개입을 $15 이하로 사서 집으로 배송해 줘.",
    apps: {
      chatgpt: [
        "{plugins} 메뉴에서 {add} 항목을 선택하세요. 보이지 않으면 먼저 설정에서 개발자 모드를 켜세요.",
        "이름을 Menta로 정하고 URL을 붙여 넣은 뒤 {oauth} 방식을 고르세요.",
        "{create} 버튼을 누른 다음 {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "{connectors} 메뉴에서 {add} 항목을 선택하세요.",
        "이름을 Menta로 정하고 URL을 그대로 붙여 넣으세요. 끝에 슬래시(/)는 붙이지 마세요.",
        "Claude가 감지한 로그인 방식은 그대로 두고 {confirm} 버튼을 누른 다음 {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "앱에서 MCP 서버나 커넥터를 추가하는 곳을 찾으세요. 보통 맞춤 커넥터나 통합이라고 불러요.",
        "위의 URL로 원격 HTTP 서버를 추가하세요. 로그인은 OAuth 방식이라 API 키 칸은 비워 두면 돼요.",
        "요청이 나오면 {signIn}",
      ],
    },
  },
  purchase: {
    title: "구매가 진행되는 방식",
    steps: [
      {
        title: "살 것을 말하기",
        text: "원하는 것과 살 곳을 어시스턴트에게 말하세요. 예: “{example}”",
      },
      {
        title: "Menta가 구매 진행",
        text: "Menta가 스토어에서 구매 절차를 시작하고 진행 상황을 보여 줘요.",
      },
      {
        title: "스토어 질문에 답하기",
        text: "사이즈나 배송 시간처럼 스토어에 필요한 정보가 있으면 어시스턴트가 묻고, 답하면 돼요.",
      },
      {
        title: "지출 한도 승인하기",
        text: "스토어가 결제할 준비가 되면 Menta는 내가 승인한 지출 한도로 결제해요. 금액을 감당하는 한도가 있을 때만요. 없다면 어시스턴트나 Menta 페이지에 표시되는 Crossmint의 안전한 양식에서 직접 승인해요. 한도를 넘는 금액은 결제되지 않아요.",
      },
    ],
    never:
      "어시스턴트는 지출 한도를 승인하거나 늘릴 수 없어요. 카드 번호, 인증 코드, 비밀번호는 채팅을 거치지 않아요. 필요할 때는 Crossmint 보안 양식에 직접 입력해요.",
  },
  saved: {
    title: "카드와 주소",
    cards:
      "카드는 Crossmint가 내 Menta 계정에 저장해요. {wallet}에서 추가하고 관리하세요. 어시스턴트에는 카드 브랜드와 마지막 4자리만 보여요.",
    addresses:
      "배송 주소는 {addresses}에 저장돼요. 어시스턴트는 필요할 때만 주소를 읽어요. 배송지를 알려 줄 때는 기본 주소의 이름과 도시만 쓰고, 나머지는 내가 요청하거나 스토어가 물을 때만 써요.",
    signIn: "두 페이지 모두 Menta 로그인이 필요해요.",
  },
  orders: {
    title: "주문 확인 및 취소",
    text: "어시스턴트에게 구매가 어떻게 되고 있는지 묻거나 취소해 달라고 하세요. 어떤 어시스턴트에서든 Menta가 대신 산 모든 것은 {transactions}에 있어요.",
    store:
      "주문은 스토어에 내 이름으로 들어가므로, 주문이 완료된 뒤의 변경과 반품은 스토어를 통해 진행해요.",
  },
  limits: {
    title: "Menta가 할 수 없는 일",
    items: [
      "일부 스토어는 자동화된 브라우저를 차단해서, 그런 곳에서는 Menta가 구매할 수 없어요.",
      "Menta는 온라인 스토어에서 실물 상품을 사고 주문을 넣어요. 배송받거나 픽업할 수 있어요.",
      "Menta는 저장해 둔 카드로만, 그리고 내가 승인한 지출 한도 안에서만 결제해요.",
    ],
  },
  contact: {
    title: "개인정보, 약관 및 지원",
    text: "Menta는 Crossmint가 만들었어요. 도움이 필요하면 {email}로 이메일을 보내거나 X에서 {x}를 태그하세요.",
  },
  legal: {
    terms: "서비스 약관",
    privacy: "개인정보처리방침",
    englishOnly: "이 문서는 영어로만 제공돼요.",
    agree: "계속하면 Menta의 {terms} 및 {privacy}에 동의하게 돼요.",
    agreeTerms: "서비스 약관",
    agreePrivacy: "개인정보처리방침",
  },
} satisfies typeof en;
