export async function importFiles(
  files: FileList | File[],
  baseUrl: string,
  onProgress: (progress: number, text: string) => void,
  loadingText: string
): Promise<void> {
  const cache = await caches.open('webllm/model');
  const total = files.length;
  let count = 0;

  const promises = Array.from(files).map(async (file) => {
    // Cast to any because webkitRelativePath is specific to input type="file" webkitdirectory
    const relativePath = (file as any).webkitRelativePath.split('/').slice(1).join('/');
    if (!relativePath) return;

    const url = new URL(relativePath, baseUrl).toString();
    const response = new Response(file);
    await cache.put(url, response);

    count++;
    onProgress(
      (count / total) * 100,
      `${loadingText} (${count}/${total})`,
    );
  });

  await Promise.all(promises);
}
