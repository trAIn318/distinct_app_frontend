"use client";

/**
 * SalesTrendChart — línea de tendencia de ventas netas por día.
 * Tematizada con los tokens de claude.md (gold para la línea, smoke para
 * ejes/rejilla) en lugar de la paleta por defecto de Recharts.
 * `net_sales` llega como string desde el backend; se convierte a Number
 * para el eje Y.
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const GOLD = "#C9A96E"; // var(--color-gold)
const SMOKE = "#6E6E73"; // var(--color-smoke)

export default function SalesTrendChart({ data }) {
  const rows = (data || []).map((d) => ({
    date: d.date,
    net: Number(d.net_sales),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="date" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Line type="monotone" dataKey="net" stroke={GOLD} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
