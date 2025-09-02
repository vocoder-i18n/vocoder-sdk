// Isomorphic environment variable getter
export const getEnvVar = (key: string): string | undefined => {
  // Server
  if (typeof process !== 'undefined' && process.env && typeof process.env === 'object') {
    return (process.env as Record<string, string | undefined>)[key];
  }
  
  // Client
  if (typeof window !== 'undefined') {
    // Check for global variables set by the parent app
    const globalKey = `__${key}__`;
    if ((window as any)[globalKey]) {
      return (window as any)[globalKey];
    }
    
    // Check for meta tags (common pattern)
    const metaTag = document.querySelector(`meta[name="${key}"]`);
    if (metaTag) {
      return metaTag.getAttribute('content') || undefined;
    }
  }
  
  return undefined;
}; 