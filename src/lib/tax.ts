/** Rules must be independently reviewed against the official manual for each exercise. */
export type AssetClass = "ACAO" | "FII" | "ETF" | "EXTERIOR";
export interface TaxRuleSet {
  exercise: number;
  calendarYear: number;
  assetClass: AssetClass;
  version: string;
  officialSource: string;
  validated: true;
  assess(input: unknown): unknown;
}
export class TaxRegistry {
  private rules = new Map<string, TaxRuleSet>();
  register(rule: TaxRuleSet) {
    if (
      rule.calendarYear !== rule.exercise - 1 ||
      !rule.officialSource.startsWith("https://www.gov.br/receitafederal/")
    )
      throw Error("Referência oficial e exercício incompatíveis");
    const key = `${rule.exercise}:${rule.assetClass}`;
    if (this.rules.has(key)) throw Error("Versão já registrada");
    this.rules.set(key, rule);
  }
  get(exercise: number, assetClass: AssetClass) {
    const rule = this.rules.get(`${exercise}:${assetClass}`);
    if (!rule)
      throw Error(
        `Regra fiscal não validada para ${assetClass}, exercício ${exercise}`,
      );
    return rule;
  }
}
// Intentionally empty: no unverified rates, codes, exemptions or foreign rules.
export const taxRegistry = new TaxRegistry();
