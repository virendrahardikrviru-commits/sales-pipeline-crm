import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export interface TableProps {
  children: ReactNode;
}

export function Table({ children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: TableProps) {
  return (
    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
      {children}
    </thead>
  );
}

export function TBody({ children }: TableProps) {
  return (
    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {children}
    </tbody>
  );
}

export function TR({ children }: TableProps) {
  return (
    <tr className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
      {children}
    </tr>
  );
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export function TH({ children, className = "", ...props }: THProps) {
  return (
    <th
      className={`px-4 py-3 font-medium ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export function TD({ children, className = "", ...props }: TDProps) {
  return (
    <td
      className={`px-4 py-3 text-zinc-700 dark:text-zinc-300 ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}
