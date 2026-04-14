export const CATEGORIES = [
  "식비",
  "카페",
  "주류",
  "생활",
  "교통",
  "쇼핑",
  "문화",
  "기타",
] as const;

export type CategoryMajor = (typeof CATEGORIES)[number];

const KEYWORDS: Array<[RegExp, CategoryMajor]> = [
  [/커피|아메리카노|라떼|카푸|에스프레소|카페|스벅|스타벅스|이디야|투썸|메가|컴포즈|빽다방|할리스/i, "카페"],
  [/맥주|소주|와인|하이볼|칵테일|사케|막걸리|위스키|생맥|호프/i, "주류"],
  [/버스|지하철|택시|주유|기름|톨게이트|하이패스/i, "교통"],
  [/티셔츠|청바지|신발|가방|의류|원피스|자켓/i, "쇼핑"],
  [/영화|도서|서점|전시|공연|티켓/i, "문화"],
  [/생수|휴지|세제|샴푸|칫솔|치약|비누|화장지/i, "생활"],
];

export function guessCategory(name: string): CategoryMajor {
  for (const [re, cat] of KEYWORDS) {
    if (re.test(name)) return cat;
  }
  return "식비";
}
