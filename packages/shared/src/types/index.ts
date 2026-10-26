export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number;
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
  ledgerId?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  type?: "income" | "expense" | "transfer";
  search?: string;
}

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  primaryCurrency: string;
  themePrimaryColor: string;
  isAdmin: boolean;
  totpEnabled: boolean;
}

export interface TransactionItem {
  id: string;
  ledgerId: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount: number;
  type: "income" | "expense" | "transfer";
  description: string | null;
  date: Date | string;
  tags?: string[] | null;
  isExcludedFromBudget?: boolean;
  createdAt: Date | string;
}

export interface AccountItem {
  id: string;
  ledgerId: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  color?: string | null;
  icon?: string | null;
  orderIndex?: number;
}

export interface CategoryItem {
  id: string;
  ledgerId: string;
  name: string;
  type: "income" | "expense";
  color?: string | null;
  icon?: string | null;
  monthlyBudget?: number | null;
}

export interface BudgetItem {
  id: string;
  ledgerId: string;
  categoryId: string;
  amount: number;
  period: string;
  spent?: number;
}

export interface LedgerItem {
  id: string;
  name: string;
  description?: string | null;
  currency: string;
  ownerId: string;
  role?: string;
}

export interface AiChatMessage {
  role: "user" | "model" | "system";
  content: string;
  timestamp?: string;
}

export interface AiChatRequest {
  message: string;
  sessionId?: string;
  ledgerId?: string;
  modelId?: string;
}

export interface AiAnalyzeRequest {
  ledgerId: string;
  prompt?: string;
  timeframe?: "this_month" | "last_3_months" | "this_year";
}
