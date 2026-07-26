import { useEffect, useState } from 'react'
import type { DailyJournal } from '@shared/domain'
import type { JournalUpsert } from '@shared/api'
import { useApp } from '../lib/app-context'
import { otl } from '../lib/utils'
import { Button, Empty, Panel } from '../components/ui'

const today = (): string => new Date().toISOString().slice(0, 10)

export function Journal(): React.JSX.Element {
  const { selectedAccountId, accounts } = useApp()
  const accountId = selectedAccountId ?? accounts[0]?.id ?? null
  const [date, setDate] = useState(today())
  const [j, setJ] = useState<Partial<DailyJournal>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!accountId) return
    void otl()
      .getJournal(accountId, date)
      .then((res) => setJ(res ?? {}))
  }, [accountId, date])

  if (!accountId)
    return (
      <Panel label="Daily journal">
        <Empty>Create an account first.</Empty>
      </Panel>
    )

  const save = async (): Promise<void> => {
    const payload: JournalUpsert = {
      accountId,
      tradingDate: date,
      gamePlan: j.gamePlan ?? null,
      bias: j.bias ?? null,
      review: j.review ?? null,
      whatWorked: j.whatWorked ?? null,
      whatToImprove: j.whatToImprove ?? null,
      moodStart: j.moodStart ?? null,
      moodEnd: j.moodEnd ?? null
    }
    await otl().upsertJournal(payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const area = 'w-full rounded border border-border-strong bg-panel-2 p-2 text-[13px] focus:outline-none'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="num h-8 rounded border border-border-strong bg-panel-2 px-2 text-[13px]"
        />
        <div className="flex-1" />
        <Button variant="primary" onClick={save}>
          {saved ? 'Saved ✓' : 'Save journal'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel label="Pre-market — game plan">
          <div className="space-y-2">
            <input
              placeholder="Bias (e.g. bullish above 5000)"
              className={area}
              value={j.bias ?? ''}
              onChange={(e) => setJ({ ...j, bias: e.target.value })}
            />
            <textarea
              rows={8}
              placeholder="Game plan, key levels, scenarios…"
              className={area}
              value={j.gamePlan ?? ''}
              onChange={(e) => setJ({ ...j, gamePlan: e.target.value })}
            />
            <input
              placeholder="Mood at open"
              className={area}
              value={j.moodStart ?? ''}
              onChange={(e) => setJ({ ...j, moodStart: e.target.value })}
            />
          </div>
        </Panel>

        <Panel label="Post-session — review">
          <div className="space-y-2">
            <textarea
              rows={4}
              placeholder="What worked?"
              className={area}
              value={j.whatWorked ?? ''}
              onChange={(e) => setJ({ ...j, whatWorked: e.target.value })}
            />
            <textarea
              rows={4}
              placeholder="What to improve?"
              className={area}
              value={j.whatToImprove ?? ''}
              onChange={(e) => setJ({ ...j, whatToImprove: e.target.value })}
            />
            <textarea
              rows={3}
              placeholder="Overall review"
              className={area}
              value={j.review ?? ''}
              onChange={(e) => setJ({ ...j, review: e.target.value })}
            />
            <input
              placeholder="Mood at close"
              className={area}
              value={j.moodEnd ?? ''}
              onChange={(e) => setJ({ ...j, moodEnd: e.target.value })}
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
