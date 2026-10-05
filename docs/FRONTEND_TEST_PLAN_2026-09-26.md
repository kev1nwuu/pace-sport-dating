# PACE 前端全流程检查与测试用例

检查日期：2026-09-26。检查范围：当前 `index.html`、`app.js`、`features/`、repository/API 边界、现有自动测试和交接文档。此文档由只读代码审查产生；未修改业务实现，也未编写后端。

**结论：现有原型有完整的主要页面和部分 HTTP 对接接口，但不能据此认定真实账号、匹配、聊天、邀约、媒体和注销流程已完成。** 本轮 94 项 Node 测试通过；浏览器测试的“已有”表示已编写，不表示本次已执行。主任务的实际 UI 检查结果应另行记录，不能混算。

## 本轮执行与现有覆盖

| 检查 | 本轮结果 | 证明范围 / 限制 |
| --- | --- | --- |
| `node --run check` | 通过 | 当前生产 JS 模块语法有效，不能证明交互正确 |
| `node --run test:unit` | 94/94 通过 | 下表的纯逻辑、接口和启动状态测试 |
| Playwright E2E | 未在本次审查运行 | 现存 36 个测试声明：core 13、engagement 7、session 7、visual 7、accessibility 2 |
| 手机真机 / iOS / Safari / VoiceOver | 未运行 | 需要后续设备测试 |
| 真实后端 / App Store Sandbox | 未运行 | 当前没有部署的真实服务或原生购买测试环境 |

运行 Node 脚本时先把本机 Node runtime 加入 `PATH`。仅指定 Node 可执行文件而不修改 PATH，子命令会报 `node: command not found`；本轮修正环境后重新执行通过。

| 已有文件 | 项数 | 已覆盖 |
| --- | ---: | --- |
| `contract_test_cases.mjs` | 10 | sport ID、本地化字典接口、HTTP 参数、错误封装、session/cache/import 约束 |
| `user_test_cases.mjs` | 11 | 匹配纯函数、基础权益、可见动态、评论/点赞、简介约束、本地日期 |
| `repository_test_cases.mjs` | 20 | adapter、持久预览 marker、过期/损坏/禁用 storage、严格 HTTP session |
| `photo_presentation_test_cases.mjs` | 3 | 头像裁切与焦点数据 |
| `engagement_test_cases.mjs` | 30 | reference service 权限、重复请求、名额、会员生命周期、Apple 签名验证接缝 |
| `storekit_bridge_test_cases.mjs` | 7 | 原生桥契约、取消/pending、restore、账户绑定、不可用时拒绝授权 |
| `onboarding_startup_test_cases.mjs` | 8 | 启动 gate、重试、退出后的迟到响应、资源准备、减少动态效果 |
| `launch_assets_test_cases.mjs` | 5 | 字体与图片准备、memoization、失败/超时释放 |

`engagement_test_cases.mjs` 使用进程内 reference service，不能证明数据库锁、真实支付验证或部署的 API 授权。`accessibility.spec.mjs` 是基础 DOM 约束检查，尚非完整无障碍审计。`visual.spec.mjs` 使用 `animations: "disabled"`，所以截图通过不能证明启动动画顺滑。历史 `CODEBASE_HEALTH.md`、`BACKEND_READINESS.md` 的旧数量及“已通过”是当时记录，应避免当作本次验收结果。

## 代码审查发现

优先级：P0 = 对外发布前必须解决；P1 = 接入阶段必须覆盖的重要流程；P2 = 常规质量完善。下列证据均来自本地代码，并非浏览器重现结果。

