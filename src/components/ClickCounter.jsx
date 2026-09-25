export const ClickCounter = ({ count = 0, loading = false, error = null, label, className = '' }) => {
  if (loading) {
    return <span className={`view-counter loading ${className}`}>Loading counts...</span>;
  }

  if (error) {
    return <span className={`view-counter error ${className}`}>Unavailable</span>;
  }

  return (
    <div className={className}>
      <span>{label}</span>&nbsp;
      <span>{count.toLocaleString()}</span>
    </div>
  );
};
