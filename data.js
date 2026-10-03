/* ============================================================
 * 家庭大字体电话本 —— 联系人数据
 * 由本地网页的「编辑」功能写入，时间：2026-10-04 01:12:46
 *
 * 照片已经压缩并内嵌在里面，不需要额外的图片文件。
 * 想让长辈看到，把改动推送到 GitHub：
 *   cd E:\网页试验\test2
 *   git add -A
 *   git commit -m "更新联系人"
 *   git push
 * ============================================================ */

const CONTACTS = [
  {"group": "家人", "relation": "大女儿", "name": "王丽", "phone": "13800000002", "emoji": "👩", "photo": "", "note": "周末回家"},
  {"group": "家人", "relation": "小儿子", "name": "王强", "phone": "13800000003", "emoji": "👨", "photo": "", "note": "白天开会，尽量晚上打"},
  {"group": "家人", "relation": "妹妹", "name": "王秀英", "phone": "13800000005", "emoji": "👵", "photo": "", "note": "住在城南"},
  {"group": "医生", "relation": "家庭医生", "name": "张医生", "phone": "13800000006", "emoji": "🩺", "photo": "", "note": "市一院 全科门诊"},
  {"group": "医生", "relation": "心内科", "name": "刘医生", "phone": "13800000007", "emoji": "💊", "photo": "", "note": "每月 10 号复查"},
  {"group": "医生", "relation": "牙科", "name": "陈医生", "phone": "13800000008", "emoji": "🦷", "photo": "", "note": "看牙、洗牙都找他"},
  {"group": "物业", "relation": "小区物业", "name": "值班室", "phone": "075512345678", "emoji": "🏢", "photo": "", "note": "24 小时有人接"},
  {"group": "物业", "relation": "物业维修", "name": "王师傅", "phone": "13800000009", "emoji": "🔧", "photo": "", "note": "水、电、网报修"},
  {"group": "快递", "relation": "快递驿站", "name": "菜鸟驿站", "phone": "13800000010", "emoji": "📦", "photo": "", "note": "早 8 点到晚 8 点"},
  {"group": "家人", "relation": "老妈", "name": "吴素勉", "phone": "13599790679", "emoji": "👤", "photo": "", "note": "无"},
  {"group": "家人", "relation": "父亲", "name": "彭", "phone": "1111111", "emoji": "👤", "photo": "", "note": ""},
];

/* 分类在页面上的先后顺序 */
const DEFAULT_GROUP_ORDER = ["家人", "医生", "物业", "快递"];

/* 数据最后更新时间，页面上会显示，方便核对手机是不是拿到了最新的一份 */
const DATA_UPDATED = "2026-10-04 01:12:46";