| ID | 优先级 | 发现与用户影响 | 代码证据 | 验证用例 |
| --- | --- | --- | --- | --- |
| F01 | P0 | Discovery 返回候选只控制卡片显隐；显示仍固定 Maya。点击 Like 无条件安排匹配成功弹窗，不能作为服务端互相喜欢的证明。 | `app.js` 的 `setDiscoveryState`、`performDiscoveryDecision`；`index.html` 静态 discovery card | D02–D05 |
| F02 | P0 | Chat 发送消息只追加 DOM，重新打开即丢失；任何作者打开 Chat 都获得同一组预置问答，没有会话 ID / 历史加载。 | `features/chat.mjs:63`、`:80`、`:93` | C02–C05 |
| F03 | P0 | 当前有两种邀约：Discovery/Plus 调用 `sendDirectInvite`；Chat 的 `openInvite` 仅关闭弹窗并提示已发送，既没有收件人 ID，也没有写请求。 | `features/chat.mjs:126`；`features/membership.mjs` 的 `renderInvite` | I03–I07 |
| F04 | P0 | 注册首步只校验并保存 email 到内存；Apple/Google 按钮填演示 email 直接继续。HTTP 完成注册要求已存在认证 session，当前缺真实建立账号/交换身份步骤。 | `features/onboarding.mjs:303`、`:538`；`docs/AUTH_SESSION.md` | A04–A07 |
| F05 | P0 | 删除账号只是设置内存 `deletedAt` 和 toast，不调用删除 API，不退出、不撤销持久 session。 | `features/account.mjs:164` | S01–S02 |
| F06 | P0 | 动态发布把 `blob:` 本地图片 URL 和固定 `user_kevin`/`verified:true` 发给 publish；没有实际上传完成过程。其他设备无法访问这些图片，身份必须改为 session 派生。 | `features/moments.mjs:242`、`:274`；`api_client.mjs` 的 upload 方法未被此流程调用 | M04–M07 |
| F07 | P1 | 自己的 profile 初始数据为本地默认值，启动没有 GET me/profile；local session marker 不保存 profile。重新打开可能展示默认资料，不能等同于“我的资料已恢复”。 | `features/account.mjs:22`、`:107`；`app.js` 的 `onAuthenticated`；`docs/AUTH_SESSION.md` | P02–P03 |
| F08 | P1 | 未显式为 false 的 `person.verified` 会显示认证徽章，遗漏字段也变成“已验证”；Maya 还有 `maya` / `user_maya` 两套演示 ID。 | `features/chat.mjs:67`、`:77`、`:83`；`app.js` 的 `initialCandidates` | C01、C06 |
| F09 | P1 | Feed 初次加载失败后清空列表，只给短 toast，没有持续 error/retry 状态；过期 session 没有统一回到登录 gate 的拦截。 | `features/moments.mjs` 的 `start`；`api_client.mjs` 的 `request` | R01–R03、M08 |
| F10 | P1 | 注册/登录大部分字段与错误写死英文；profile frequency options 也是英文，顶层字典完整性测试无法发现这些。 | `features/onboarding.mjs:90`、`:233`、`:277`；`features/account.mjs:278` | L01–L03 |
| F11 | P1 | 普通 modal 有焦点 trap，独立 match-success dialog 没有对应 Tab trap；Chat 的 tabs 没有 roving tabindex / arrow-key 处理。 | `app.js` 的 document keydown；`features/chat.mjs:39`、`:78` | X02–X04 |
| F12 | P1 | Profile 上传只有 MIME/数量过滤，没有尺寸/大小/解码失败反馈；Moments 使用 `image/*` 过滤且没有数量上限，取消 publisher 未释放预览 URL。 | `features/account.mjs:355`；`features/moments.mjs:242`、`openMomentPublisher` | P06、M05、R06 |
| F13 | 待决策 | 资料编辑允许空/短简介，unit test 明确验证；注册要求简介至少 12 字。规则不一致，需产品确认统一还是分阶段要求。 | `user_test_cases.mjs` UT-09；`features/onboarding.mjs` prompts 分支 | P07 |

以上是交付前工作清单，不授权现在开始后端。尤其 F01–F06 不能靠前端样式改动或新增成功 toast 消除。

