export async function importFilesToCache(
  files: FileList | File[],
  baseUrl: string,
  cache: Cache,
  onProgress: (count: number, total: number) => void
): Promise<void> {
  const total = files.length;
  let count = 0;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
    if (!relativePath) continue;

    const url = new URL(relativePath, baseUrl).toString();
    const response = new Response(file);

    promises.push(
      cache.put(url, response).then(() => {
        count++;
        onProgress(count, total);
      })
    );
  }

  await Promise.all(promises);
}
