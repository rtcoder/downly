import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActiveDownloadMetrics } from '../../src/application/active-download-sampler';
import type { DownloadRecord } from '../../src/domain/downloads/types';
import {
  ConfirmDialog,
  DownloadActions,
  DownloadProgress,
  DownloadRow,
  DownloadStatus,
  EmptyState,
  FileCategoryIcon,
  SearchInput,
  ToastRegion,
} from '../../src/ui/shared';

function download(overrides: Partial<DownloadRecord> = {}): DownloadRecord {
  return {
    id: 1,
    filename: '/Users/test/Report.pdf',
    basename: 'Report',
    extension: 'pdf',
    mime: 'application/pdf',
    category: 'document',
    state: 'in_progress',
    paused: false,
    canResume: false,
    exists: true,
    danger: 'safe',
    error: null,
    url: 'https://example.com/report.pdf',
    finalUrl: null,
    referrer: null,
    sourceDomain: 'example.com',
    bytesReceived: 512,
    totalBytes: 1_024,
    fileSize: 1_024,
    startTime: '2026-08-14T10:00:00.000Z',
    endTime: null,
    estimatedEndTime: null,
    ...overrides,
  };
}

const activeMetrics: ActiveDownloadMetrics = {
  downloadId: 1,
  bytesPerSecond: 512,
  etaSeconds: 1,
};

afterEach(() => {
  cleanup();
});

describe('shared download components', () => {
  it('renders an active download row with progress, status, and cancel action', () => {
    const onCancel = vi.fn();

    render(<DownloadRow download={download()} metrics={activeMetrics} onCancel={onCancel} />);

    expect(screen.getByRole('article', { name: 'Report.pdf' })).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('512 B of 1.0 KB')).toBeTruthy();
    expect(screen.getByText('512 B/s')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Download progress for Report.pdf' }).getAttribute('aria-valuenow')).toBe('50');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Report.pdf' }));

    expect(onCancel).toHaveBeenCalledWith(1);
  });

  it('renders a completed download with open and remove actions', () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();

    render(<DownloadRow
      download={download({ state: 'complete', bytesReceived: 1_024, endTime: '2026-08-14T10:05:00.000Z' })}
      onOpen={onOpen}
      onRemove={onRemove}
    />);

    expect(screen.getByText('Complete')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Download progress for Report.pdf' }).getAttribute('aria-valuenow')).toBe('100');

    fireEvent.click(screen.getByRole('button', { name: 'Open Report.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Report.pdf' }));

    expect(onOpen).toHaveBeenCalledWith(1);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('renders an interrupted resumable download with error context', () => {
    const onResume = vi.fn();

    render(<DownloadRow
      download={download({
        state: 'interrupted',
        canResume: true,
        error: 'NETWORK_FAILED',
        bytesReceived: 256,
      })}
      onResume={onResume}
    />);

    expect(screen.getByText('Interrupted')).toBeTruthy();
    expect(screen.getByText('NETWORK_FAILED')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resume Report.pdf' }));

    expect(onResume).toHaveBeenCalledWith(1);
  });

  it('renders retry for interrupted downloads that cannot resume', () => {
    const onRetry = vi.fn();

    render(<DownloadRow
      download={download({
        state: 'interrupted',
        canResume: false,
        error: 'FILE_FAILED',
      })}
      onRetry={onRetry}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry Report.pdf' }));

    expect(screen.queryByRole('button', { name: 'Resume Report.pdf' })).toBeNull();
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it('renders a missing completed file as unavailable', () => {
    render(<DownloadRow download={download({ state: 'complete', exists: false })} />);

    expect(screen.getByText('Missing file')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Report.pdf' })).toBeNull();
  });

  it('ignores stale metrics from a different download row', () => {
    render(<DownloadProgress
      download={download()}
      metrics={{ downloadId: 999, bytesPerSecond: 2_048, etaSeconds: 3 }}
    />);

    expect(screen.getByText('Idle')).toBeTruthy();
    expect(screen.getByText('ETA unknown')).toBeTruthy();
    expect(screen.queryByText('2.0 KB/s')).toBeNull();
  });

  it('exposes focused subcomponents for reuse', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();

    render(<>
      <DownloadProgress download={download()} metrics={activeMetrics} />
      <DownloadStatus download={download({ paused: true })} />
      <DownloadActions download={download({ state: 'complete' })} onRemove={vi.fn()} />
      <FileCategoryIcon category="archive" />
      <SearchInput value="report" onChange={onChange} />
      <EmptyState title="No downloads" description="Try another search." />
      <ConfirmDialog
        open
        title="Remove download?"
        description="This only removes it from history."
        confirmLabel="Remove"
        onConfirm={onConfirm}
        onCancel={onDismiss}
      />
      <ToastRegion messages={[{ id: 'saved', tone: 'success', message: 'Saved' }]} onDismiss={onDismiss} />
    </>);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search downloads' }), { target: { value: 'invoice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Saved' }));

    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Archive file' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Remove download?' })).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('invoice');
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledWith('saved');
  });
});
