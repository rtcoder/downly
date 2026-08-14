import { useMemo, useState } from 'react';

import { aggregateDownloadStats } from '../../../domain/stats/aggregate-stats';
import { STATS_RANGES, type DownloadStats, type StatsPeriodBucket, type StatsRange, type StatsTopItem } from '../../../domain/stats/types';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { EmptyState } from '../../shared';
import { formatBytes } from '../../shared/formatters';

export interface StatisticsViewProps {
  downloads: DownloadRecord[];
  now: Date;
}

export function StatisticsView({ downloads, now }: StatisticsViewProps) {
  const [range, setRange] = useState<StatsRange>('30-days');
  const stats = useMemo(
    () => aggregateDownloadStats(downloads, { range, now }),
    [downloads, now, range],
  );

  return <section aria-label="Download statistics">
    <header>
      <h2>Statistics</h2>
      <p>
        These statistics reflect the Chrome download history available to Downly.
        If browser download history is cleared, that data is no longer available to these reports.
      </p>
      <label>
        <span>Statistics range</span>
        <select
          aria-label="Statistics range"
          onChange={(event) => setRange(event.target.value as StatsRange)}
          value={range}
        >
          {STATS_RANGES.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
    </header>

    {stats.hasHistory ? (
      <>
        <section aria-label="Statistic cards">
          <StatCard label="Downloads today" value={formatNumber(stats.downloadsToday)} />
          <StatCard label="Downloads this month" value={formatNumber(stats.downloadsThisMonth)} />
          <StatCard label="Bytes downloaded this month" value={formatBytes(stats.bytesDownloadedThisMonth)} />
          <StatCard label="Bytes downloaded in range" value={formatBytes(stats.range.bytesDownloaded)} />
          <StatCard label="Completed count" value={formatNumber(stats.completedCount)} />
          <StatCard label="Interrupted count" value={formatNumber(stats.interruptedCount)} />
          <StatCard
            label="Largest item"
            value={stats.largestItem ? formatBytes(stats.largestItem.size) : 'None'}
            detail={stats.largestItem ? stats.largestItem.basename || stats.largestItem.filename : undefined}
          />
          <StatCard
            label="Top category"
            value={stats.topCategory?.label ?? 'None'}
            detail={stats.topCategory ? `${formatNumber(stats.topCategory.count)} downloads` : undefined}
          />
          <StatCard
            label="Top domain"
            value={stats.topDomain?.label ?? 'None'}
            detail={stats.topDomain ? `${formatNumber(stats.topDomain.count)} downloads` : undefined}
          />
        </section>

        <section aria-label="Statistics charts">
          <BytesChart buckets={stats.bytesByPeriod} />
          <TopItemsTable title="Count by category" items={stats.countByCategory} />
          <TopItemsTable title="Count by source domain" items={stats.countByDomain} />
          <StateChart stats={stats} />
        </section>
      </>
    ) : (
      <EmptyState
        title="Empty history"
        description="Downly cannot calculate statistics until Chrome has available download history."
      />
    )}
  </section>;
}

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
}

function StatCard({ label, value, detail }: StatCardProps) {
  return <section aria-label={label}>
    <h3>{label}</h3>
    <p>{value}</p>
    {detail ? <p>{detail}</p> : null}
  </section>;
}

function BytesChart({ buckets }: { buckets: StatsPeriodBucket[] }) {
  const maxBytes = Math.max(...buckets.map((bucket) => bucket.bytesDownloaded), 0);
  const width = Math.max(240, buckets.length * 44);
  const height = 120;

  return <figure aria-label="Downloaded bytes by period">
    <figcaption>Downloaded bytes by period</figcaption>
    {buckets.length === 0 ? (
      <p>No downloads in this range.</p>
    ) : (
      <>
        <svg aria-hidden="true" focusable="false" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
          {buckets.map((bucket, index) => {
            const barWidth = 28;
            const barHeight = maxBytes > 0 ? Math.max(2, (bucket.bytesDownloaded / maxBytes) * 92) : 2;
            const x = index * 44 + 8;
            const y = height - barHeight - 20;

            return <g key={bucket.key}>
              <rect height={barHeight} width={barWidth} x={x} y={y} />
              <text aria-hidden="true" fontSize="9" textAnchor="middle" x={x + barWidth / 2} y={height - 6}>
                {bucket.label}
              </text>
            </g>;
          })}
        </svg>
        <table aria-label="Downloaded bytes by period data">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Downloads</th>
              <th scope="col">Bytes</th>
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

function TopItemsTable({ title, items }: { title: string; items: StatsTopItem[] }) {
  const maxCount = Math.max(...items.map((item) => item.count), 0);

  return <section aria-label={title}>
    <h3>{title}</h3>
    {items.length === 0 ? (
      <p>No downloads in this range.</p>
    ) : (
      <table aria-label={title}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
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

function StateChart({ stats }: { stats: DownloadStats }) {
  const total = stats.stateCounts.completed + stats.stateCounts.interrupted + stats.stateCounts.inProgress;

  return <section aria-label="Completed vs interrupted">
    <h3>Completed vs interrupted</h3>
    {total === 0 ? (
      <p>No downloads in this range.</p>
    ) : (
      <dl>
        <dt>Completed</dt>
        <dd>
          <meter max={total} min={0} value={stats.stateCounts.completed}>{stats.stateCounts.completed}</meter>
          {formatNumber(stats.stateCounts.completed)}
        </dd>
        <dt>Interrupted</dt>
        <dd>
          <meter max={total} min={0} value={stats.stateCounts.interrupted}>{stats.stateCounts.interrupted}</meter>
          {formatNumber(stats.stateCounts.interrupted)}
        </dd>
        <dt>In progress</dt>
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
