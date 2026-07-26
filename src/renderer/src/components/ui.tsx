import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { GuardrailMeter, MeterState } from '@shared/domain'
import { formatUSD } from '@shared/money'
import { cn } from '../lib/utils'

export function Panel({
  label,
  right,
  children,
  className
}: {
  label?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn('rounded-md border border-border bg-panel', className)}>
      {(label || right) && (
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="panel-label">{label}</span>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  )
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost'
  size?: 'sm' | 'md'
}): React.JSX.Element {
  return (
    <button
      className={cn(
        'no-drag inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-accent text-accent-fg hover:opacity-90',
        variant === 'default' && 'border border-border-strong bg-panel-2 text-fg hover:bg-panel',
        variant === 'ghost' && 'text-fg-muted hover:bg-panel-2 hover:text-fg',
        className
      )}
      {...props}
    />
  )
}

const stateColor: Record<MeterState, string> = {
  safe: 'text-profit',
  warn: 'text-warn',
  breach: 'text-breach',
  na: 'text-fg-muted'
}
const stateBar: Record<MeterState, string> = {
  safe: 'bg-profit',
  warn: 'bg-warn',
  breach: 'bg-breach',
  na: 'bg-fg-subtle'
}

export function PnL({
  cents,
  className,
  sign = true,
  bold
}: {
  cents: number
  className?: string
  sign?: boolean
  bold?: boolean
}): React.JSX.Element {
  const color = cents > 0 ? 'text-profit' : cents < 0 ? 'text-loss' : 'text-fg-muted'
  return (
    <span className={cn('num', color, bold && 'font-semibold', className)}>
      {formatUSD(cents, { sign })}
    </span>
  )
}

export function Meter({ meter }: { meter: GuardrailMeter }): React.JSX.Element {
  const pct = meter.limit > 0 ? Math.min(100, Math.max(0, (meter.value / meter.limit) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-fg-muted">{meter.label}</span>
        <span className={cn('num text-xs font-medium', stateColor[meter.state])}>{meter.headline}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
        <div className={cn('h-full rounded-full transition-all', stateBar[meter.state])} style={{ width: `${pct}%` }} />
      </div>
      {meter.detail && <div className="num text-[10px] text-fg-subtle">{meter.detail}</div>}
    </div>
  )
}

export function Stat({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('px-3 py-2', className)}>
      <div className="panel-label mb-0.5">{label}</div>
      <div className="num text-lg font-semibold leading-tight">{children}</div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="py-10 text-center text-sm text-fg-muted">{children}</div>
}
