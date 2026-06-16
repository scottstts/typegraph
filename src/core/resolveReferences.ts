import type { Symbol } from "ts-morph";
import type { ts } from "ts-morph";

export type SymbolIdMap = Map<ts.Symbol, string>;

export function registerSymbol(
  symbol: Symbol | undefined,
  id: string,
  symbolIds: SymbolIdMap
): void {
  if (symbol === undefined) {
    return;
  }

  symbolIds.set(symbol.compilerSymbol, id);
  symbolIds.set(symbol.getExportSymbol().compilerSymbol, id);
}

export function resolveSymbolId(
  symbol: Symbol | undefined,
  symbolIds: SymbolIdMap
): string | undefined {
  if (symbol === undefined) {
    return undefined;
  }

  const candidates: Symbol[] = [symbol, symbol.getExportSymbol()];
  const alias = symbol.getAliasedSymbol();
  if (alias !== undefined) {
    candidates.push(alias, alias.getExportSymbol());
  }

  for (const candidate of candidates) {
    const id = symbolIds.get(candidate.compilerSymbol);
    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