## 测试执行约定

- 下表中的“已有”指仓库已有相关断言；“新增”指先写出的测试规格，尚未自动实现或执行；“集成”表示依赖后端/原生协议的预期验收，必须在用户授权后，先实现可失败测试再实现该功能。
- 测试使用固定时钟、两名互相独立用户 A/B、第三人 C、未成年人资料、Free/Plus/过期/撤销状态、已匹配/未匹配/双向拉黑以及不可用作者。不得用真实个人数据或向真实用户发送消息。
- 所有成功用例增加一次失败/重试/双击检查；服务器数据用可控 fixture，不能让 demo 默认值掩盖缺字段。
- 当前浏览器基线为单 worker 的 Chromium 480×844。应增加 320×700、390×640、用户提供的 440×702、710×752，以及 iOS 真机 safe-area/键盘验证。桌面改 viewport 不能替代 iOS WebKit/真机。

## 测试用例：本次邀约设计

| ID / 优先级 | 前置与步骤 | 必须达到的结果 | 覆盖状态 |
| --- | --- | --- | --- |
| I01 / P1 | 在上述 5 个视口打开 Discovery；分别用中文和英文；检查邀约入口的普通、focus、hover、pressed 状态 | 图标与文字整体对齐、无旧浮动 PLUS 小牌压边，无卡片/导航遮挡；触摸区域至少 44×44 CSS px；用途有可访问名称 | 新增；本轮 UI 改完后验证 |
| I02 / P1 | 从 Chat 打开邀约，在 390×640、440×702 输入合法/非法值，滚动到提交区；测按钮与文案中心 | 按钮外框中心与提交行中心偏差 ≤1 CSS px；文案中心与按钮内容区中心偏差 ≤1 px；禁用/启用/提交中不跳动；键盘打开仍可滚动到提交按钮 | 已有 dialog containment 测试；按钮/文案居中断言新增 |
| I03 / P0 | 未匹配 Free 用户点邀约；关闭；模拟已匹配 Free，再点击 | 未匹配仅展示 Plus，不能发送；已匹配应允许免费邀约；界面两条入口使用相同 recipient/授权规则 | 已有 Free/Plus 部分 E2E；Chat 联通为集成 |
| I04 / P0 | A 从 B 动态头像进入 Profile，切 Chat，发邀约；C 重复同操作 | 请求 recipient 为正在查看的人；仅对应会话收到待处理邀约；不可固定 Maya 或发给自己 | 新增，集成 |
| I05 / P0 | 填有效邀约，双击发送；模拟超时后重试；更改 payload 后再发 | 一个有效请求对应一个邀约；同内容重试用同一 key；新内容用新 key；失败保留输入，不显示已发送 | Direct invite 已有 reference + API E2E；Chat 新增 |
| I06 / P0 | Composer 打开时有 Plus，发送前过期；收件人拉黑/停用；服务端返回对应拒绝 | 未产生邀约；过期回 Plus；不可用给可理解提示；按钮可恢复；不暴露对方隐私原因 | Direct invite 部分已有；UI 拒绝矩阵新增 |
| I07 / P0 | 今日过去时间、明日有效时间、DST 转换日、时区改变后打开邀约 | 过去时间不可提交；请求存明确 UTC 与约定时区，显示本地时间一致；不能只校验 date>=today | Direct invite 部分已有；Chat/DST 集成 |
| I08 / P1 | Enter 提交、Escape 取消、Tab 循环；填写后取消再打开 | 只提交一次，取消不发送；焦点返回入口；草稿保留/清空遵循确认的规则 | 新增 |

## 测试用例：账号与启动

