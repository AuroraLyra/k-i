import type { McpServerConfig, McpToolDefinition } from '@/types/domain';

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {})
});

const stringProperty = (description: string) => ({ type: 'string', description });
const numberProperty = (description: string) => ({ type: 'number', description });
const recurrenceProperties = {
  repeat: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], description: '重复频率，默认不重复' },
  repeatInterval: { type: 'number', minimum: 1, maximum: 365, description: '重复间隔，默认 1' },
  repeatEndAt: stringProperty('ISO 8601 重复结束时间，可省略'),
  repeatCount: { type: 'number', minimum: 1, maximum: 999, description: '重复次数，可省略' },
  repeatWeekdays: { type: 'array', items: { type: 'number', minimum: 1, maximum: 7 }, description: '每周重复日，1 为周一、7 为周日' }
};

export const realityMcpTools: McpToolDefinition[] = [
  {
    name: 'get_device_status',
    title: '读取手机状态',
    description: '读取当前手机或浏览器的设备、系统、电量、网络和可用权限状态。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: false
  },
  {
    name: 'get_app_usage_access',
    title: '检查使用时长权限',
    description: '检查 Android 是否已允许 BabyLink 读取系统 App 使用情况；不会打开其他 App 或伪造统计。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: false
  },
  {
    name: 'request_app_usage_access',
    title: '授权使用时长',
    description: '打开 Android 官方“使用情况访问权限”设置，由用户亲自允许 BabyLink；不会自动授予权限。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: true
  },
  {
    name: 'get_app_usage',
    title: '读取 App 使用时长',
    description: '通过 Android UsageStatsManager 读取真实 App 前台使用时长、最后使用时间与包名，最多查询最近 31 天。',
    inputSchema: objectSchema({
      date: stringProperty('按本地日期查询，格式 YYYY-MM-DD'),
      from: stringProperty('ISO 8601 起始时间'),
      to: stringProperty('ISO 8601 结束时间'),
      days: { type: 'number', minimum: 1, maximum: 31, description: '未指定时间时按本地自然日查询，默认查询今天；指定多天时从对应日期零点开始' },
      limit: { type: 'number', minimum: 1, maximum: 200, description: '最多返回 App 数量，默认 50' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'get_app_usage_report',
    title: '生成 App 使用报告',
    description: '根据 Android 真实使用时长生成日/周汇总、分类占比、常用 App 与专注提醒建议。',
    inputSchema: objectSchema({
      days: { type: 'number', minimum: 1, maximum: 31, description: '按本地自然日统计的报告天数，默认 7；传 1 表示今天' },
      focusThresholdMinutes: { type: 'number', minimum: 15, maximum: 1440, description: '单 App 专注提醒阈值，默认 120 分钟' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'get_notification_inbox_access',
    title: '检查通知收件箱权限',
    description: '检查 Android 是否已由用户允许 BabyLink 读取系统通知；不会自动授权。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: false
  },
  {
    name: 'request_notification_inbox_access',
    title: '授权通知收件箱',
    description: '打开 Android 官方通知使用权设置，由用户亲自决定是否允许。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: true
  },
  {
    name: 'get_notification_inbox',
    title: '读取通知收件箱',
    description: '读取授权后保存在本机的近期通知摘要，可筛选快递、外卖、会议、出行、购物和消息；验证码会被遮盖。',
    inputSchema: objectSchema({
      days: { type: 'number', minimum: 1, maximum: 7, description: '查询最近天数，默认 1' },
      category: { type: 'string', enum: ['delivery', 'food', 'meeting', 'travel', 'shopping', 'message', 'other'], description: '可选分类' },
      limit: { type: 'number', minimum: 1, maximum: 200, description: '最多返回数量，默认 50' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'clear_notification_inbox',
    title: '清空通知收件箱',
    description: '经用户再次确认后，删除 BabyLink 在本机保存的通知摘要。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: true
  },
  {
    name: 'prepare_date_plan',
    title: '准备约会规划',
    description: '一次读取天气、当前位置和系统日历空闲时间，为后续地点搜索与路线规划准备真实上下文。',
    inputSchema: objectSchema({
      from: stringProperty('ISO 8601 查询起始时间，默认现在'),
      to: stringProperty('ISO 8601 查询结束时间，默认七天后'),
      durationMinutes: { type: 'number', minimum: 15, maximum: 1440, description: '约会所需分钟数，默认 120' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'prepare_trip_plan',
    title: '准备旅行规划',
    description: '一次读取目的时间段的天气、当前位置与系统日程，供角色继续组合 POI、路线和提醒。',
    inputSchema: objectSchema({
      from: stringProperty('ISO 8601 行程起始时间'),
      to: stringProperty('ISO 8601 行程结束时间')
    }),
    enabled: true,
    write: false
  },
  {
    name: 'prepare_shopping_plan',
    title: '准备购物对比',
    description: '读取当前剪贴板中的商品链接或口令，并给出平台搜索、比价和价格追踪的后续工具链。',
    inputSchema: objectSchema({
      query: stringProperty('想购买的商品或关键词'),
      budget: { type: 'number', minimum: 0, description: '可选预算' },
      targetPrice: { type: 'number', minimum: 0, description: '可选目标价' }
    }, ['query']),
    enabled: true,
    write: false
  },
  {
    name: 'prepare_study_session',
    title: '准备一起学习',
    description: '汇总真实 App 使用报告和待办提醒，为专注时长、音乐和休息节奏提供依据。',
    inputSchema: objectSchema({ days: { type: 'number', minimum: 1, maximum: 31, description: '回顾天数，默认 7' } }),
    enabled: true,
    write: false
  },
  {
    name: 'prepare_watch_together',
    title: '准备共同追剧',
    description: '读取系统日历空闲时间，为后续 B 站/网页内容搜索和一起观看安排提供真实时间段。',
    inputSchema: objectSchema({
      from: stringProperty('ISO 8601 查询起始时间，默认现在'),
      to: stringProperty('ISO 8601 查询结束时间，默认七天后'),
      durationMinutes: { type: 'number', minimum: 15, maximum: 480, description: '观看时长，默认 90 分钟' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'get_nightly_brief',
    title: '生成睡前日报素材',
    description: '一次汇总未来天气、明日日程、提醒、许可范围内的通知摘要和 App 使用报告。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: false
  },
  {
    name: 'set_cooking_timer',
    title: '设置烹饪计时器',
    description: '为烹饪步骤创建真实系统提醒；必须提供未来的分钟数。',
    inputSchema: objectSchema({ label: stringProperty('步骤名称'), minutes: { type: 'number', minimum: 1, maximum: 1440, description: '计时分钟数' } }, ['label', 'minutes']),
    enabled: true,
    write: true
  },
  {
    name: 'add_music_to_queue',
    title: '加入一起听队列',
    description: '把音乐 MCP 返回的歌曲与试听地址加入 BabyLink 当前播放队列；不会修改外部平台歌单。',
    inputSchema: objectSchema({
      id: stringProperty('平台歌曲 ID'),
      name: stringProperty('歌曲名'),
      artist: stringProperty('歌手'),
      album: stringProperty('专辑'),
      source: stringProperty('来源，例如 apple'),
      audioUrl: stringProperty('可播放或试听 HTTPS 地址'),
      coverUrl: stringProperty('封面 HTTPS 地址'),
      durationMs: numberProperty('歌曲时长，毫秒')
    }, ['id', 'name', 'audioUrl']),
    enabled: true,
    write: true
  },
  {
    name: 'notify_user',
    title: '发送手机通知',
    description: '在用户当前设备显示一条真实系统通知。',
    inputSchema: objectSchema({
      title: stringProperty('通知标题'),
      body: stringProperty('通知内容'),
      delayMinutes: numberProperty('延迟分钟数，省略则立即显示')
    }, ['title', 'body']),
    enabled: true,
    write: true
  },
  {
    name: 'speak_to_user',
    title: '对用户说话',
    description: '使用已配置的 TTS，或回退到设备浏览器语音朗读文本。',
    inputSchema: objectSchema({ text: stringProperty('要朗读的内容') }, ['text']),
    enabled: true,
    write: true
  },
  {
    name: 'vibrate_phone',
    title: '震动手机',
    description: '让当前手机执行一次轻微、标准或强烈的触觉反馈。',
    inputSchema: objectSchema({ style: { type: 'string', enum: ['light', 'medium', 'heavy'] } }),
    enabled: true,
    write: true
  },
  {
    name: 'set_reminder',
    title: '设置提醒',
    description: '仅在用户明确说“提醒我、通知我、闹钟、定时”时创建未来系统提醒；“备忘录、备忘、便签、笔记”绝对不要使用此工具。',
    inputSchema: objectSchema({
      title: stringProperty('提醒标题'),
      body: stringProperty('提醒内容'),
      at: stringProperty('ISO 8601 时间；与 delayMinutes 二选一'),
      delayMinutes: numberProperty('从现在开始的延迟分钟数'),
      repeat: recurrenceProperties.repeat
    }, ['title']),
    enabled: true,
    write: true
  },
  {
    name: 'list_reminders',
    title: '查看提醒',
    description: '仅查看提醒和通知任务；用户说“读取备忘录、查看备忘、便签或笔记”时绝对不要使用此工具，应使用 list_memos。',
    inputSchema: objectSchema({
      date: stringProperty('按本地日期查询，格式 YYYY-MM-DD'),
      from: stringProperty('ISO 8601 起始时间'),
      to: stringProperty('ISO 8601 结束时间'),
      includeExpired: { type: 'boolean', description: '是否包含已过期提醒' },
      includeCompleted: { type: 'boolean', description: '是否包含已完成提醒' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'update_reminder',
    title: '编辑提醒',
    description: '修改 BabyLink 提醒的标题、内容、时间或重复方式，并同步系统通知。',
    inputSchema: objectSchema({
      reminderId: stringProperty('提醒 ID'),
      title: stringProperty('新标题，可省略'),
      body: stringProperty('新内容，可省略'),
      at: stringProperty('新的 ISO 8601 时间'),
      delayMinutes: numberProperty('从现在开始的延迟分钟数'),
      repeat: recurrenceProperties.repeat
    }, ['reminderId']),
    enabled: true,
    write: true
  },
  {
    name: 'complete_reminder',
    title: '完成提醒',
    description: '将一个提醒标记为已完成，并取消对应的系统通知。',
    inputSchema: objectSchema({ reminderId: stringProperty('提醒 ID') }, ['reminderId']),
    enabled: true,
    write: true
  },
  {
    name: 'snooze_reminder',
    title: '稍后提醒',
    description: '把提醒推迟指定分钟数或推迟到指定时间，并重新安排系统通知。',
    inputSchema: objectSchema({
      reminderId: stringProperty('提醒 ID'),
      delayMinutes: numberProperty('推迟分钟数，默认 10 分钟'),
      at: stringProperty('新的 ISO 8601 时间，与 delayMinutes 二选一')
    }, ['reminderId']),
    enabled: true,
    write: true
  },
  {
    name: 'cancel_reminder',
    title: '取消提醒',
    description: '取消一个由 BabyLink 创建的设备提醒。',
    inputSchema: objectSchema({ reminderId: stringProperty('提醒 ID') }, ['reminderId']),
    enabled: true,
    write: true
  },
  {
    name: 'create_calendar_event',
    title: '创建系统日程',
    description: '获得系统许可后，直接在 Android 或 iOS 的系统日历 App 中创建未来事件；开始时间必须基于当前现实时间，不能写入过去的日期。',
    inputSchema: objectSchema({
      title: stringProperty('事件标题'),
      startAt: stringProperty('ISO 8601 开始时间'),
      endAt: stringProperty('ISO 8601 结束时间，可省略并默认一小时'),
      location: stringProperty('地点'),
      notes: stringProperty('备注'),
      isAllDay: { type: 'boolean', description: '是否全天日程' },
      ...recurrenceProperties
    }, ['title', 'startAt']),
    enabled: true,
    write: true
  },
  {
    name: 'get_calendar_events',
    title: '查看系统日程',
    description: '获得系统许可后，读取指定时间范围内的系统日历事件。',
    inputSchema: objectSchema({
      from: stringProperty('ISO 8601 起始时间'),
      to: stringProperty('ISO 8601 结束时间')
    }),
    enabled: true,
    write: false
  },
  {
    name: 'update_calendar_event',
    title: '修改系统日程',
    description: '使用系统事件 ID 修改日程标题、时间、地点、备注或重复规则；如果修改开始时间，新的时间必须基于当前现实时间且不能落在过去。',
    inputSchema: objectSchema({
      eventId: stringProperty('BabyLink 日程 ID 或系统事件 ID'),
      title: stringProperty('新标题，可省略'),
      startAt: stringProperty('新的 ISO 8601 开始时间'),
      endAt: stringProperty('新的 ISO 8601 结束时间'),
      location: stringProperty('新地点，可省略'),
      notes: stringProperty('新备注，可省略'),
      isAllDay: { type: 'boolean', description: '是否全天日程' },
      ...recurrenceProperties
    }, ['eventId']),
    enabled: true,
    write: true
  },
  {
    name: 'delete_calendar_event',
    title: '删除系统日程',
    description: '使用 BabyLink 日程 ID 或系统事件 ID 删除真实系统日历事件。',
    inputSchema: objectSchema({ eventId: stringProperty('BabyLink 日程 ID 或系统事件 ID') }, ['eventId']),
    enabled: true,
    write: true
  },
  {
    name: 'check_calendar_conflicts',
    title: '检查日程冲突',
    description: '读取系统日历并检查指定时间段是否与现有事件冲突。',
    inputSchema: objectSchema({
      startAt: stringProperty('ISO 8601 开始时间'),
      endAt: stringProperty('ISO 8601 结束时间'),
      excludeEventId: stringProperty('可排除的系统事件 ID')
    }, ['startAt', 'endAt']),
    enabled: true,
    write: false
  },
  {
    name: 'find_calendar_free_time',
    title: '查找空闲时间',
    description: '读取系统日历，在指定范围内查找满足时长的空闲时间段。',
    inputSchema: objectSchema({
      from: stringProperty('ISO 8601 查询起始时间'),
      to: stringProperty('ISO 8601 查询结束时间'),
      durationMinutes: { type: 'number', minimum: 1, maximum: 1440, description: '所需连续空闲分钟数' },
      limit: { type: 'number', minimum: 1, maximum: 20, description: '最多返回数量，默认 8' }
    }, ['from', 'to', 'durationMinutes']),
    enabled: true,
    write: false
  },
  {
    name: 'create_memo',
    title: '直接写入备忘录',
    description: '把标题和正文直接保存到 BabyLink 应用内备忘录。不会打开分享面板，不需要用户选择 App，不需要提醒时间、日程或通知；用户说“写入备忘录、记到备忘、保存便签”时只能使用此工具。',
    inputSchema: objectSchema({
      title: stringProperty('备忘录标题'),
      content: stringProperty('备忘录正文')
    }, ['content']),
    enabled: true,
    write: true
  },
  {
    name: 'list_memos',
    title: '读取备忘录',
    description: '直接读取 BabyLink 应用内已保存的备忘录，可按关键词筛选。用户说“读取、查看、搜索备忘录/备忘/便签/笔记”时使用此工具，绝对不要改用 list_reminders。',
    inputSchema: objectSchema({
      query: stringProperty('可选关键词；省略则读取最近备忘录'),
      limit: { type: 'number', minimum: 1, maximum: 100, description: '最多返回条数，默认 50' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'pick_contact',
    title: '选择联系人',
    description: '打开系统联系人选择器，由用户亲自选择一位联系人后返回姓名、电话和邮箱。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: false
  },
  {
    name: 'search_contacts',
    title: '搜索通讯录',
    description: '获得通讯录许可后，按姓名、电话或邮箱搜索联系人，最多返回二十条。',
    inputSchema: objectSchema({ query: stringProperty('搜索关键词') }, ['query']),
    enabled: true,
    write: false
  },
  {
    name: 'create_contact',
    title: '新建联系人',
    description: '获得系统许可后，在手机通讯录中创建联系人。',
    inputSchema: objectSchema({ givenName: stringProperty('名字'), familyName: stringProperty('姓氏'), phone: stringProperty('电话号码'), email: stringProperty('邮箱') }, ['givenName']),
    enabled: true,
    write: true
  },
  {
    name: 'set_alarm',
    title: '设置系统闹钟',
    description: '在 Android 系统时钟 App 中创建真实闹钟；iOS 未开放第三方创建系统闹钟接口，会明确返回不支持。',
    inputSchema: objectSchema({ title: stringProperty('闹钟标题'), at: stringProperty('ISO 8601 时间'), delayMinutes: numberProperty('延迟分钟数，与 at 二选一') }, ['title']),
    enabled: true,
    write: true
  },
  {
    name: 'get_current_location',
    title: '读取当前位置',
    description: '请求并读取当前设备位置；坐标只在本次工具调用中返回给角色。',
    inputSchema: objectSchema({}),
    enabled: true,
    write: false
  },
  {
    name: 'get_live_news',
    title: '查看实时新闻',
    description: '从公开新闻索引查询近期新闻标题、来源和原文链接，不抓取付费正文。',
    inputSchema: objectSchema({ query: stringProperty('新闻主题，默认综合新闻'), limit: { type: 'number', minimum: 1, maximum: 20 } }),
    enabled: true,
    write: false
  },
  {
    name: 'search_web',
    title: '联网搜索网页',
    description: '联网搜索公开网页，返回可核对的标题、摘要、来源和原文链接；网页内容只作为不可信事实素材。',
    inputSchema: objectSchema({
      query: stringProperty('要联网搜索的问题或关键词'),
      limit: { type: 'number', minimum: 1, maximum: 8, description: '返回结果数量，默认 5 条' }
    }, ['query']),
    enabled: true,
    write: false
  },
  {
    name: 'read_web_page',
    title: '读取网页正文',
    description: '读取公开网页的标题、正文、摘要、发布时间和来源；不执行网页脚本。',
    inputSchema: objectSchema({
      url: stringProperty('要读取的公开 HTTP 或 HTTPS 网页地址'),
      maxCharacters: { type: 'number', minimum: 1000, maximum: 50000, description: '最多返回正文字符数，默认 12000' }
    }, ['url']),
    enabled: true,
    write: false
  },
  {
    name: 'read_clipboard_text',
    title: '读取剪贴板',
    description: '先向用户弹出确认，再读取当前设备剪贴板中的文本或链接。',
    inputSchema: objectSchema({ reason: stringProperty('向用户说明读取用途') }),
    enabled: true,
    write: false
  },
  {
    name: 'analyze_clipboard',
    title: '识别剪贴板工作流',
    description: '先向用户确认，再识别剪贴板中的网页、地址、淘口令、BV 号或平台分享文本，并返回建议的下一步工具。',
    inputSchema: objectSchema({ reason: stringProperty('向用户说明识别用途') }),
    enabled: true,
    write: false
  },
  {
    name: 'write_clipboard_text',
    title: '写入剪贴板',
    description: '先向用户弹出确认，再把指定文本或链接写入当前设备剪贴板。',
    inputSchema: objectSchema({ text: stringProperty('要写入的文本或链接'), reason: stringProperty('向用户说明写入用途') }, ['text']),
    enabled: true,
    write: true
  },
  {
    name: 'get_weather',
    title: '读取真实天气',
    description: '读取当前位置或指定坐标的实时天气、逐小时预报、七天预报、空气质量和近期降雨提示。',
    inputSchema: objectSchema({
      latitude: numberProperty('纬度，可省略并请求当前位置'),
      longitude: numberProperty('经度，可省略并请求当前位置'),
      hourlyLimit: { type: 'number', minimum: 1, maximum: 72, description: '逐小时预报数量，默认 24' }
    }),
    enabled: true,
    write: false
  },
  {
    name: 'search_nearby_places',
    title: '在系统地图搜索地点',
    description: '打开用户手机默认地图 App 搜索地点、商店或公共设施，不读取地图 App 的私有结果。',
    inputSchema: objectSchema({
      query: stringProperty('地点或服务关键词'),
      latitude: numberProperty('搜索中心纬度，可省略'),
      longitude: numberProperty('搜索中心经度，可省略'),
      limit: { type: 'number', minimum: 1, maximum: 10, description: '最多返回数量' }
    }, ['query']),
    enabled: true,
    write: true
  },
  {
    name: 'open_map_route',
    title: '打开地图路线',
    description: '在手机系统地图 App 中打开目的地；只负责跳转，不自动开始导航或下单。',
    inputSchema: objectSchema({
      destination: stringProperty('目的地名称或地址'),
      latitude: numberProperty('目的地纬度，可选'),
      longitude: numberProperty('目的地经度，可选')
    }, ['destination']),
    enabled: true,
    write: true
  },
  {
    name: 'open_amap',
    title: '打开高德地图',
    description: '使用目的地、经纬度或搜索词打开高德地图；未安装时回退到高德网页。',
    inputSchema: objectSchema({ action: { type: 'string', enum: ['search', 'route'] }, keyword: stringProperty('地点、地址或搜索词'), latitude: numberProperty('目的地纬度，可选'), longitude: numberProperty('目的地经度，可选') }, ['action', 'keyword']),
    enabled: true,
    write: true
  },
  {
    name: 'open_mobile_app',
    title: '打开手机软件',
    description: '打开高德、淘宝、抖音、网易云音乐、QQ、小红书、日历、天气或系统设置并带入搜索词；不能读取或控制其他 App 页面。',
    inputSchema: objectSchema({ app: { type: 'string', enum: ['amap', 'taobao', 'douyin', 'netease_music', 'qq', 'xiaohongshu', 'calendar', 'weather', 'settings'] }, query: stringProperty('可选搜索词或账号') }, ['app']),
    enabled: true,
    write: true
  },
  {
    name: 'open_real_world_service',
    title: '打开现实服务',
    description: '打开已安装的电话、短信、邮件、地图、QQ 或小红书等现实服务。',
    inputSchema: objectSchema({
      service: { type: 'string', enum: ['phone', 'sms', 'email', 'maps', 'qq', 'xiaohongshu'] },
      value: stringProperty('号码、地址、邮件或搜索词')
    }, ['service']),
    enabled: true,
    write: true
  }
];

export const notificationInboxMcpTools: McpToolDefinition[] = realityMcpTools
  .filter((tool) => tool.name === 'get_notification_inbox_access' || tool.name === 'get_notification_inbox')
  .map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));

function cloneMcpTools(tools: McpToolDefinition[]) {
  return tools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));
}

export function createBuiltinRealityMcpServer(): McpServerConfig {
  return {
    id: 'mcp_reality_builtin',
    name: 'Reality MCP · 手机能力',
    kind: 'reality',
    description: '在当前设备执行联网搜索、通知、语音、提醒，以及经系统授权的日历、通讯录、天气与地图能力。',
    url: 'builtin://reality',
    headers: {},
    apiKey: '',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    enabled: true,
    globalEnabled: true,
    toolPolicy: 'all',
    timeoutMs: 45_000,
    tools: cloneMcpTools(realityMcpTools),
    protocolVersion: 'builtin',
    serverName: 'BabyLink Reality MCP',
    serverVersion: '1.0.0',
    lastStatus: 'connected',
    lastCheckedAt: 0,
    lastError: ''
  };
}

export function createBuiltinNotificationInboxMcpServer(): McpServerConfig {
  return {
    id: 'mcp_notification_inbox_builtin',
    name: '系统通知 MCP · 角色专用',
    kind: 'notification-inbox',
    description: '只读取当前 Android 设备上经授权保存在本机的系统通知摘要。默认不全局应用，请专门绑定给需要查看通知的角色。',
    url: 'builtin://notification-inbox',
    headers: {},
    apiKey: '',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    enabled: true,
    globalEnabled: false,
    toolPolicy: 'read-only',
    timeoutMs: 45_000,
    tools: cloneMcpTools(notificationInboxMcpTools),
    protocolVersion: 'builtin',
    serverName: 'BabyLink Notification Inbox MCP',
    serverVersion: '1.0.0',
    lastStatus: 'connected',
    lastCheckedAt: 0,
    lastError: ''
  };
}