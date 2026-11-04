import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "결제",
    shareTitle: "결제 승인하기 · {brand}",
    description:
      "Menta에 로그인해 이 단계를 마치세요. 지출 한도는 나만 승인할 수 있어요. 어시스턴트는 내 카드를 절대 볼 수 없어요.",
  },
  titles: {
    payment: "결제 승인",
    store: "스토어에서 확인이 필요해요",
    working: "실시간 결제",
    done: "주문 완료",
    stopped: "결제 중단됨",
    expired: "요청 만료됨",
    cancelled: "결제 취소됨",
    approved: "승인됨",
    sent: "보냄",
    missing: "결제를 찾을 수 없어요",
  },
  returnTo: "{host}에서 계속하기",
  returnToSentence: "{host}에서 계속하세요.",
  from: "{host}에서 요청",
  cancel: {
    confirm: "결제를 취소할까요? 아직 청구된 금액은 없어요.",
    keep: "유지",
    cancel: "결제 취소",
    ask: "이 결제 취소하기",
  },
  done: {
    approved: "승인됨",
    sent: "보냄",
    yourAssistant: "어시스턴트",
    placing: "주문을 넣고 있어요.",
    continuing: "보내 주신 답변으로 결제를 계속 진행해요.",
    sayDone: "{step} {host}에 돌아가 다 됐다고 말하면 결과를 알려 줘요.",
    placingResult:
      "주문을 넣고 있어요. 스토어가 주문을 확인하면 {host}에 결과가 전달돼요.",
    continuingResult:
      "보내 주신 답변으로 결제를 계속 진행해요. 스토어가 주문을 확인하면 {host}에 결과가 전달돼요.",
    paidUpTo: "결제 한도",
    item: "상품",
    store: "스토어",
  },
  watching: {
    title: "실시간 결제",
    upTo: "최대 {amount}",
    noLiveView: "결제용 브라우저가 열리면 실시간 화면이 표시돼요.",
    watchOnly: "지켜볼 수는 있지만 화면 안을 클릭할 수는 없어요.",
  },
  loading: "결제 불러오는 중",
  unavailable: {
    title: "결제를 불러오지 못했어요",
    body: "인터넷 연결을 확인하세요.",
    retry: "다시 시도",
  },
  missing: {
    title: "이 결제를 찾을 수 없어요",
    signedInAs: "{email} 계정으로 로그인되어 있어요. ",
    body: "링크가 오래됐거나 다른 계정의 결제일 수 있어요. {switch}하거나 {home}으로 이동해 보세요.",
    switch: "다른 계정으로 전환",
    home: "홈",
  },
  ended: {
    placed: "주문 완료",
    finished: "결제 완료",
    unconfirmed: "아직 확인되지 않음",
    stopped: "결제가 중단됐어요",
    doneNote: "더 하실 일은 없어요.",
    unconfirmedNote: "다시 구매하기 전에 스토어의 이메일을 기다려 주세요.",
    stoppedNote: "청구된 금액은 없어요. {host}에 다시 시도해 달라고 하세요.",
    yourAssistant: "어시스턴트",
  },
  expired: {
    request: "요청이 만료됐어요",
    approval: "승인이 만료됐어요",
    body: "어시스턴트에게 다시 시도해 달라고 하세요. 새 요청을 시작해 줘요.",
  },
  cancelled: {
    title: "결제 취소됨",
    body: "청구된 금액은 없어요.",
  },
  payment: {
    needsYou: "{store}에서 확인이 필요해요",
    title: "결제 승인하기",
    over: "{limit} 한도보다 {over} 초과",
    within: "{limit} 한도 이내",
    limit: "내 한도 {limit}",
    section: "안전한 결제 승인",
  },
  store: {
    private: "나만 입력할 수 있어요",
    question: "{store}의 간단한 질문",
    section: "안전한 스토어 입력",
    secretNote:
      "{store}에 바로 전달돼요. 어시스턴트는 보지도, 저장하지도 않아요.",
    secretNoteNamed:
      "{store}에 바로 전달돼요. {host}에서는 절대 보거나 저장하지 않아요.",
  },
  limit: {
    cardNote: "카드는 Crossmint에 보관돼요. 어시스턴트는 카드를 볼 수 없어요.",
    cardNoteNamed:
      "카드는 Crossmint에 보관돼요. {host}에서는 카드를 볼 수 없어요.",
    title: "지출 한도 설정하기",
    setUp: "지출 한도 설정",
    lede: "이번 주문과 다음 주문에 어시스턴트가 내 카드로 쓸 수 있는 금액을 정하세요. 언제든 철회할 수 있어요.",
    ledeNamed:
      "이번 주문과 다음 주문에 {host}에서 내 카드로 쓸 수 있는 금액을 정하세요. 언제든 철회할 수 있어요.",
    amount: "금액",
    name: "용도",
    anyStore: "모든 스토어",
    worksFor: "사용처",
    storeTitle: "스토어 지정",
    website: "웹사이트",
    save: "저장",
    onlyAt: "{store}에서만",
    expires: "만료까지",
    card: "카드",
    approved: "지출 한도를 승인했어요",
    approvedLede: "{name}: {amount}, {date}까지.",
    paying: "지금 이 한도로 {store}에 결제하고 있어요.",
    invalidAmount: "금액을 입력하세요. 예: 50",
    invalidName: "용도를 정하세요. 예: 장보기",
    missing: "이 요청은 사용할 수 없어요",
    missingLede:
      "만료되었거나 다른 계정용으로 만들어졌어요. 어시스턴트에게 새 요청을 부탁하세요.",
    yourLimits: "지출 한도 보기",
    cancel: "취소",
    cancelled: "승인된 지출 한도가 없어요",
    cancelledLede: "승인되거나 결제된 것이 없어요. 이 탭은 닫아도 돼요.",
  },
} satisfies typeof en;
