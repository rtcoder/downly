import {t} from '../i18n';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({value, onChange, placeholder = t('shared.search.label')}: SearchInputProps) {
  return <label>
    <span>{t('shared.search.label')}</span>
    <input
      aria-label={t('shared.search.label')}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  </label>;
}
