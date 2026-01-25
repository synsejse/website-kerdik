export interface ViewState {
  loading: boolean;
  error: string | null;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export type ConfirmCallback = () => void;

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}
