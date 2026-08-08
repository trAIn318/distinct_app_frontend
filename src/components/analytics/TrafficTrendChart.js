"use client";

/**
 * TrafficTrendChart — órdenes y comensales por día (2 líneas).
 * net_sales no se usa aquí; usa order_count/guest_count de la serie diaria.
 * Etiquetas de leyenda (ordersLabel/guestsLabel) llegan traducidas desde
 * PanelClient. Tematizada con los tokens (gold órdenes, platinum comensales).
 */

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const GOLD = "#C9A96E";     // var(--color-gold)
const SMOKE = "#6E6E73";    // var(--color-smoke)
const PLATINUM = "#D8D8D8"; // var(--color-platinum)

export default function TrafficTrendChart({ data, ordersLabel, guestsLabel }) {
  const rows = (data || []).map((d) => ({
    date: d.date,
    orders: Number(d.order_count) || 0,
    guests: Number(d.guest_count) || 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="date" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="orders" name={ordersLabel} stroke={GOLD} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="guests" name={guestsLabel} stroke={PLATINUM} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
