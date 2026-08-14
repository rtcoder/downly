import { getSettings } from '../application/settings-repository';
import type { DownlySettings } from '../domain/settings/types';
import { normalizeDownload, type RawChromeDownload } from '../domain/downloads/normalize-download';
import { evaluateRules } from '../domain/organizer/evaluate-rules';

type FilenameSuggestion = Pick<ReturnType<typeof evaluateRules> extends infer Suggestion
  ? Exclude<Suggestion, null>
  : never, 'filename' | 'conflictAction'>;

type SuggestCallback = (suggestion?: FilenameSuggestion) => void;
type DeterminingFilenameListener = (download: RawChromeDownload, suggest: SuggestCallback) => boolean;

interface ChromeDownloadsListenerApi {
  downloads: {
    onDeterminingFilename: {
      addListener(listener: DeterminingFilenameListener): void;
    };
  };
}

export type SettingsLoader = () => Promise<DownlySettings>;

export function registerFilenameListener(
  chromeApi: ChromeDownloadsListenerApi,
  loadSettings: SettingsLoader = getSettings,
): void {
  chromeApi.downloads.onDeterminingFilename.addListener((download, suggest) => {
    let suggested = false;
    const suggestOnce = (suggestion?: FilenameSuggestion): void => {
      if (suggested) return;
      suggested = true;
      if (suggestion) {
        suggest(suggestion);
        return;
      }

      suggest();
    };

    void loadSettings()
      .then((settings) => {
        if (!settings.organizerEnabled) {
          suggestOnce();
          return;
        }

        const suggestion = evaluateRules(normalizeDownload(download), settings.rules, settings.conflictAction);
        suggestOnce(suggestion ? { filename: suggestion.filename, conflictAction: suggestion.conflictAction } : undefined);
      })
      .catch(() => suggestOnce());

    return true;
  });
}
