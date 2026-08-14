export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search downloads' }: SearchInputProps) {
  return <label>
    <span>Search downloads</span>
    <input
      aria-label="Search downloads"
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  </label>;
}
