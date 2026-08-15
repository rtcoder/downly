import {useMemo, useState} from 'react';
import type {DownloadRecord} from '../../../domain/downloads/types';

import {aggregateDownloadStats} from '../../../domain/stats/aggregate-stats';
import {
  type DownloadStats,
  STATS_RANGES,
  type StatsPeriodBucket,
  type StatsRange,
  type StatsTopItem,
} from '../../../domain/stats/types';
import {EmptyState, formatBytes, type I18nKey, t} from '../../shared';

export interface StatisticsViewProps {
  downloads: DownloadRecord[];
  now: Date;
}

export function StatisticsView({downloads, now}: StatisticsViewProps) {
  const [range, setRange] = useState<StatsRange>('30-days');
  const stats = useMemo(
    () => aggregateDownloadStats(downloads, {range, now}),
    [downloads, now, range],
  );

  return <section aria-label={t('manager.statistics.section')}>
    <header>
      <h2>{t('manager.statistics.title')}</h2>
      <p>{t('manager.statistics.description')}</p>
      <label>
        <span>{t('manager.statistics.range')}</span>
        <select
          aria-label={t('manager.statistics.range')}
          onChange={(event) => setRange(event.target.value as StatsRange)}
          value={range}
        >
          {STATS_RANGES.map((option) => (
            <option key={option.id} value={option.id}>{t(statsRangeLabelKeys[option.id])}</option>
          ))}
        </select>
      </label>
    </header>

    {stats.hasHistory ? (
      <>
        <section aria-label={t('manager.statistics.cards')}>
          <StatCard label={t('manager.statistics.downloadsToday')} value={formatNumber(stats.downloadsToday)}/>
          <StatCard label={t('manager.statistics.downloadsThisMonth')} value={formatNumber(stats.downloadsThisMonth)}/>
          <StatCard label={t('manager.statistics.bytesThisMonth')} value={formatBytes(stats.bytesDownloadedThisMonth)}/>
          <StatCard label={t('manager.statistics.bytesInRange')} value={formatBytes(stats.range.bytesDownloaded)}/>
          <StatCard label={t('manager.statistics.completedCount')} value={formatNumber(stats.completedCount)}/>
          <StatCard label={t('manager.statistics.interruptedCount')} value={formatNumber(stats.interruptedCount)}/>
          <StatCard
            label={t('manager.statistics.largestItem')}
            value={stats.largestItem ? formatBytes(stats.largestItem.size) : t('manager.statistics.none')}
            detail={stats.largestItem ? stats.largestItem.basename || stats.largestItem.filename : undefined}
          />
          <StatCard
            label={t('manager.statistics.topCategory')}
            value={stats.topCategory?.label ?? t('manager.statistics.none')}
            detail={stats.topCategory ? t('manager.statistics.downloadCount', {count: formatNumber(stats.topCategory.count)}) : undefined}
          />
          <StatCard
            label={t('manager.statistics.topDomain')}
            value={stats.topDomain?.label ?? t('manager.statistics.none')}
            detail={stats.topDomain ? t('manager.statistics.downloadCount', {count: formatNumber(stats.topDomain.count)}) : undefined}
          />
        </section>

        <section aria-label={t('manager.statistics.charts')}>
          <BytesChart buckets={stats.bytesByPeriod}/>
          <TopItemsTable title={t('manager.statistics.countByCategory')} items={stats.countByCategory}/>
          <TopItemsTable title={t('manager.statistics.countByDomain')} items={stats.countByDomain}/>
          <StateChart stats={stats}/>
        </section>
      </>
    ) : (
      <EmptyState
        title={t('manager.statistics.emptyTitle')}
        description={t('manager.statistics.emptyDescription')}
      />
    )}
  </section>;
}

const statsRangeLabelKeys: Record<StatsRange, I18nKey> = {
  '7-days': 'manager.statistics.range.7Days',
  '30-days': 'manager.statistics.range.30Days',
  '90-days': 'manager.statistics.range.90Days',
  '1-year': 'manager.statistics.range.1Year',
  all: 'manager.statistics.range.all',
};

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
}

