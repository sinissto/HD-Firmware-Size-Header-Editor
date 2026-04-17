export function folderBasename(folderPath: string): string {
  return folderPath.split(/[\\/]/).pop() ?? folderPath;
}
