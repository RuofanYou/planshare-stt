import { Fragment, lazy, Suspense, useMemo, useState } from 'react'
import { Button, EmptyState, Icon, Tag } from '../components/ui'
import lootData from '../data/loot-12-1.json'
import lootMeta from '../data/loot-12-1.meta.json'
import './Loot.css'

const RemotionPlayer = lazy(() => import('@remotion/player').then(({ Player }) => ({ default: Player })))
const LootVaultMotion = lazy(() => import('../components/LootVaultMotion'))

type DisplayStat = {
  label: string
  value: number
}

type DisplayVariant = {
  itemLevel: number
  track: string
  rank: number
  maxRank: number
  stats: DisplayStat[]
  icon: string
  verified: boolean
}

type TrinketEffect = {
  text: string
  verified: boolean
  staticOnly: boolean
}

type LootRecord = {
  key: string
  itemId: number
  name: string
  slot: string
  equipmentType: string
  classes: string[]
  sourceType: string
  instance: string
  boss: string | null
  journalOrder: number | null
  displayVariant: DisplayVariant
  trinketEffect?: TrinketEffect
}

type Filters = {
  query: string
  sourceType: string
  className: string
  slot: string
  equipmentType: string
  stat: string
}

type BossGroup = {
  boss: string | null
  journalOrder: number | null
  records: LootRecord[]
}

type InstanceGroup = {
  instance: string
  bosses: BossGroup[]
}

type SourceGroup = {
  sourceType: string
  instances: InstanceGroup[]
}

const records = lootData as unknown as LootRecord[]
const metadata = lootMeta as {
  gameVersion: string
  result: { publishedRecords: number }
  filters: { sourceTypes: string[]; classes: string[]; slots: string[] }
}

const sourceTypes = metadata.filters.sourceTypes.filter((value) => records.some((record) => record.sourceType === value))
const classNames = metadata.filters.classes.filter((value) => records.some((record) => record.classes.includes(value)))
const slots = metadata.filters.slots.filter((value) => records.some((record) => record.slot === value))
const equipmentTypeValues = Array.from(new Set(records.map((record) => record.equipmentType)))
const armorTypeSet = new Set(['布甲', '皮甲', '锁甲', '板甲'])
const armorTypes = equipmentTypeValues.filter((value) => armorTypeSet.has(value))
const otherTypeSet = new Set(['其他'])
const otherTypes = equipmentTypeValues.filter((value) => otherTypeSet.has(value))
const weaponTypes = equipmentTypeValues.filter((value) => !armorTypeSet.has(value) && !otherTypeSet.has(value))
const statNames = Array.from(new Set(records.flatMap((record) => record.displayVariant.stats.flatMap((stat) => stat.label.split('/')))))

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN')
}

function recordHasStat(record: LootRecord, stat: string) {
  return record.displayVariant.stats.some((entry) => entry.label.split('/').includes(stat))
}

function matchesFilters(record: LootRecord, filters: Filters) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase()
  return (
    (!normalizedQuery || record.name.toLocaleLowerCase().includes(normalizedQuery)) &&
    (!filters.sourceType || record.sourceType === filters.sourceType) &&
    (!filters.className || record.classes.includes(filters.className)) &&
    (!filters.slot || record.slot === filters.slot) &&
    (!filters.equipmentType || record.equipmentType === filters.equipmentType) &&
    (!filters.stat || recordHasStat(record, filters.stat))
  )
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'zh-CN', { numeric: true })
}

function sourcePosition(sourceType: string) {
  const position = sourceTypes.indexOf(sourceType)
  return position === -1 ? sourceTypes.length : position
}

function journalPosition(journalOrder: number | null) {
  return journalOrder ?? Number.MAX_SAFE_INTEGER
}

