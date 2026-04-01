export function log(component: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${component}] ${message}`);
}
