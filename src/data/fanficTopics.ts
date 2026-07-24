import type { FanficTopic } from '@/types/domain';

export interface FanficGenreSection {
  id: string;
  label: string;
  description: string;
  topics: string[];
}

export interface FanficGenreGroup {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  sections: FanficGenreSection[];
}

const builtInCreatedAt = Date.UTC(2026, 6, 24);

function matrixSection(
  id: string,
  label: string,
  description: string,
  settings: string[],
  directions: string[]
): FanficGenreSection {
  return {
    id,
    label,
    description,
    topics: settings.flatMap((setting) => directions.map((direction) => `${setting} · ${direction}`))
  };
}

function namedSection(id: string, label: string, description: string, topics: string[]): FanficGenreSection {
  return { id, label, description, topics };
}

export const fanficGenreGroups: FanficGenreGroup[] = [
  {
    id: 'eastern-fantasy',
    label: '东方玄幻',
    shortLabel: '玄幻',
    description: '覆盖东方玄幻、异世大陆、高武、灵气复苏、御兽、家族与系统成长。',
    sections: [
      matrixSection('oriental-world', '东方世界', '从原创大陆、文明秩序和力量体系出发。', ['东方大陆', '万族边疆', '荒古遗迹', '神朝末世'], ['升级冒险', '权谋争霸']),
      matrixSection('otherworld', '异世大陆', '强调陌生世界规则、身份适应和双人探索。', ['异界城邦', '元素大陆', '浮空群岛', '地底文明'], ['生存开荒', '文明探索']),
      matrixSection('high-martial', '高武世界', '以武道社会、训练竞争和公开战绩推动成长。', ['现代高武', '武道学院', '全球武考', '星海武道'], ['热血升级', '团队竞技']),
      matrixSection('aura-revival', '灵气复苏', '超凡力量进入现实后重塑社会与个人选择。', ['都市复苏', '全民觉醒', '秘境降临', '古迹苏醒'], ['秩序重建', '调查成长']),
      matrixSection('beast-summon', '御兽召唤', '通过契约、培育、协作和生态规则展开。', ['御兽学院', '灵宠世界', '召唤文明', '异兽荒野'], ['培育进化', '赛事冒险']),
      matrixSection('clan-system', '家族与机制', '用家族、领地或机制形成长期成长反馈。', ['家族崛起', '宗族经营', '血脉文明', '领地传承'], ['经营建设', '规则升级'])
    ]
  },
  {
    id: 'wuxia-xianxia',
    label: '武侠仙侠',
    shortLabel: '仙侠',
    description: '覆盖传统武侠、国术、修真文明、凡人修仙、宗门与现代修真。',
    sections: [
      matrixSection('classic-wuxia', '传统武侠', '围绕江湖规矩、侠义选择和真实行动展开。', ['门派江湖', '镖局驿路', '武林盟会', '边城侠客'], ['恩怨追查', '行侠冒险']),
      matrixSection('martial-mystery', '武侠探案', '让武力、证据与江湖利益共同推动案件。', ['六扇门', '江湖奇案', '门派疑云', '武林密卷'], ['双人查案', '追逃破局']),
      matrixSection('mortal-cultivation', '凡人修仙', '从资源、功法和代价清楚的底层起点成长。', ['散修求道', '小镇修士', '矿脉杂役', '边荒仙城'], ['稳健成长', '秘境求生']),
      matrixSection('sect-cultivation', '宗门修行', '聚焦宗门制度、师承、任务和派系选择。', ['剑修宗门', '丹道仙门', '符阵学宫', '御剑山门'], ['宗门成长', '派系博弈']),
      matrixSection('cultivation-craft', '修真百艺', '用具体技艺和行业秩序建立修真生活。', ['炼丹工坊', '炼器商会', '阵法工程', '灵植庄园'], ['技艺升级', '产业经营']),
      matrixSection('modern-cultivation', '现代修真', '让修真规则与现代城市、机构和技术碰撞。', ['都市修真', '修真大学', '超凡管理局', '灵能研究所'], ['身份隐藏', '秩序调查'])
    ]
  },
  {
    id: 'fantasy-myth',
    label: '奇幻神话',
    shortLabel: '奇幻',
    description: '覆盖剑与魔法、史诗奇幻、魔法校园、神话民俗、蒸汽与宇宙恐怖。',
    sections: [
      matrixSection('sword-magic', '剑与魔法', '从原创种族、职业、地理和魔法代价出发。', ['冒险者公会', '边境王国', '地下迷城', '海岛诸国'], ['组队远征', '势力争霸']),
      namedSection('magic-academy', '魔法校园', '以课程、试炼、社团和魔法社会规则推动成长。', ['魔法校园', '魔法学院 · 入学试炼', '魔法学院 · 社团竞赛', '魔法学院 · 禁术调查', '魔法学院 · 城市实习', '魔法学院 · 校际联赛', '魔法学院 · 遗迹考察', '魔法学院 · 毕业远征']),
      matrixSection('epic-fantasy', '史诗奇幻', '围绕文明冲突、长期使命和群体选择展开。', ['失落王国', '群岛史诗', '北境长夜', '诸国联盟'], ['文明战争', '远征建国']),
      matrixSection('myth-folklore', '神话民俗', '从原创地域文化、仪式和传说规则出发。', ['东方神话', '地方民俗', '山海异兽', '古老祭仪'], ['神明契约', '传说调查']),
      matrixSection('steam-alchemy', '蒸汽炼金', '让工业、炼金、阶层和城市系统彼此影响。', ['蒸汽都市', '炼金工厂', '机械王国', '飞艇时代'], ['技术革命', '工业冒险']),
      matrixSection('weird-fantasy', '诡秘奇幻', '使用可理解、有边界的未知规则制造压迫与探索。', ['雾都秘社', '深海古城', '梦境边界', '星空遗迹'], ['宇宙恐怖', '理智调查'])
    ]
  },
  {
    id: 'science-apocalypse',
    label: '科幻末世',
    shortLabel: '科幻',
    description: '覆盖星际、机甲、赛博朋克、人工智能、时空、进化与末日求生。',
    sections: [
      namedSection('space-civilization', '星际文明', '以航行、文明、资源和政治选择拓展世界。', ['星际军校', '星际文明 · 舰队远征', '星际文明 · 殖民开拓', '星际文明 · 外交危机', '星际文明 · 边境贸易', '星际文明 · 遗迹探索', '星际文明 · 文明接触', '星际文明 · 太空救援']),
      matrixSection('mecha-war', '机甲与战争', '强调驾驶、工程、战术和团队协作。', ['机甲学院', '轨道战场', '深空舰队', '行星防线'], ['战术竞技', '战争救援']),
      matrixSection('cyberpunk', '赛博朋克', '从技术垄断、身份边界和城市生存展开。', ['霓虹都市', '义体社会', '数据边城', '虚拟贫民区'], ['黑客调查', '公司反抗']),
      matrixSection('ai-future', '人工智能', '讨论智能、劳动、权利和人与技术的共同选择。', ['智能城市', '机器人社会', '算法治理', '数字人格'], ['伦理调查', '共生危机']),
      matrixSection('time-space', '时空与维度', '用清楚可追踪的时空机制推动因果选择。', ['时间工程', '平行宇宙', '维度裂缝', '记忆宇宙'], ['因果修复', '时空探险']),
      namedSection('apocalypse-survival', '末日求生', '强调资源、路线、组织和阶段性生存成果。', ['末世基建流', '自然灾变 · 城市求生', '感染危机 · 安全区建设', '废土世界 · 聚落经营', '极寒末日 · 物资协作', '海洋末世 · 舰船生存', '地下避难所 · 文明重启', '生态崩溃 · 方舟计划'])
    ]
  },
  {
    id: 'urban-workplace',
    label: '都市职场',
    shortLabel: '都市',
    description: '覆盖职场、创业、专业行业、校园、传媒、都市异能与现实竞争。',
    sections: [
      namedSection('workplace-career', '职场成长', '以专业目标、团队协作和组织规则推进。', ['职场搞事业', '职场成长 · 项目攻坚', '职场成长 · 行业转型', '职场成长 · 危机公关', '职场成长 · 团队管理', '职场成长 · 职业转型', '职场成长 · 跨国合作', '职场成长 · 公共项目']),
      matrixSection('business-startup', '商业创业', '围绕产品、现金流、市场与组织成长展开。', ['科技创业', '实体产业', '品牌零售', '文化创业'], ['从零起步', '商战竞争']),
      matrixSection('professional-field', '专业行业', '用职业行动、伦理边界和真实问题塑造人物。', ['医疗急救', '法律实务', '建筑工程', '科研攻关'], ['职业成长', '行业调查']),
      matrixSection('media-entertainment', '传媒文娱', '关注创作、制作、舞台和公众评价。', ['影视制作', '音乐现场', '出版编辑', '网络媒体'], ['作品逆袭', '幕后成长']),
      matrixSection('urban-superpower', '都市异能', '让超常能力与现代机构和现实秩序发生冲突。', ['异能组织', '都市灵气', '秘密档案', '超常事务所'], ['能力成长', '城市调查']),
      matrixSection('campus-growth', '校园成长', '围绕学习、社团、竞赛和人生选择展开。', ['高中校园', '大学社团', '艺术院校', '职业学院'], ['青春成长', '竞赛合作'])
    ]
  },
  {
    id: 'real-life',
    label: '现实生活',
    shortLabel: '现实',
    description: '覆盖市井、小城、年代、家庭、公共议题、非遗与普通人的具体生活。',
    sections: [
      matrixSection('city-daily', '城市日常', '从住房、工作、邻里和生活账单建立现实质感。', ['都市合租', '老城社区', '青年公寓', '城市夜班'], ['生活重建', '邻里群像']),
      matrixSection('small-town', '小城与返乡', '以地方产业、人情网络和个人选择推动变化。', ['返乡青年', '海边小城', '山地县城', '边境小镇'], ['家乡创业', '社区更新']),
      matrixSection('period-life', '年代生活', '关注时代变迁中的家庭、职业和生活改善。', ['七十年代', '八十年代', '九十年代', '千禧年代'], ['生活经营', '人生重启']),
      matrixSection('family-story', '家庭故事', '用责任、边界和共同生活处理代际关系。', ['三代同堂', '重组家庭', '异地家庭', '新手父母'], ['关系重建', '共同成长']),
      matrixSection('public-issues', '公共议题', '以具体行动面对公共问题，不写空泛观点。', ['城市更新', '乡村教育', '环境保护', '公益救援'], ['项目实践', '现实调查']),
      matrixSection('craft-culture', '文化与手艺', '让非遗、艺术和地方文化进入真实生活。', ['文物修复', '传统曲艺', '民间工艺', '地方戏剧'], ['技艺传承', '文化创新'])
    ]
  },
  {
    id: 'history-military',
    label: '历史军事',
    shortLabel: '历史',
    description: '覆盖历代社会、朝堂治理、经营建设、战争谍报、架空历史与文明交流。',
    sections: [
      matrixSection('ancient-periods', '历代风云', '选择时代感，具体人物、政权和事件保持原创。', ['先秦列国', '秦汉帝国', '魏晋南北', '隋唐盛世'], ['社会变革', '人物沉浮']),
      matrixSection('later-periods', '近世变局', '关注制度、商贸、城市与新旧秩序冲突。', ['宋元市井', '明代海贸', '清代边疆', '民国城市'], ['时代经营', '危局求生']),
      matrixSection('court-governance', '朝堂治理', '围绕改革、财政、司法和地方治理展开。', ['朝堂新政', '地方官场', '边疆治理', '外交使团'], ['制度改革', '权谋博弈']),
      namedSection('history-management', '历史经营', '用生产、商贸、工程和组织成果推动历史故事。', ['历史经营', '古代商路 · 市场开拓', '古代工坊 · 技术升级', '古代水利 · 民生建设', '古代港口 · 海贸经营', '古代书院 · 教育改革', '古代医馆 · 公共救治', '古代城镇 · 灾后重建']),
      matrixSection('war-strategy', '战争与军旅', '从战术、后勤、救援和普通人选择书写战争。', ['边城防线', '海疆舰队', '山地战场', '战地医院'], ['军事谋略', '后勤救援']),
      matrixSection('alternate-civilization', '架空与文明', '从一个原创变量推演制度、技术和文明关系。', ['架空王朝', '技术革命', '文明碰撞', '历史岔路'], ['制度实验', '世界推演'])
    ]
  },
  {
    id: 'mystery-infinite',
    label: '悬疑无限',
    shortLabel: '悬疑',
    description: '覆盖刑侦、本格、社会派、灵异、规则怪谈、无限流与冒险探索。',
    sections: [
      matrixSection('detective-case', '刑侦探案', '用证据链、时间线和合理动机完成查证。', ['刑侦支队', '法医中心', '民间侦探', '失踪调查组'], ['连环案件', '单元案件']),
      matrixSection('classic-mystery', '本格推理', '围绕公平线索、空间结构和逻辑反转展开。', ['密室谜案', '孤岛案件', '列车疑云', '庄园谜局'], ['限时推理', '多人博弈']),
      matrixSection('social-suspense', '社会派悬疑', '从现实利益、制度盲点和人物处境建立谜团。', ['都市暗线', '网络舆论', '家庭秘密', '行业黑幕'], ['现实调查', '证据反转']),
      matrixSection('supernatural-mystery', '灵异惊悚', '未知现象必须有稳定规则、调查路径和后果。', ['都市异闻', '民俗怪谈', '废弃建筑', '深夜档案'], ['超常调查', '生存解谜']),
      namedSection('rules-infinite', '规则与无限', '使用边界清楚、可推理、会付出代价的原创规则。', ['规则怪谈', '无限流 · 生存副本', '无限流 · 解谜副本', '无限流 · 团队闯关', '规则世界 · 城市求生', '规则世界 · 职业试炼', '梦境副本 · 记忆迷宫', '世界跳跃 · 任务修复']),
      matrixSection('adventure-treasure', '冒险探索', '以路线、环境、知识和团队决策推动探索。', ['荒野遗迹', '深海沉船', '极地科考', '地下古城'], ['寻宝探险', '科学考察'])
    ]
  },
  {
    id: 'games-sports',
    label: '游戏体育',
    shortLabel: '竞技',
    description: '覆盖网游、全息、电竞、游戏开发、球类、极限运动、棋类与赛车。',
    sections: [
      matrixSection('online-games', '网游世界', '围绕职业、团队、版本规则和玩家社区展开。', ['大型网游', '策略网游', '生存网游', '沙盒网游'], ['公会成长', '职业竞技']),
      matrixSection('virtual-games', '全息与虚拟', '关注沉浸规则、虚实边界和玩家选择。', ['全息世界', '虚拟都市', '意识游戏', '数字乐园'], ['副本冒险', '身份调查']),
      matrixSection('esports', '电子竞技', '强调训练、战术、团队磨合和公开赛果。', ['职业联赛', '高校联赛', '新队组建', '老将复出'], ['赛季夺冠', '团队成长']),
      matrixSection('game-industry', '游戏行业', '从开发、发行、运营和玩家反馈写行业故事。', ['独立游戏', '大型项目', '游戏平台', '电竞俱乐部'], ['创业制作', '行业竞争']),
      matrixSection('ball-sports', '球类运动', '用训练、比赛和团队角色形成持续回报。', ['足球联赛', '篮球联赛', '排球赛场', '冰球赛场'], ['职业成长', '校园竞技']),
      matrixSection('other-sports', '综合竞技', '覆盖个人项目、户外项目和智力竞技。', ['赛车运动', '极限运动', '棋类竞技', '格斗赛事'], ['世界巡回', '逆袭夺冠'])
    ]
  },
  {
    id: 'romance-relationships',
    label: '爱情关系',
    shortLabel: '情感',
    description: '覆盖古今爱情、慢热、竞争、重逢、婚恋、幻想关系与多元双人关系。',
    sections: [
      matrixSection('mutual-attraction', '相识与心动', '通过共同事件、有效对话和边界变化推进感情。', ['双向暗恋', '欢喜冤家', '日久生情', '一见倾心'], ['慢热拉扯', '轻松甜恋']),
      matrixSection('adult-romance', '成年人关系', '处理职业、生活、责任和亲密边界。', ['都市恋爱', '职场恋爱', '异地关系', '共同创业'], ['现实磨合', '双向成长']),
      matrixSection('marriage-contract', '婚恋与契约', '关系安排必须连接外部目标，不能只靠误会拖延。', ['先婚后爱', '契约关系', '家族联姻', '相亲相识'], ['规则磨合', '共同破局']),
      matrixSection('reunion-repair', '重逢与修复', '用旧问题、现实变化和新选择重建关系。', ['久别重逢', '破镜重圆', '误会澄清', '第二次机会'], ['共同疗愈', '关系重建']),
      matrixSection('strong-rivals', '强强与竞争', '让双方拥有同等能力、目标和叙事重量。', ['强强联合', '宿敌合作', '同业竞争', '亦敌亦友'], ['相爱相杀', '并肩成长']),
      matrixSection('fantasy-romance', '幻想关系', '让感情与原创世界规则、使命和代价同时推进。', ['仙侠情缘', '西幻罗曼', '星际恋爱', '都市奇缘'], ['命运反抗', '共同冒险'])
    ]
  },
  {
    id: 'no-romance-ensemble',
    label: '无 CP 群像',
    shortLabel: '无CP',
    description: '明确提供纯事业、知己、战友、友情、亲情、团队与群像方向，不设置恋爱线。',
    sections: [
      matrixSection('career-partners', '纯事业搭档', '双主角以共同事业、方法分歧和结果承担推进关系。', ['职场事业', '科研项目', '商业创业', '公共治理'], ['无 CP · 能力升级', '无 CP · 伙伴成长']),
      matrixSection('investigation-partners', '调查搭档', '以证据、专业互补和共同责任建立信任。', ['刑侦搭档', '记者组合', '历史调查', '超常调查'], ['无 CP · 单元案件', '无 CP · 长线谜局']),
      matrixSection('comrades', '战友同盟', '用任务、救援、守诺和共同代价塑造羁绊。', ['边防战友', '冒险小队', '末日同盟', '星际舰组'], ['无 CP · 生死任务', '无 CP · 团队成长']),
      matrixSection('friendship', '友情知己', '围绕人生选择、长期陪伴和彼此成就展开。', ['少年挚友', '成年知己', '旅途伙伴', '邻里朋友'], ['无 CP · 共同成长', '无 CP · 人生重建']),
      matrixSection('family-bonds', '亲情家园', '用家庭责任、代际边界和共同生活推动故事。', ['兄弟姐妹', '重组家庭', '代际关系', '共同养育'], ['无 CP · 家庭重建', '无 CP · 家园守护']),
      matrixSection('ensemble-growth', '群像成长', '双主角保持核心地位，同时让团队成员拥有合理目标。', ['创业团队', '校园社团', '求生小队', '社区群像'], ['无 CP · 多线成长', '无 CP · 共同目标'])
    ]
  },
  {
    id: 'management-special',
    label: '经营特色',
    shortLabel: '特色',
    description: '覆盖种田、经营、基建、美食、萌宠、治愈、时间结构与类型实验。',
    sections: [
      matrixSection('farming-life', '种田生活', '通过劳作、社区、生产和生活改善形成回报。', ['古代田园', '现代农场', '海岛生活', '山居日常'], ['种田经营', '家园建设']),
      matrixSection('shop-management', '店铺经营', '围绕产品、客人、现金流和口碑长期成长。', ['餐馆小店', '旅店民宿', '书店咖啡馆', '奇幻商铺'], ['从零经营', '行业竞争']),
      matrixSection('infrastructure', '基建发展', '用资源、组织、工程和阶段成果推动成长。', ['领地建设', '城市更新', '灾后重建', '异界基建'], ['产业升级', '文明发展']),
      matrixSection('food-craft', '美食手艺', '让具体技艺、经营问题和人物连接共同推进。', ['中华料理', '烘焙甜点', '地方小吃', '传统手艺'], ['技艺成长', '赛事经营']),
      matrixSection('animals-ecology', '动物生态', '围绕照护、生态、自然环境和人与动物协作展开。', ['宠物日常', '动物救助', '自然保护', '野外观察'], ['治愈陪伴', '职业成长']),
      matrixSection('narrative-form', '结构与脑洞', '使用清楚可追踪的结构机制，不用形式替代剧情。', ['时间循环', '平行世界', '身份交换', '记忆重置'], ['因果解谜', '人生选择'])
    ]
  },
  {
    id: 'ancient-romance',
    label: '古代言情',
    shortLabel: '古言',
    description: '补充宫廷侯爵、宅斗家长里短、穿越重生、种田经商、女强权谋与古代婚恋。',
    sections: [
      matrixSection('palace-nobility', '宫廷侯爵', '围绕宫廷、王府、世家秩序和公开选择推进关系。', ['宫廷成长', '王府日常', '侯门世家', '公主事业'], ['权谋爱情', '双强成长']),
      matrixSection('household-family', '宅斗家长里短', '将宅院规则、家庭资源和生活经营写成具体行动。', ['侯府宅院', '商户人家', '乡绅家族', '重组宗族'], ['宅斗经营', '家业守护']),
      matrixSection('ancient-transmigration', '穿越与重生', '身份变化只作为起点，后续靠人物选择改写处境。', ['古代穿越', '古代重生', '穿书古言', '魂穿异世'], ['逆袭成长', '命运改写']),
      matrixSection('ancient-farming', '古言种田经商', '通过生产、商贸、手艺和家庭协作形成回报。', ['农家种田', '古代开店', '药膳美食', '商路经营'], ['发家致富', '日常甜恋']),
      matrixSection('female-power', '女强与权谋', '让双方都拥有目标、能力和公开决策权。', ['女官仕途', '摄政掌局', '女将征战', '商界女主'], ['强强联合', '事业爱情']),
      matrixSection('ancient-marriage', '古代婚恋', '婚约、身份和礼法必须连接可推进的外部事件。', ['先婚后爱古言', '青梅竹马古言', '破镜重圆古言', '欢喜冤家古言'], ['细水长流', '高甜互动']),
      matrixSection('palace-household', '宫斗与宅斗', '让宫廷或宅院冲突建立在制度、资源和人物目标上。', ['后宫生存', '冷宫逆袭', '嫡庶宅斗', '继母掌家'], ['宫廷博弈', '家业经营']),
      matrixSection('qing-republic', '清穿与民国', '利用时代约束推动选择，不复刻真实人物和现成历史剧情。', ['清穿王府', '清穿宫廷', '民国世家', '民国商战'], ['时代爱情', '命运改写'])
    ]
  },
  {
    id: 'modern-female',
    label: '现代言情',
    shortLabel: '现言',
    description: '补充豪门世家、婚恋契约、娱乐圈、业界精英、年代生活和萌宝家庭。',
    sections: [
      matrixSection('wealthy-family', '豪门世家', '身份与资源差异必须落实为现实选择，双方保持平等主体性。', ['豪门继承', '世家联姻', '资本家族', '名流社交'], ['商战爱情', '身份反差']),
      matrixSection('modern-marriage', '婚恋契约', '从边界明确的关系安排和共同问题推进感情。', ['先婚后爱现言', '契约婚姻', '相亲婚恋', '闪婚日常'], ['婚后磨合', '双向奔赴']),
      matrixSection('entertainment-romance', '娱乐圈爱情', '兼顾作品生产、舆论环境和双方事业成长。', ['演员与制作人', '歌手与创作者', '综艺搭档', '导演与编剧'], ['事业逆袭', '公开恋情']),
      matrixSection('industry-elite', '业界精英', '通过专业协作、行业竞争和职业伦理建立关系。', ['医生恋爱', '律师恋爱', '科研恋爱', '金融职场'], ['强强合作', '职场婚恋']),
      matrixSection('female-period', '年代现言', '关注时代机会、家庭生活和女性成长，不复刻固定年代模板。', ['七零生活', '八零创业', '九零成长', '千禧婚恋'], ['年代经营', '人生逆袭']),
      matrixSection('children-family', '萌宝与家庭', '儿童角色服务家庭成长，不作为强行撮合工具。', ['共同养育', '重组家庭现言', '亲子综艺', '家庭治愈'], ['萌宝日常', '关系重建']),
      matrixSection('modern-brainstorm', '现言脑洞', '能力或机制只改变条件，不替人物完成感情和事业选择。', ['都市读心', '人生预知', '现代重生', '任务系统'], ['都市逆袭', '甜宠成长']),
      matrixSection('persona-live', '马甲与直播', '围绕网络身份、公众表达和现实边界设计掉马过程。', ['多重马甲', '生活直播', '恋爱综艺', '网络红人'], ['掉马互动', '事业爱情'])
    ]
  },
  {
    id: 'youth-female',
    label: '青春甜宠',
    shortLabel: '青春',
    description: '补充校园甜宠、青梅竹马、暗恋成长、竞赛学霸、直播社交和治愈陪伴。',
    sections: [
      matrixSection('campus-sweet', '校园甜宠', '以课程、社团和具体成长任务承载青春关系。', ['高中同桌', '大学社团', '艺术校园', '体育校园'], ['青春甜恋', '共同成长']),
      matrixSection('childhood-friends', '青梅竹马', '用成长阶段、现实变化和重新认识推进关系。', ['邻家竹马', '同城成长', '久别竹马', '家属院伙伴'], ['双向暗恋', '重逢心动']),
      matrixSection('secret-crush', '暗恋成真', '暗恋必须通过行动、信息变化和明确选择得到推进。', ['校园暗恋', '职场暗恋', '朋友暗恋', '对手暗恋'], ['双向试探', '勇敢告白']),
      matrixSection('academic-competition', '学霸与竞赛', '把学习、竞赛和人生目标写成有效主线。', ['理科竞赛', '辩论联赛', '创业大赛', '艺术竞演'], ['并肩夺冠', '竞争心动']),
      matrixSection('live-social', '直播与社交', '处理网络身份、公众表达和现实关系的边界。', ['校园直播', '知识博主', '游戏主播', '旅行账号'], ['掉马互动', '共同创作']),
      matrixSection('youth-healing', '青春治愈', '用具体陪伴和现实改善书写恢复，不美化伤害。', ['转学新生', '低谷少年', '小城青春', '毕业迷茫'], ['互相救赎', '温暖成长']),
      matrixSection('favorite-charisma', '团宠与万人迷', '让受欢迎来自实际行动和关系积累，避免全员无条件降智。', ['团队团宠', '成长万人迷', '真假千金', '恶役自救'], ['群像成长', '反套路甜恋']),
      matrixSection('comedy-romance', '轻喜与沙雕', '用人物目标和自然互动制造喜剧，不靠重复网络梗刷屏。', ['沙雕恋爱', '反套路关系', '吐槽役日常', '社恐社牛'], ['爆笑日常', '欢喜互动'])
    ]
  },
  {
    id: 'female-fantasy',
    label: '幻想言情',
    shortLabel: '幻言',
    description: '补充穿书快穿、仙侠奇缘、西幻罗曼、星际虫族、末世囤货与玄学灵异。',
    sections: [
      matrixSection('book-quick-travel', '穿书与快穿', '任务机制边界清楚，每个世界都要有完整行动与结果。', ['穿书自救', '快穿任务', '炮灰改命', '角色觉醒'], ['世界修复', '关系改写']),
      matrixSection('xianxia-romance-female', '仙侠奇缘', '感情与修行、门派、使命和力量代价同步推进。', ['仙门师徒', '剑修道侣', '神魔宿命', '人妖殊途'], ['强强修行', '虐恋救赎']),
      matrixSection('western-romance-female', '西幻罗曼', '从原创王国、种族与魔法秩序建立关系冲突。', ['骑士公主', '龙族契约', '魔法贵族', '精灵旅途'], ['冒险爱情', '宫廷罗曼']),
      matrixSection('space-female', '星际与虫族', '围绕文明、军校、种族和生存规则展开平等双主角关系。', ['星际军校言情', '虫族社会', '哨向世界', '机甲联赛言情'], ['强强并肩', '身份逆袭']),
      matrixSection('apocalypse-female', '末世与囤货', '突出资源决策、家园建设和共同承担，不把求生写成背景板。', ['末世囤货', '天灾求生', '废土种田', '安全区经营'], ['生存爱情', '基建成长']),
      matrixSection('metaphysics-romance', '玄学与灵异', '超自然规则可验证，感情建立在共同调查和守护上。', ['玄学直播', '灵异事务所', '民俗调查', '都市捉妖'], ['单元探案', '奇缘爱情']),
      matrixSection('diverse-worlds', '多元世界设定', '把性别、感知、种族和社会规则写清楚，保持双方主体性。', ['ABO 世界', '哨向世界观', '虫族文明', '女尊社会'], ['社会规则', '强强关系']),
      matrixSection('beast-otherkin', '兽世与异族', '通过原创生态、族群制度和生存合作建立关系。', ['兽世部落', '血族城市', '人外世界', '异族边境'], ['生存经营', '奇缘关系'])
    ]
  }
];

function emptyCommercialSeed() {
  return {
    openingProblem: '',
    immediateGoal: '',
    escalation: '',
    readerPromise: ''
  };
}

export const builtInFanficTopics: FanficTopic[] = fanficGenreGroups.flatMap((group, groupIndex) =>
  group.sections.flatMap((section, sectionIndex) =>
    section.topics.map((title, topicIndex) => ({
      id: `fanfic_topic_${groupIndex + 1}_${sectionIndex + 1}_${topicIndex + 1}`,
      source: 'built-in' as const,
      title,
      hook: section.description,
      setting: '',
      conflict: '',
      relationship: '',
      tags: [group.shortLabel, section.label, title],
      trendKeywords: [],
      categoryId: group.id,
      categoryLabel: group.label,
      subcategory: section.label,
      builtIn: true,
      commercialSeed: emptyCommercialSeed(),
      createdAt: builtInCreatedAt
    }))
  )
);
