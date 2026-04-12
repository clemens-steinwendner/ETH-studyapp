export interface BudgetStatus {
  spent_usd: number;
  limit_usd: number;
  exceeded: boolean;
  remaining_usd: number;
}
