export function hydrateHomeProfile(detail, pageDescriptors, pages) {
  if (pageDescriptors.length !== pages.length) throw new Error('Home cue page count mismatch');
  const queues = new Map(pageDescriptors.map((descriptor, index) => {
    if (!Array.isArray(pages[index]?.rows)) throw new Error('Home cue page is incomplete');
    return [descriptor.url, [...pages[index].rows]];
  }));
  const cues = detail.cueIndex.map(entry => {
    const cue = queues.get(entry.page?.url)?.shift();
    if (!cue || cue.id !== entry.id || !cue.previewStep?.state)
      throw new Error('Home cue page is incomplete');
    return cue;
  });
  if ([...queues.values()].some(queue => queue.length)) throw new Error('Home cue page count mismatch');
  return { ...detail.profile, cues };
}
