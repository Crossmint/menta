import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "帮助",
    description:
      "如何把 Menta 添加到你的助手、一次购买如何进行，以及在哪里查看你的卡、地址和订单。",
  },
  title: "Menta 帮助",
  lede: "Menta 是一款适用于 ChatGPT、Claude、Grok Bot 等助手的插件。告诉助手你想买什么，Menta 就会通过 Crossmint Agent Checkouts，在全球各地的网上商店为你完成结账流程。",
  install: {
    title: "把 Menta 添加到你的助手",
    lede: "选择你的助手。出现提示时，登录 Menta 并允许访问。",
    server: "服务器 URL",
    listed:
      "Menta 上架{directory}后，可以直接从那里添加。在此之前，请自己添加：",
    chatgptDirectory: "ChatGPT 插件目录",
    claudeDirectory: "Claude 连接器目录",
    grokBot:
      "Menta 上架 Grok Bot 的 Marketplace 后，打开 Marketplace，添加 Menta 并登录即可。",
    signIn: "登录 Menta 并允许访问。",
    otherApp: "其他应用",
    example: "在亚马逊买一组 4 节装 AA 电池，15 美元以内，送到家里。",
    apps: {
      chatgpt: [
        "打开 {plugins}，选择 {add}。找不到？先在设置中开启开发者模式。",
        "命名为 Menta，粘贴 URL，然后选择 {oauth}。",
        "选择 {create}，然后{signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "打开 {connectors}，选择 {add}。",
        "命名为 Menta，原样粘贴 URL，末尾不要加斜杠。",
        "保留 Claude 检测到的登录方式，选择 {confirm}，然后{signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "在你的应用里找到添加 MCP 服务器或连接器的地方（通常叫自定义连接器或集成）。",
        "用上面的 URL 添加一个远程 HTTP 服务器。登录方式是 OAuth，所以 API 密钥一栏留空即可。",
        "出现提示时，{signIn}",
      ],
    },
  },
  purchase: {
    title: "购买如何进行",
    steps: [
      {
        title: "说出要买什么",
        text: "告诉助手你想要什么、在哪里买，例如“{example}”",
      },
      {
        title: "Menta 开始结账",
        text: "Menta 在商店发起结账，并向你展示进度。",
      },
      {
        title: "回答商店的问题",
        text: "如果商店需要你提供信息，比如尺码或送达时间，助手会问你，你来回答。",
      },
      {
        title: "批准消费限额",
        text: "商店准备扣款时，如果有你已批准的消费限额能覆盖，Menta 就用它付款。如果没有，你需要在 Crossmint 的安全表单中亲自批准一个，表单会显示在助手里或 Menta 页面上。超出限额的款项不会支付。",
      },
    ],
    never:
      "助手永远无法批准或提高消费限额。卡号、验证码和密码永远不会经过聊天：需要时，你在 Crossmint 的安全表单中输入。",
  },
  saved: {
    title: "卡和地址",
    cards:
      "Crossmint 会把你的卡保存在你的 Menta 账户中。在{wallet}中添加和管理。助手只能看到卡组织和卡号后 4 位。",
    addresses:
      "你的收货地址保存在{addresses}中。助手只在需要时读取：用默认地址的名称和城市说明送货地点，其余信息只在你或商店需要时使用。",
    signIn: "这两个页面都需要登录 Menta。",
  },
  orders: {
    title: "查看或取消订单",
    text: "问问助手结账进行得怎么样，或者让它取消。Menta 通过任何助手为你买过的所有东西，都在{transactions}中。",
    store:
      "订单在商店里以你的名义下单，所以下单后的修改和退货需要通过商店处理。",
  },
  limits: {
    title: "Menta 做不到的事",
    items: [
      "有些商店会屏蔽自动化浏览器，Menta 无法在这些商店结账。",
      "Menta 在网上商店购买实物商品和下单，可送货上门或到店自提。",
      "Menta 只会使用你保存的银行卡，并且只在你批准的消费限额内付款。",
    ],
  },
  contact: {
    title: "隐私、条款和支持",
    text: "Menta 由 Crossmint 打造。如需帮助，请发邮件至 {email}，或在 X 上提及 {x}。",
  },
  legal: {
    terms: "服务条款",
    privacy: "隐私政策",
    englishOnly: "本文件仅提供英文版本。",
    agree: "继续即表示你同意 Menta 的{terms}和{privacy}。",
    agreeTerms: "服务条款",
    agreePrivacy: "隐私政策",
  },
} satisfies typeof en;