| ID / 优先级 | 前置与步骤 | 必须达到的结果 | 覆盖状态 |
| --- | --- | --- | --- |
| A01 / P0 | 无 session、有效 session、过期 session，冷启动/刷新/新 tab | 对应欢迎页/加载后 Discovery/重新登录；未验证前主区域 inert，不闪出私人内容 | 已有 unit + 7 session E2E |
| A02 / P0 | session 503/timeout 后 retry，期间 logout 或切换账号 | 不误当已登出；可重试；旧请求不能重新解锁或填入上一账号数据 | unit 已有 startup 部分；换账号数据清理新增集成 |
| A03 / P1 | 冷字体/图片、失败图片、减少动态效果、低端机 CPU 慢 | 品牌到目标页平滑衔接，固定底栏不跳，资源失败不会无限挡住入口 | unit 已有资源 gate；真实 motion/设备检查新增 |
| A04 / P0 | 真正新邮箱注册、已存在邮箱、弱密码/错误确认、邮件未验证 | 一次注册；server 错误映射到字段；email/密码/确认不存 localStorage；未认证不得调用完成接口解锁 | 现有仅 preview；集成 |
| A05 / P0 | Google/Apple 登录成功/取消/过期 state/账户冲突/隐藏邮箱 | 通过真实 provider exchange；取消留原页面；没有写死身份或静默创建第二账号 | 集成 |
| A06 / P0 | 18 岁生日当天/前一天、闰日生日、未来生日、篡改 client 日期 | 明确年龄规则，前后端一致；服务端拒绝不符合条件用户 | client 限制已有；边界与服务端集成 |
| A07 / P1 | 忘记密码、重置链接失效/复用、重置后其他设备 session | 可恢复账号；token 单次有效；按明确 session 策略处理旧设备 | 集成；当前无流程 |
| A08 / P0 | 登录中/完成注册请求失败再重试；退出请求失败再重试 | 按钮恢复，保留可用输入，成功后只进入一次；退出失败不能假称已撤销所有 session | 部分已有；完整失败矩阵新增 |

## 测试用例：Discovery、匹配与会话

| ID / 优先级 | 前置与步骤 | 必须达到的结果 | 覆盖状态 |
| --- | --- | --- | --- |
| D01 / P1 | 切 sports/distance/goal/schedule，快速连续切，空结果/503 | 仅最新请求更新页面；empty 与请求失败区分；重试可用；存 stable sport ID | query/unit 部分已有；goal/schedule 展示与错误状态新增 |
| D02 / P0 | API 分别返回 A/B/C 不同姓名/照片/年龄/频率，再翻卡 | 每张卡与 API 身份一致；邀约/like/pass 都绑定该 ID；不残留 Maya 数据 | 集成 |
| D03 / P0 | 只 A like B、B 已 like A、双方并发 like | 单向无成功匹配弹窗；互相才出现一次，match ID 唯一；连接列表一致 | 纯函数已有，真实 UI/服务器集成缺失 |
| D04 / P0 | 双击 like、滑动后 click、额度 0、断网、500 | 没有重复决策/额度扣减；失败可重试且不假匹配；有触摸取消处理 | 新增，集成 |
| D05 / P1 | Pass 后返回/刷新，候选耗尽，unmatch 后再次发现 | 候选游标和排除规则一致；不要同一演示卡无限重放；空状态可恢复 | 集成 |
| C01 / P1 | 点击 Maya/Noah/同名不同 ID 作者头像、姓名，再返回 | 打开正确 Profile 标签，照片与身份匹配；返回 Moments；自己作者打开 Me | Maya/Noah 已有 E2E；同名/自己新增 |
| C02 / P0 | A/B 已匹配，A/C 未匹配，各自切换 Chat | 历史来自正确 conversation ID；未获授权不可读写；无复制同一 demo 问答 | 集成 |
| C03 / P0 | 发送文本，切页返回、刷新、第二设备打开 | 消息持久且顺序一致；pending/sent/failed 明确；服务端确认前不冒充送达 | 新增，集成 |
| C04 / P0 | 消息发送超时/断网重连/重复事件/倒序事件 | 同一 client message ID 只一条；重试保留文本；不会丢失或跨会话显示 | 新增，集成 |
| C05 / P1 | 空白、emoji、多行、1000 字边界、HTML 字符、键盘遮挡 | 空白不可发，文本按文本显示；错误不清空输入；自动滚动不抢走用户看旧消息的位置 | blank/DOM bubble 已有 E2E；其余新增 |
| C06 / P0 | 作者 verified 为 true/false/缺失/null；blocked/deleted 作者 | 仅明确可信 verified=true 显示徽章；已删除/拉黑处理完整，不能展示默认 Maya 私人信息 | 新增，集成 |

