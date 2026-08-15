import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  it('keeps long download filenames available as a single-line title', () => {
    const filename = 'ACFrOgDsK-VdFsBIDeaYLFgA4UWF2AdAohXd7jco_bmwAWH8ld5XPuu_MGVFuQiakGGo7_qmBBewP6Kk57CMRBIaAwFei2zdbRt4iCWwNn0OJmKT_L1uOuACb.pDf';

    render(<DownloadRow download={download({ basename: filename, extension: '', filename: `/tmp/${filename}` })} />);

    const heading = screen.getByRole('heading', { name: filename });
    expect(heading.getAttribute('title')).toBe(filename);
  });

  it('renders an active download row with progress, status, and overflow cancel action', () => {
    const onCancel = vi.fn();

    render(<DownloadRow download={download()} metrics={activeMetrics} onCancel={onCancel} />);

    expect(screen.getByRole('article', { name: 'Report.pdf' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Actions for Report.pdf' })).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('512 B of 1.0 KB')).toBeTruthy();
    expect(screen.getByText('512 B/s')).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: 'Download progress for Report.pdf' });
    expect(progress.getAttribute('aria-valuenow')).toBe('50');
    expect(progress.getAttribute('aria-valuetext')).toBe('512 B of 1.0 KB');

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel Report.pdf' }));

    expect(onCancel).toHaveBeenCalledWith(1);
  });

  it('renders a completed download with visible history removal and overflow open action', () => {
    const onOpen = vi.fn();
    const onEraseHistory = vi.fn();

    render(<DownloadRow
      download={download({ state: 'complete', bytesReceived: 1_024, endTime: '2026-08-14T10:05:00.000Z' })}
      onOpen={onOpen}
      onEraseHistory={onEraseHistory}
    />);

    expect(screen.getByText('Complete')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Download progress for Report.pdf' }).getAttribute('aria-valuenow')).toBe('100');

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open Report.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Report.pdf from history' }));

    expect(onOpen).toHaveBeenCalledWith(1);
    expect(onEraseHistory).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('dialog', { name: 'Remove Report.pdf from history?' })).toBeNull();
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

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Retry Report.pdf' }));

    expect(screen.queryByRole('button', { name: 'Resume Report.pdf' })).toBeNull();
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it('renders a missing completed file as unavailable', () => {
    render(<DownloadRow
      download={download({ state: 'complete', exists: false })}
      onOpen={vi.fn()}
      onRemoveFile={vi.fn()}
      onShowInFolder={vi.fn()}
    />);

    expect(screen.getByText('Missing file')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Report.pdf' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Report.pdf in folder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete file Report.pdf' })).toBeNull();
  });

  it('removes history immediately while confirming file deletion', () => {
    const onEraseHistory = vi.fn();
    const onRemoveFile = vi.fn();

    render(<DownloadActions
      download={download({ state: 'complete' })}
      onEraseHistory={onEraseHistory}
      onRemoveFile={onRemoveFile}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Report.pdf from history' }));
    expect(onEraseHistory).toHaveBeenCalledWith(1);
    expect(onRemoveFile).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Remove Report.pdf from history?' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete file Report.pdf' }));
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete Report.pdf from disk?' });
    expect(deleteDialog).toBeTruthy();
    expect(deleteDialog.textContent).toContain('This deletes the downloaded file from disk.');
    fireEvent.click(screen.getByRole('button', { name: 'Delete file' }));
    expect(onRemoveFile).toHaveBeenCalledWith(1);
    expect(onEraseHistory).toHaveBeenCalledOnce();
  });

  it('focuses the safe dialog action and closes file deletion confirmations with Escape', () => {
    const onRemoveFile = vi.fn();

    render(<DownloadActions
      download={download({ state: 'complete' })}
      onRemoveFile={onRemoveFile}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete file Report.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Report.pdf from disk?' });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Delete Report.pdf from disk?' })).toBeNull();
    expect(onRemoveFile).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus inside destructive confirmation dialogs', () => {
    render(<DownloadActions
      download={download({ state: 'complete' })}
      onRemoveFile={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete file Report.pdf' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Report.pdf from disk?' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete file' });

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
  });

  it('renders copy URL actions from the overflow menu', () => {
    const onCopySourceUrl = vi.fn();
    const onCopyFinalUrl = vi.fn();

    render(<DownloadActions
      download={download({
        url: 'https://origin.example/report.pdf',
        finalUrl: 'https://cdn.example/report.pdf',
      })}
      onCopySourceUrl={onCopySourceUrl}
      onCopyFinalUrl={onCopyFinalUrl}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy source URL for Report.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy final URL for Report.pdf' }));

    expect(onCopySourceUrl).toHaveBeenCalledWith(1);
    expect(onCopyFinalUrl).toHaveBeenCalledWith(1);
  });

  it('keeps primary download actions as icon buttons and puts secondary actions in a menu', () => {
    render(<DownloadActions
      download={download({
        state: 'complete',
        url: 'https://origin.example/report.pdf',
        finalUrl: 'https://cdn.example/report.pdf',
      })}
      onCopyFinalUrl={vi.fn()}
      onCopySourceUrl={vi.fn()}
      onDownloadAgain={vi.fn()}
      onEraseHistory={vi.fn()}
      onOpen={vi.fn()}
      onRemoveFile={vi.fn()}
      onShowInFolder={vi.fn()}
    />);

    const toolbar = screen.getByRole('toolbar', { name: 'Actions for Report.pdf' });
    expect(screen.getByRole('button', { name: 'Show Report.pdf in folder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Report.pdf from history' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download Report.pdf again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy source URL for Report.pdf' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy final URL for Report.pdf' })).toBeNull();
    expect(within(toolbar).queryByText('Download again')).toBeNull();
    expect(within(toolbar).queryByText('Copy source URL')).toBeNull();
    expect(within(toolbar).queryByText('Copy final URL')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    expect(screen.getByRole('menuitem', { name: 'Download Report.pdf again' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copy source URL for Report.pdf' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Copy final URL for Report.pdf' })).toBeTruthy();
    expect(within(toolbar).getAllByRole('img', { hidden: true }).length).toBeGreaterThanOrEqual(3);
  });

  it('closes the download action menu when the menu overlay is clicked', () => {
    render(<DownloadActions
      download={download({ state: 'complete' })}
      onDownloadAgain={vi.fn()}
      onOpen={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Report.pdf' }));
    expect(screen.getByRole('menuitem', { name: 'Download Report.pdf again' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close action menu' }));

    expect(screen.queryByRole('menuitem', { name: 'Download Report.pdf again' })).toBeNull();
  });

  it('renders status above progress inside the row progress section', () => {
    render(<DownloadRow download={download()} metrics={activeMetrics} />);

    const progressSection = document.querySelector('.download-row-progress');

    expect(progressSection).toBeTruthy();
    expect(progressSection?.firstElementChild?.textContent).toContain('In progress');
    expect(progressSection?.querySelector('[role="progressbar"]')).toBeTruthy();
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
      <DownloadActions download={download({ state: 'complete' })} onEraseHistory={vi.fn()} />
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
      <ToastRegion
        messages={[{ id: 'saved', tone: 'success', message: 'Saved', actionLabel: 'Undo', onAction: onConfirm }]}
        onDismiss={onDismiss}
      />
    </>);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search downloads' }), { target: { value: 'invoice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Saved' }));

    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Archive file' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Remove download?' })).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('invoice');
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenCalledWith('saved');
  });
});
