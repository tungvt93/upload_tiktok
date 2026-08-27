
// Compact square action. Tooltip lives on a wrapper so it still shows when disabled.
const IconActionButton = ({ icon, onClick, disabled, title, color, bg, border, size = '36px' }) => (
  <span className="icon-btn-wrap" data-tooltip={title}>
    <button
      type="button"
      className="icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={title}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        background: bg,
        color,
        border: `1px solid ${border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0
      }}
    >
      {icon}
    </button>
  </span>
);

export default IconActionButton;
