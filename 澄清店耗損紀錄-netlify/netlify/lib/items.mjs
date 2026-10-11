// 預設品項：成本取自「2026 漲價」表的主食成本（單位：元／份）。
// 有 grams 的是「秤重品項」：記錄時輸入秤到的克數，金額 = 克數 ÷ 每份克數 × 每份成本。
// 其餘主食先照表上主食成本，按份計。
// floating = true 的品項（蔬菜）沒有固定單價，記錄時輸入每斤價格。
export const DEFAULT_ITEMS = [
  // 雞肉
  { id: "bbq-leg", name: "BBQ醬烤雞腿", cat: "雞肉", unit: "份", price: 21.5 },
  { id: "honey-leg", name: "炙烤蜜香雞腿", cat: "雞肉", unit: "份", price: 22.2 },
  { id: "braised-leg", name: "五香滷雞腿", cat: "雞肉", unit: "份", price: 19.5 },
  { id: "salt-breast", name: "海鹽雞胸", grams: 75, cat: "雞肉", unit: "份", price: 22.1, note: "表上 100g 為 29.5，現行 1 份 75g 換算" },
  { id: "salt-breast-xl", name: "重量海鹽胸", cat: "雞肉", unit: "份", price: 42.1 },
  { id: "sig-breast-xl", name: "重量招牌胸", cat: "雞肉", unit: "份", price: 42.3 },
  // 豬肉
  { id: "pork-loin", name: "香煎豬里肌", cat: "豬肉", unit: "份", price: 16.7 },
  { id: "basil-pork", name: "打拋豬", grams: 65, cat: "豬肉", unit: "份", price: 14.1 },
  { id: "ginger-pork", name: "薑汁燒肉", grams: 70, cat: "豬肉", unit: "份", price: 15.1 },
  // 海鮮・牛
  { id: "kabayaki", name: "慢烤蒲燒鯛", cat: "海鮮牛肉", unit: "份", price: 23.5 },
  { id: "mackerel", name: "薄鹽烤鯖魚", cat: "海鮮牛肉", unit: "份", price: 44.0 },
  { id: "salmon", name: "炙燒鮭魚菲力", cat: "海鮮牛肉", unit: "份", price: 67.7 },
  { id: "steak", name: "舒肥嫩牛排", cat: "海鮮牛肉", unit: "份", price: 96.7 },
  // 滑蛋系列
  { id: "egg", name: "滑蛋", grams: 100, cat: "滑蛋", unit: "份", price: 10.5 },
  { id: "egg-shrimp", name: "滑蛋蝦主食", grams: 45, cat: "滑蛋", unit: "份", price: 30.1 },
  { id: "egg-salmon", name: "滑蛋鮭魚主食", grams: 50, cat: "滑蛋", unit: "份", price: 15.9 },
  { id: "egg-beef", name: "滑蛋醬香牛主食", cat: "滑蛋", unit: "份", price: 22.2 },
  { id: "egg-chicken", name: "滑蛋和風雞主食", cat: "滑蛋", unit: "份", price: 19.1 },
  // 飯與配料
  { id: "rice-grain", name: "五穀飯", grams: 170, cat: "飯與配料", unit: "份", price: 3.5 },
  { id: "rice-purple", name: "紫米飯", grams: 170, cat: "飯與配料", unit: "份", price: 3.5 },
  { id: "soft-egg", name: "溏心蛋", cat: "飯與配料", unit: "顆", price: 11.0 },
  { id: "sweet-potato", name: "地瓜", cat: "飯與配料", unit: "份", price: 16.5 },
  { id: "light-veg", name: "健人輕蔬食", cat: "飯與配料", unit: "份", price: 15 },
  // 湯品飲品
  { id: "miso-soup", name: "鮭魚味噌湯", cat: "湯品飲品", unit: "份", price: 6.9 },
  { id: "milk-tea", name: "瓶裝奶茶", cat: "湯品飲品", unit: "瓶", price: 12.5 },
  { id: "soy-milk", name: "瓶裝豆漿", cat: "湯品飲品", unit: "瓶", price: 21.5 },
  { id: "cranberry", name: "瓶裝蔓越莓果醋", cat: "湯品飲品", unit: "瓶", price: 15.3 },
  { id: "white-fungus", name: "瓶裝銀耳湯", cat: "湯品飲品", unit: "瓶", price: 12.4 },
  // 蔬菜（輸入每斤價格）
  { id: "cabbage", name: "高麗菜", cat: "蔬菜", unit: "斤", price: null, floating: true },
  { id: "water-spinach", name: "空心菜", cat: "蔬菜", unit: "斤", price: null, floating: true },
  { id: "bok-choy", name: "青江菜", cat: "蔬菜", unit: "斤", price: null, floating: true },
  { id: "nylon-cabbage", name: "尼龍白", cat: "蔬菜", unit: "斤", price: null, floating: true },
  { id: "rape", name: "油菜", cat: "蔬菜", unit: "斤", price: null, floating: true },
].map((it, i) => ({ floating: false, grams: null, active: true, order: i + 1, ...it }));

export const CATEGORIES = ["雞肉", "豬肉", "海鮮牛肉", "滑蛋", "飯與配料", "湯品飲品", "蔬菜", "其他"];