## 测试用例：资料与动态

| ID / 优先级 | 前置与步骤 | 必须达到的结果 | 覆盖状态 |
| --- | --- | --- | --- |
| P01 / P1 | 编辑/预览/取消/保存，反复开关 10 次 | 取消不写入，预览取草稿；保存仅一次；没有重复 event listener；不再出现已要求删除的 Photos 说明 | 主要路径已有；取消/重复新增 |
| P02 / P0 | 保存姓名/bio/photos/sports 等，刷新与另一设备恢复 | 页面从服务器读取同一完整 profile；服务器拒绝时原稿保留；无默认 Kevin 覆盖 | 集成 |
| P03 / P0 | 打开 height/ethnicity visibility 开关，B 查看 A | 关闭字段不会通过公开 API 泄漏，不只靠 CSS 隐藏；自身编辑仍可见 | 本地隐藏已有；公开 DTO 集成 |
| P04 / P1 | cm↔ft 多次切换、最小/最大值、未填写 | 单位换算允许约定舍入，无 NaN/丢值；未填不会变 0；私密开关不被自动打开 | 主要 E2E 已有，边界新增 |
| P05 / P1 | sports 0/1/43 项、自定义 sport、切语言再保存 | 至少一个；稳定 ID，不把翻译标签当 ID；自定义值往返不丢失 | catalog unit 已有；自定义往返新增 |
| P06 / P1 | 0/6/7 照片、超大/损坏/伪 MIME 图片、取消/移除、上传失败 | 限量、明确拒绝提示、解码安全、可重试；文件未持久上传前不得假保存；移除释放资源 | 数量 unit 部分已有；文件和上传新增 |
| P07 / 待定 | 注册和编辑提交空/2 字/12 字/300 字 bio | 按确认规则统一；测试不能一处要求无最短字数，另一处不说明地强制 12 字 | 存在冲突，需先确认 |
| M01 / P0 | Feed 混入 self/connected/pending/public/blocked 作者 | 仅授权内容可见，服务器查询执行隔离；返回作者数据不自动授予聊天权限 | 纯函数已有；跨账号集成 |
| M02 / P1 | 赞/取消赞快速连点，延迟响应顺序反转，失败重试 | UI 最终与服务端一致，count 不负数不重复加减，焦点不丢 | unit/单次 E2E 已有；竞态新增 |
| M03 / P1 | 评论空/280/281 字，发送中取消弹窗，失败再重试 | 无重复评论；关闭后旧响应不重新打开评论；文稿错误时可恢复 | 正常评论已有；迟到响应新增 |
| M04 / P0 | A/B 发布，尝试伪造 author_id/verified/visibility | author 和权限取 session；只允许规定可见性；本地固定 Kevin 不进入生产 | 集成 |
| M05 / P0 | 带照片发布：上传成功/单张失败/发布失败/刷新/异地设备 | 只提交 durable media ID/URL；失败保持草稿；孤儿上传清理；照片可跨设备访问 | 集成 |
| M06 / P1 | 从 publisher 取消后重新打开/删除图/连续 20 次操作 | 预览 URL 被适时释放，无数量无限增长；不泄漏未发布照片 | 新增 |
| M07 / P1 | Caption/sport/metrics 含 HTML，响应中的 post ID 缺失或含引号 | 文本转义，DTO 校验；不生成任意 HTML 或错绑按钮；一条坏记录不使全 Feed 崩溃 | 新增 |
| M08 / P1 | Feed 首次 503、空列表、分页失败、拉黑后再拉取 | 持续 error + retry 与真 empty 区分；分页无重复；失效内容移除 | 新增，分页依赖集成 |

