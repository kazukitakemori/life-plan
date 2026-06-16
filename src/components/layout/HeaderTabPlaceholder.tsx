interface HeaderTabPlaceholderProps {
  title: string;
  description?: string;
}

export function HeaderTabPlaceholder({
  title,
  description = 'この機能は準備中です。',
}: HeaderTabPlaceholderProps) {
  return (
    <div className="header-tab-placeholder">
      <h2 className="header-tab-placeholder-title">{title}</h2>
      <p className="header-tab-placeholder-text">{description}</p>
    </div>
  );
}
