import { getWikiPage, setWikiPage, type WikiPage } from "./db";

/** 월간 리포트 키 (월 1회) */
function reportKey(month: string): string {
  return `report_${month}`;
}

/** 연간 리포트 키 (12월 종합) */
function yearlyKey(year: string): string {
  return `report_${year}_yearly`;
}

/** 저장된 월간 리포트 가져오기 */
export async function getReport(month: string): Promise<WikiPage | null> {
  const page = await getWikiPage(reportKey(month));
  return page ?? null;
}

/** 월간 리포트 저장 */
export async function saveReport(month: string, content: string): Promise<void> {
  await setWikiPage({
    key: reportKey(month),
    content,
    updatedAt: new Date().toISOString(),
    dirty: false,
  });
}

/** 저장된 연간 리포트 가져오기 */
export async function getYearlyReport(year: string): Promise<WikiPage | null> {
  const page = await getWikiPage(yearlyKey(year));
  return page ?? null;
}

/** 연간 리포트 저장 */
export async function saveYearlyReport(year: string, content: string): Promise<void> {
  await setWikiPage({
    key: yearlyKey(year),
    content,
    updatedAt: new Date().toISOString(),
    dirty: false,
  });
}
