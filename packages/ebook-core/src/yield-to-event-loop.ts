export async function yieldEvery(index: number, interval: number) {
  if (index > 0 && index % interval === 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