function groupRecords(input: LootRecord[]): SourceGroup[] {
  const sourceMap = new Map<string, Map<string, Map<string, BossGroup>>>()

  for (const record of input) {
    const instances = sourceMap.get(record.sourceType) ?? new Map<string, Map<string, BossGroup>>()
    const bosses = instances.get(record.instance) ?? new Map<string, BossGroup>()
    const bossKey = (record.boss ?? '') + '|' + (record.journalOrder ?? '')
    const group = bosses.get(bossKey) ?? {
      boss: record.boss,
      journalOrder: record.journalOrder,
      records: [],
    }

    group.records.push(record)
    bosses.set(bossKey, group)
    instances.set(record.instance, bosses)
    sourceMap.set(record.sourceType, instances)
  }

  return Array.from(sourceMap, ([sourceType, instances]) => ({
    sourceType,
    instances: Array.from(instances, ([instance, bosses]) => ({
      instance,
      bosses: Array.from(bosses.values())
        .map((group) => ({
          ...group,
          records: group.records.slice().sort((left, right) => (
            compareText(left.name, right.name) || left.itemId - right.itemId
          )),
        }))
        .sort((left, right) => (
          journalPosition(left.journalOrder) - journalPosition(right.journalOrder) ||
          compareText(left.boss ?? '', right.boss ?? '')
        )),
    })).sort((left, right) => compareText(left.instance, right.instance)),
  })).sort((left, right) => sourcePosition(left.sourceType) - sourcePosition(right.sourceType))
}

function bossLabel(group: BossGroup) {
  if (!group.boss) return null
  return group.boss + (group.journalOrder ? '（M' + group.journalOrder + '）' : '')
}

function LootGlyph({ variant }: { variant: DisplayVariant }) {
  return <img className="ps-loot__icon" src={variant.icon} alt="" loading="lazy" />
}

function StatList({ variant }: { variant: DisplayVariant }) {
  if (variant.stats.length === 0) {
    return <span className="ps-loot__stat-empty">暂无数值属性</span>
  }

  return (
    <ul className="ps-loot__stats" aria-label="真实属性">
      {variant.stats.map((stat) => (
        <li key={stat.label + '-' + stat.value} className={'ps-loot__stat ps-loot__stat--' + statTone(stat.label)}>
          <StatLabel label={stat.label} />
          <strong>+{formatNumber(stat.value)}</strong>
        </li>
      ))}
    </ul>
  )
}

const STAT_TONES: Record<string, string> = {
  力量: 'strength',
  敏捷: 'agility',
  智力: 'intellect',
  暴击: 'critical',
  急速: 'haste',
  精通: 'mastery',
  全能: 'versatility',
  耐力: 'stamina',
  护甲: 'armor',
  吸血: 'leech',
  闪避: 'avoidance',
  速度: 'speed',
}

function statTone(label: string) {
  return STAT_TONES[label] ?? STAT_TONES[label.split('/')[0]] ?? 'neutral'
}

function StatLabel({ label }: { label: string }) {
  const parts = label.split('/')
  return (
    <span>
      {parts.map((part, index) => (
        <Fragment key={part + '-' + index}>
          {index > 0 && <span aria-hidden="true">/</span>}
          <span className={'ps-loot__stat-label--' + statTone(part)}>{part}</span>
        </Fragment>
      ))}
    </span>
  )
}

type FilterChipGroupProps = {
  testId: string
  label: string
  value: string
  options: string[]
  available: Set<string>
  onChange: (value: string) => void
}

