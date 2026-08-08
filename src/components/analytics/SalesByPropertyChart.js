"use client";

/**
 * SalesByPropertyChart — comparativa de ventas netas por propiedad.
 * Tematizada con los tokens de claude.md (gold para las barras, smoke para
 * ejes/rejilla) en lugar de la paleta por defecto de Recharts.
 * `net_sales` llega como string desde el backend; se convierte a Number
 * para el eje Y. Solo se monta cuando hay más de una propiedad (gating en
 * PanelClient.js).
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const GOLD = "#C9A96E"; // var(--color-gold)
const SMOKE = "#6E6E73"; // var(--color-smoke)

export default function SalesByPropertyChart({ data }) {
  const rows = (data || []).map((d) => ({
    property_name: d.property_name,
    net: Number(d.net_sales),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={SMOKE} strokeOpacity={0.2} vertical={false} />
        <XAxis dataKey="property_name" stroke={SMOKE} tick={{ fontSize: 12 }} />
        <YAxis stroke={SMOKE} tick={{ fontSize: 12 }} width={64} />
        <Tooltip />
        <Bar dataKey="net" fill={GOLD} />
      </BarChart>
    </ResponsiveContainer>
  );
}
