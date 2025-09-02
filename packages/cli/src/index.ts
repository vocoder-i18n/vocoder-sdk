// Main CLI package exports

// CLI utility functions
export function validateApiKey(apiKey: string): boolean {
  return Boolean(apiKey && apiKey.length > 0);
}

export function formatProjectId(projectId: string): string {
  return projectId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export function generateConfig(apiKey: string, projectId: string) {
  return {
    apiKey: validateApiKey(apiKey) ? apiKey : "invalid",
    projectId: formatProjectId(projectId),
    timestamp: new Date().toISOString(),
  };
}
