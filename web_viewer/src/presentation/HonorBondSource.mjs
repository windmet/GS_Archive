import bonds from '../../public/data/editorial/honor-bonds.json' with {type:'json'};
export function honorBondSource(entry) {
  const record = bonds.entries[entry?.id];
  return record && record.sourceName === entry.nameJa && record.resourceId === entry.resourceId ? record : null;
}
