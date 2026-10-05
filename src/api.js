// contextBridge values are frozen. Keep renderer wrappers on a separate facade.
window.api = Object.assign({}, window.nativeApi);

// Report persistence separately from external synchronization.
Object.keys(window.api).filter(key => /^(set|add|update|delete|save|replace|import|clear)/.test(key)).forEach(key => {
  const original = window.api[key];
  window.api[key] = async (...args) => {
    try {
      const result = await original(...args);
      window.dispatchEvent(new CustomEvent('local-save', { detail: !(result && result.error) }));
      return result;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('local-save', { detail: false }));
      throw error;
    }
  };
});