function FilterChipGroup({ testId, label, value, options, available, onChange }: FilterChipGroupProps) {
  return (
    <fieldset className="ps-loot__filter-group" data-testid={testId}>
      <legend>{label}</legend>
      <div className="ps-loot__chip-list">
        <button
          className={'ps-loot__filter-chip' + (!value ? ' ps-loot__filter-chip--selected' : '')}
          type="button"
          aria-pressed={!value}
          onClick={() => onChange('')}
        >
          全部
        </button>
        {options.map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              className={'ps-loot__filter-chip' + (selected ? ' ps-loot__filter-chip--selected' : '')}
              type="button"
              aria-pressed={selected}
              disabled={!selected && !available.has(option)}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function TrinketEffectPanel({ effect, variant }: { effect: TrinketEffect; variant: DisplayVariant }) {
  return (
    <div className="ps-loot__effect" data-testid="loot-effect">
      <span className="ps-loot__effect-label">饰品详情</span>
      {effect.text ? (
        <p>{effect.text}</p>
      ) : (
        <>
          <p>该饰品没有独立的使用效果，当前档位提供以下属性：</p>
          <StatList variant={variant} />
        </>
      )}
    </div>
  )
}

function LootCard({ record, instance, boss, index }: { record: LootRecord; instance: string; boss: string | null; index: number }) {
  const trackLabel = record.displayVariant.maxRank > 0
    ? record.displayVariant.track + '（' + record.displayVariant.rank + '/' + record.displayVariant.maxRank + '）'
    : record.displayVariant.track

  return (
    <article className="ps-loot__card glass" data-testid="loot-card">
      <div className="ps-loot__card-aura" aria-hidden="true" />
      <header className="ps-loot__card-head">
        <div className="ps-loot__card-tags">
          <span className="ps-loot__slot-tag">{record.slot}</span>
          <span className="ps-loot__type-tag">{record.equipmentType}</span>
        </div>
        <span className="ps-loot__card-index">{String(index + 1).padStart(2, '0')}</span>
      </header>

      <div className="ps-loot__card-item">
        <LootGlyph variant={record.displayVariant} />
        <div className="ps-loot__item-copy">
          <span className="ps-loot__item-name">{record.name}</span>
          <span className="ps-loot__item-id">物品 ID：{record.itemId}</span>
        </div>
      </div>

      <div className="ps-loot__card-level ps-loot__variant">
        <span>{trackLabel} · </span>
        <strong>{formatNumber(record.displayVariant.itemLevel)}</strong>
        <span> 装等</span>
      </div>

      <div className="ps-loot__card-body">
        <div className="ps-loot__card-stat-block">
          <span className="ps-loot__card-label">真实属性</span>
          <StatList variant={record.displayVariant} />
        </div>
        <div className="ps-loot__card-detail-block">
          {record.trinketEffect ? (
            <TrinketEffectPanel effect={record.trinketEffect} variant={record.displayVariant} />
          ) : (
            <div className="ps-loot__card-slot-detail">
              <span className="ps-loot__card-label">装备部位</span>
              <strong>{record.slot} · {record.equipmentType}</strong>
            </div>
          )}
        </div>
      </div>

      <footer className="ps-loot__card-foot">
        <span>{instance}</span>
        <span>{boss ?? '来源掉落'}</span>
      </footer>
    </article>
  )
}

function LootCards({ records: items, instance, boss }: { records: LootRecord[]; instance: string; boss: string | null }) {
  return (
    <div className="ps-loot__cards" aria-label="装备结果列表">
      {items.map((record, index) => (
        <LootCard key={record.key} record={record} instance={instance} boss={boss} index={index} />
      ))}
    </div>
  )
}

export default function Loot() {
  const [query, setQuery] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [className, setClassName] = useState('')
  const [slot, setSlot] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const [stat, setStat] = useState('')

  const filtered = useMemo(() => records.filter((record) => matchesFilters(record, {
    query,
    sourceType,
    className,
    slot,
    equipmentType,
    stat,
  })), [className, equipmentType, query, slot, sourceType, stat])

  const groups = useMemo(() => groupRecords(filtered), [filtered])

  const sourceAvailability = useMemo(() => new Set(records
    .filter((record) => matchesFilters(record, { query, sourceType: '', className: '', slot: '', equipmentType: '', stat: '' }))
    .map((record) => record.sourceType)), [query])

  const classAvailability = useMemo(() => new Set(records
    .filter((record) => matchesFilters(record, { query, sourceType, className: '', slot, equipmentType, stat }))
    .flatMap((record) => record.classes)), [equipmentType, query, slot, sourceType, stat])

  const slotAvailability = useMemo(() => new Set(records
    .filter((record) => matchesFilters(record, { query, sourceType, className, slot: '', equipmentType, stat }))
    .map((record) => record.slot)), [className, equipmentType, query, sourceType, stat])

  const equipmentAvailability = useMemo(() => new Set(records
    .filter((record) => matchesFilters(record, { query, sourceType, className, slot, equipmentType: '', stat }))
    .map((record) => record.equipmentType)), [className, query, slot, sourceType, stat])

  const statAvailability = useMemo(() => new Set(records
    .filter((record) => matchesFilters(record, { query, sourceType, className, slot, equipmentType, stat: '' }))
    .flatMap((record) => record.displayVariant.stats.flatMap((entry) => entry.label.split('/')))), [className, equipmentType, query, slot, sourceType])

  const hasFilters = Boolean(query || sourceType || className || slot || equipmentType || stat)

  function clearFilters() {
    setQuery('')
    setSourceType('')
    setClassName('')
    setSlot('')
    setEquipmentType('')
    setStat('')
  }

  function changeSource(nextSourceType: string) {
    const nextSourceRecords = records.filter((record) => matchesFilters(record, {
      query,
      sourceType: nextSourceType,
      className: '',
      slot: '',
      equipmentType: '',
      stat: '',
    }))
    const classIsValid = !className || nextSourceRecords.some((record) => (
      record.classes.includes(className) && matchesFilters(record, {
        query,
        sourceType: nextSourceType,
        className: '',
        slot,
        equipmentType,
        stat,
      })
    ))
    const slotIsValid = !slot || nextSourceRecords.some((record) => (
      record.slot === slot && matchesFilters(record, {
        query,
        sourceType: nextSourceType,
        className,
        slot: '',
        equipmentType,
        stat,
      })
    ))
    const equipmentTypeIsValid = !equipmentType || nextSourceRecords.some((record) => (
      record.equipmentType === equipmentType && matchesFilters(record, {
        query,
        sourceType: nextSourceType,
        className,
        slot,
        equipmentType: '',
        stat,
      })
    ))
    const statIsValid = !stat || nextSourceRecords.some((record) => (
      recordHasStat(record, stat) && matchesFilters(record, {
        query,
        sourceType: nextSourceType,
        className,
        slot,
        equipmentType,
        stat: '',
      })
    ))

    setSourceType(nextSourceType)
    setClassName(classIsValid ? className : '')
    setSlot(slotIsValid ? slot : '')
    setEquipmentType(equipmentTypeIsValid ? equipmentType : '')
    setStat(statIsValid ? stat : '')
  }

  const motionInputProps = {
    accent: 'var(--color-gold)',
    highlight: 'var(--color-gold-bright)',
  }

  return (
    <div className="ps-loot">
      <section className="container ps-loot__head" aria-labelledby="loot-title">
        <div className="ps-loot__hero glass">
          <div className="ps-loot__hero-copy">
            <div className="ps-loot__eyebrow">
              <Tag variant="gold">{metadata.gameVersion}</Tag>
              <span className="ps-loot__hero-kicker">LOOT LIBRARY / INDEX 12.1</span>
            </div>
            <h1 id="loot-title" className="ps-loot__title text-gold-grad">
              魔兽世界 12.1 装备掉落查询
            </h1>
            <p className="ps-loot__hero-subtitle">把每一件掉落，收进一张可以慢慢浏览的装备卡片。</p>
          </div>
          <div className="ps-loot__hero-motion" data-testid="loot-vault-motion" aria-hidden="true">
            <Suspense fallback={null}>
              <RemotionPlayer
                component={LootVaultMotion}
                durationInFrames={360}
                fps={30}
                compositionWidth={900}
                compositionHeight={360}
                inputProps={motionInputProps}
                autoPlay
                loop
                controls={false}
                initiallyMuted
                numberOfSharedAudioTags={0}
                style={{ width: '100%', height: '100%' }}
              />
            </Suspense>
            <div className="ps-loot__hero-orbit-label">实时索引</div>
          </div>
        </div>
        <dl className="ps-loot__summary glass" aria-label="装备收录与结果数量">
          <div>
            <dt>收录装备</dt>
            <dd data-testid="loot-collected-count">{metadata.result.publishedRecords}<small> 件</small></dd>
          </div>
          <div>
            <dt>当前结果</dt>
            <dd data-testid="loot-results-count" aria-live="polite">{filtered.length}<small> 件</small></dd>
          </div>
        </dl>
      </section>

      <section className="container ps-loot__workspace" aria-label="装备掉落筛选">
        <form className="ps-loot__filters glass" onSubmit={(event) => event.preventDefault()}>
          <div className="ps-loot__filters-heading">
            <div>
              <span className="ps-loot__section-kicker">QUICK LOADOUT</span>
              <h2>快速筛选</h2>
            </div>
            <span className="ps-loot__filters-count">{filtered.length} 项结果</span>
          </div>
          <label className="ps-loot__search-field">
            <span>装备名</span>
            <span className="ps-loot__search-input">
              <Icon name="search" size={18} />
              <input
                aria-label="中文装备名搜索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索中文装备名"
                type="search"
              />
            </span>
          </label>

          <div className="ps-loot__filter-groups">
            <FilterChipGroup
              testId="loot-filter-source"
              label="来源"
              value={sourceType}
              options={sourceTypes}
              available={sourceAvailability}
              onChange={changeSource}
            />
            <FilterChipGroup
              testId="loot-filter-class"
              label="职业"
              value={className}
              options={classNames}
              available={classAvailability}
              onChange={setClassName}
            />
            <FilterChipGroup
              testId="loot-filter-slot"
              label="部位"
              value={slot}
              options={slots}
              available={slotAvailability}
              onChange={setSlot}
            />
            <FilterChipGroup
              testId="loot-filter-weapon"
              label="武器类型"
              value={weaponTypes.includes(equipmentType) ? equipmentType : ''}
              options={weaponTypes}
              available={equipmentAvailability}
              onChange={setEquipmentType}
            />
            <FilterChipGroup
              testId="loot-filter-armor"
              label="装备类型"
              value={armorTypes.includes(equipmentType) ? equipmentType : ''}
              options={armorTypes}
              available={equipmentAvailability}
              onChange={setEquipmentType}
            />
            <FilterChipGroup
              testId="loot-filter-other"
              label="其它类型"
              value={otherTypes.includes(equipmentType) ? equipmentType : ''}
              options={otherTypes}
              available={equipmentAvailability}
              onChange={setEquipmentType}
            />
            <FilterChipGroup
              testId="loot-filter-stat"
              label="属性"
              value={stat}
              options={statNames}
              available={statAvailability}
              onChange={setStat}
            />
          </div>
          <div className="ps-loot__clear-wrap">
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters} disabled={!hasFilters}>
              清除筛选
            </Button>
          </div>
        </form>

        {filtered.length === 0 ? (
          <EmptyState text="没有找到符合条件的装备。" actionLabel="清除筛选" onAction={clearFilters} />
        ) : (
          <div className="ps-loot__groups">
            {groups.map((sourceGroup) => (
              <section
                key={sourceGroup.sourceType}
                className="ps-loot__source-group"
                data-testid="loot-source-group"
                aria-label={sourceGroup.sourceType + ' 来源'}
              >
                <h2 className="ps-loot__source-title">{sourceGroup.sourceType}</h2>
                {sourceGroup.instances.map((instanceGroup) => (
                  <section
                    key={sourceGroup.sourceType + '-' + instanceGroup.instance}
                    className="ps-loot__instance-group"
                    data-testid="loot-instance-group"
                    aria-label={sourceGroup.sourceType + ' · ' + instanceGroup.instance}
                  >
                    <h3 className="ps-loot__instance-title">{instanceGroup.instance}</h3>
                    {instanceGroup.bosses.map((bossGroup) => {
                      const label = bossLabel(bossGroup)
                      return (
                        <section
                          key={instanceGroup.instance + '-' + (bossGroup.boss ?? 'unassigned') + '-' + (bossGroup.journalOrder ?? 'none')}
                          className="ps-loot__boss-group"
                          data-testid={label ? 'loot-boss-group' : undefined}
                        >
                          {label && <h4 className="ps-loot__boss-title">{label}</h4>}
                          <LootCards records={bossGroup.records} instance={instanceGroup.instance} boss={label} />
                        </section>
                      )
                    })}
                  </section>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
