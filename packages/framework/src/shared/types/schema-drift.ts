export type SchemaDriftIssueType = 'missing-table' | 'missing-column';

export interface SchemaDriftIssue {
  table: string;
  type: SchemaDriftIssueType;
  column?: string;
  columnType?: string;
  nullable?: boolean;
  defaultValue?: unknown;
}

export interface SchemaDriftReport {
  issues: SchemaDriftIssue[];
  hasIssues: boolean;
}
