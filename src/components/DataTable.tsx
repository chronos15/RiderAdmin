import { ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  columns?: string[];
  rows?: Array<Array<ReactNode>>;
};

export function DataTable({ children, columns, rows }: Props) {
  if (children) return <table className="table">{children}</table>;

  return (
    <table className="table">
      <thead>
        <tr>{columns?.map((column) => <th key={column}>{column}</th>)}</tr>
      </thead>
      <tbody>
        {rows?.length ? rows.map((row, index) => (
          <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
        )) : (
          <tr><td colSpan={columns?.length ?? 1}>Nenhum registro encontrado.</td></tr>
        )}
      </tbody>
    </table>
  );
}
