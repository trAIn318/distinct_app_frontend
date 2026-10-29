"use client";

/**
 * SalesByMonthChart — ventas netas por mes (barras). data=[{month,net}].
 * Tematizada con los tokens (gold barras, smoke ejes).
 */

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const GOLD = "#C9A96E"; // var(--color-gold)
const SMOKE = "#6E6E73"; // var(--color-smoke)

export default function SalesByMonthChart({ data }) {
  const rows = (data || []).map((d) => ({ month: d.month, net: Number(d.net) || 0 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="month" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Bar dataKey="net" fill={GOLD} />
      </BarChart>
    </ResponsiveContainer>
  );
}
