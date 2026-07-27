import React, { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export const Table = ({ className = '', children, ...props }: HTMLAttributes<HTMLTableElement>) => {
  return (
    <div className="w-full overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
      <table className={`w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400 ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => {
  return (
    <thead className={`bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 ${className}`} {...props}>
      {children}
    </thead>
  );
};

export const TableBody = ({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => {
  return (
    <tbody className={`divide-y divide-slate-100 dark:divide-slate-800/60 ${className}`} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ className = '', children, ...props }: HTMLAttributes<HTMLTableRowElement>) => {
  return (
    <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
};

export const TableHead = ({ className = '', children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => {
  return (
    <th className={`px-4 py-3 font-semibold ${className}`} {...props}>
      {children}
    </th>
  );
};

export const TableCell = ({ className = '', children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => {
  return (
    <td className={`px-4 py-3 text-slate-700 dark:text-slate-300 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
};

export default Table;