## 测试用例：会员、Meet up 与设置

| ID / 优先级 | 前置与步骤 | 必须达到的结果 | 覆盖状态 |
| --- | --- | --- | --- |
| B01 / P0 | Free/有效 Plus/取消续费但未到期/过期/退款 | 展示真实权益；取消续费保留到期前权益；退款立即撤销；UI 不能自授会员 | reference 已有，真实 Apple 集成 |
| B02 / P0 | Web 无 bridge、iOS 商品不可用、缺法律 URL、非本地化价格 | 不提供不可执行购买；展示明确不可用；购买信息来自 StoreKit | bridge unit 已有；付费 UI fixture 新增 |
| B03 / P0 | Sandbox purchase 成功/pending/cancelled，App 切后台再前台 | 仅服务端验证后升级；pending 不发权益；关闭弹窗不打断必要恢复；返回刷新 | bridge/reference 已有，原生集成 |
| B04 / P0 | 换设备恢复、不同 PACE 账号恢复、重复 transaction、退款乱序 | 归属受控；重复无二次权益；更旧状态不覆盖新状态 | reference 已有，数据库/Apple 集成 |
| T01 / P1 | 全部运动折叠筛选、搜索中英标签、无结果、Escape、选择后 Going | 可发现全部目录；单选状态清晰；选后收起回焦点，Going 保持查询语义 | API/domain 与常规 E2E 已有；键盘新增 |
| T02 / P0 | 剩最后一名额，双用户同时 join；重复 join；leave/rejoin | 总人数不超容量；自己只占一席；Going 与详情一致；host 不能普通 leave | reference + API fixture 已有；数据库集成 |
| T03 / P0 | Free/Plus 未认证 host/Plus 已认证 host 创建；连续点提交 | 权限由后端判；一次创建；host 绑定 session；错误保留草稿 | reference + API fixture 已有；真实服务集成 |
| T04 / P1 | 活动取消/修改/开始时间已过/主办者被封，再打开详情或 join | 显示最新状态并禁用不合法操作；被取消活动不会继续出现在 upcoming | 部分错误码已有；完整生命周期集成 |
| T05 / P1 | 改设备时区、DST、长标题/地点，图片失败，list 网络恢复 | 时间正确、长内容不溢出；可重试；视觉保留活动文本 | 日期/重试部分已有；时区/坏图新增 |
| S01 / P0 | 删除账号取消/确认/500/异步删除处理中 | 取消零写入；失败不声称已删除；成功移除可见资料并撤销 session；进度明确 | 集成 |
| S02 / P0 | 删除后重启、旧 token 访问、数据导出、营销推送 | 不再恢复账号；公开数据按保留政策清理；注销后不再营销；留存/导出有明确契约 | unit 营销纯函数已有；其余集成 |
| S03 / P0 | 举报/拉黑/解除匹配，从 profile/chat/feed 进入 | 可达、可取消、有确认；写入后所有入口一致生效；不暴露被举报者给举报者的私密状态 | 集成；当前缺产品流程 |
| S04 / P1 | 推送关闭/允许/拒绝、前后台、点击通知、账号切换 | 指向正确授权会话/活动；不重复未读；锁屏隐私符合设置；拒绝也可正常使用 | 集成；当前仅空通知 toast |

## 测试用例：本地化、无障碍、韧性