function StatCard({label, value, detail}: StatCardProps) {
  return <section aria-label={label}>
    <h3>{label}</h3>
    <p>{value}</p>
    {detail ? <p>{detail}</p> : null}
  </section>;
}

function BytesChart({buckets}: { buckets: StatsPeriodBucket[] }) {
  const maxBytes = Math.max(...buckets.map((bucket) => bucket.bytesDownloaded), 0);
  const width = Math.max(240, buckets.length * 44);
  const height = 120;

  return <figure aria-label={t('manager.statistics.bytesByPeriod')}>
    <figcaption>{t('manager.statistics.bytesByPeriod')}</figcaption>
    {buckets.length === 0 ? (
      <p>{t('manager.statistics.noDownloadsInRange')}</p>
    ) : (
      <>
        <svg aria-hidden="true" focusable="false" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
          {buckets.map((bucket, index) => {
            const barWidth = 28;
            const barHeight = maxBytes > 0 ? Math.max(2, (bucket.bytesDownloaded / maxBytes) * 92) : 2;
            const x = index * 44 + 8;
            const y = height - barHeight - 20;

            return <g key={bucket.key}>
              <rect height={barHeight} width={barWidth} x={x} y={y}/>
              <text aria-hidden="true" fontSize="9" textAnchor="middle" x={x + barWidth / 2} y={height - 6}>
                {bucket.label}
              </text>
            </g>;
          })}
        </svg>
        <table aria-label={t('manager.statistics.bytesByPeriodData')}>
          <thead>
          <tr>
            <th scope="col">{t('manager.statistics.period')}</th>
            <th scope="col">{t('manager.statistics.downloads')}</th>
            <th scope="col">{t('manager.statistics.bytes')}</th>
          </tr>
          </thead>
          <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.key}>
              <td>{bucket.label}</td>
              <td>{formatNumber(bucket.count)}</td>
              <td>{formatBytes(bucket.bytesDownloaded)}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </>
    )}
  </figure>;
}

function TopItemsTable({title, items}: { title: string; items: StatsTopItem[] }) {
  const maxCount = Math.max(...items.map((item) => item.count), 0);

  return <section aria-label={title}>
    <h3>{title}</h3>
    {items.length === 0 ? (
      <p>{t('manager.statistics.noDownloadsInRange')}</p>
    ) : (
      <table aria-label={title}>
        <thead>
        <tr>
          <th scope="col">{t('manager.statistics.name')}</th>
          <th scope="col">{t('manager.statistics.count')}</th>
          <th scope="col">{t('manager.statistics.share')}</th>
        </tr>
        </thead>
        <tbody>
        {items.map((item) => (
          <tr key={item.key}>
            <td>{item.label}</td>
            <td>{formatNumber(item.count)}</td>
            <td>
              <meter max={maxCount} min={0} value={item.count}>{item.count}</meter>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    )}
  </section>;
}

function StateChart({stats}: { stats: DownloadStats }) {
  const total = stats.stateCounts.completed + stats.stateCounts.interrupted + stats.stateCounts.inProgress;

  return <section aria-label={t('manager.statistics.completedVsInterrupted')}>
    <h3>{t('manager.statistics.completedVsInterrupted')}</h3>
    {total === 0 ? (
      <p>{t('manager.statistics.noDownloadsInRange')}</p>
    ) : (
      <dl>
        <dt>{t('manager.statistics.completed')}</dt>
        <dd>
          <meter max={total} min={0} value={stats.stateCounts.completed}>{stats.stateCounts.completed}</meter>
          {formatNumber(stats.stateCounts.completed)}
        </dd>
        <dt>{t('manager.statistics.interrupted')}</dt>
        <dd>
          <meter max={total} min={0} value={stats.stateCounts.interrupted}>{stats.stateCounts.interrupted}</meter>
          {formatNumber(stats.stateCounts.interrupted)}
        </dd>
        <dt>{t('manager.statistics.inProgress')}</dt>
        <dd>
          <meter max={total} min={0} value={stats.stateCounts.inProgress}>{stats.stateCounts.inProgress}</meter>
          {formatNumber(stats.stateCounts.inProgress)}
        </dd>
      </dl>
    )}
  </section>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
