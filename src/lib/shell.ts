/**
 * Thin wrapper around Application.currentApplication().doShellScript.
 * JXA has no fs/child_process, so shelling out via Standard Additions
 * is the standard escape hatch for file I/O.
 */
export function shell(cmd: string): string {
  const app = Application.currentApplication();
  app.includeStandardAdditions = true;
  return app.doShellScript(cmd);
}

export function homeDir(): string {
  return getEnvVar('HOME');
}

/**
 * Resolves the directory this workflow's compiled main.js/open.js/revalidate.js
 * live in. Alfred sets the script's working directory (PWD) to the workflow's
 * own directory when it runs a Script Filter / Run Script action, which is
 * the most reliable way to locate sibling scripts (there's no dedicated
 * "workflow path" env var exposed to JXA).
 */
export function getWorkflowPath(): string {
  return getEnvVar('PWD') || '.';
}

export function getEnvVar(name: string): string {
  const env = $.NSProcessInfo.processInfo.environment;
  const value = env.objectForKey(name);
  return value ? String(value.js) : '';
}