| ID / 优先级 | 前置与步骤 | 必须达到的结果 | 覆盖状态 |
| --- | --- | --- | --- |
| L01 / P1 | en/zh/fr/es/de 遍历所有可达页、表单校验、失败/空/加载状态 | 除用户原文/品牌/约定单位外无英语遗漏；不出现 key 字符串 | 字典形状已有；页面遍历新增 |
| L02 / P1 | 最长德语/法语文案，200% 字体，中文 440×702 | 按钮/页签不截断关键动作，动态高度不挡提交，横向无溢出 | 新增 |
| L03 / P1 | 保存语言后退出/重启/新设备，数据 ID 跨语言往返 | 本设备记忆语言；后端 preference 若支持则跨设备一致；值不随显示语言变 | 本地存储已有实现；自动测试新增 |
| X01 / P1 | 键盘、屏幕阅读器检查所有输入/按钮/状态 | 可访问名称、错误关联、状态公告、focus 可见；颜色不是唯一状态提示 | 基础 DOM 检查已有；设备辅助技术新增 |
| X02 / P1 | 普通 modal / Plus / 评论 / match-success 循环 Tab、Shift+Tab、Escape | 焦点锁在当前 dialog、后台 inert；退出回触发器；不可跳到隐藏页 | 普通 modal 部分已有；全矩阵新增 |
| X03 / P1 | Chat/Profile/Edit tabs 用箭头键、Home/End、Tab | 符合 tabs 键盘行为、正确 tabindex/aria-selected/tabpanel 关系 | 新增 |
| X04 / P1 | 系统减少动态效果、键盘屏幕放大、深色原生 select | 不强制大量运动；原生下拉字与底色可辨；长表单仍可操作 | unit reduced motion 已有；视觉/设备新增 |
| R01 / P0 | 任意受保护请求返回 401/403/503/429，登入后到期 | 401 重新认证且清理私人旧状态；403 不误注销；503 可重试；429 按服务端等待时间提示 | session startup 部分已有；全局处理集成 |
| R02 / P1 | 慢网切 tab/关 modal/logout 后响应返回 | 迟到结果不能夺回界面、显示他人数据、重开已关闭弹窗或覆盖新请求 | startup/Train requestId 已有；其他功能新增 |
| R03 / P1 | discover/feed/profile 非 JSON/错误 schema/缺字段 | 控制错误边界和可恢复 UI，不静默用 demo 数据冒充真实数据 | transport error 部分已有；schema 新增 |
| R04 / P1 | 资源冷缓存/暖缓存、首次载入、版本升级、离线重开 | 不混用旧 JS/CSS；无白屏；离线状态明确；不把网络失败当 empty | cache stamp unit 已有；真实断网/升级新增 |
| R05 / P1 | 真机 portrait/landscape、safe area、键盘升降、后台恢复 | 导航不跳、输入/提交不被盖住，滚动位置合理，滚动不触发误 swipe | 仅部分尺寸 E2E 已有；真机新增 |
| R06 / P2 | 连续 20 次上传/取消/切页/打开会话，记录资源和控制台 | 无持续新增 event listener/未释放 object URL/报错；输入响应稳定 | 新增 |

## 验收顺序与交付记录

1. 本次先完成邀约入口视觉、提交对齐，用 I01–I02 在用户视口复核；不要为了通过截图而把真实错误隐藏。
2. 跑现有 94 项 Node 测试及语法；跑 36 项已有 E2E 前先检查文案 locator 与 snapshot。更新截图需人工确认，不得盲目覆盖。
3. 用户审阅后端清单、回答产品决策并明确授权后，为每个 P0 先写 API/数据库可失败测试，再写后端及前端接入，最后运行跨用户集成用例。
4. 发布门槛：所有 P0 通过；P1 已通过或有用户明确接受的限制；真机、支付 sandbox、通知、删除/隐私、可观测性有独立证据。当前 94/94 不能替代这些门槛。

建议每条执行记录保留：case ID、构建版本、环境/设备、测试数据、实际结果、证据文件、失败工单。没有实际执行的项目标“未运行”；依赖尚未确定的产品规则标“待决策”，不要用“通过”替代。
