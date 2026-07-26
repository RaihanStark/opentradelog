import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatUSD } from '@shared/money'

interface Point {
  t: string
  equity: number
}

export function EquityChart({
  data,
  height = 160
}: {
  data: Point[]
  height?: number
}): React.JSX.Element {
  const chartData = data.map((p, i) => ({ i, equity: p.equity / 100, t: p.t }))
  const last = data.at(-1)?.equity ?? 0
  const color = last >= 0 ? '#21c17a' : '#f0554e'

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-fg-subtle"
        style={{ height }}
      >
        No closed trades yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis
          width={52}
          tick={{ fontSize: 10, fill: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}
          tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--panel-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: 12
          }}
          labelFormatter={() => ''}
          formatter={(v) => [formatUSD(Math.round(Number(v) * 100), { sign: true }), 'Equity']}
        />
        <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={1.5} fill="url(#eq)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
