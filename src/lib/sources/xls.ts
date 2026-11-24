/**
 * A minimal reader for legacy binary Excel files (.xls, BIFF8 inside an OLE2
 * compound file), enough for the plain tables INDEC publishes: it returns the
 * numbers and texts of the first worksheet. Formulas, dates, formats and every
 * other sheet are ignored. read-excel-file only reads .xlsx.
 */

export type XlsCell = number | string;

/** Rows of the first worksheet, by index; a missing cell is undefined. */
export type XlsRows = XlsCell[][];

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;

/** Reads one stream of an OLE2 compound file by its directory name. */
function readCompoundStream(file: Uint8Array, wanted: string[]): Uint8Array {
  if (file.length < 512 || SIGNATURE.some((byte, i) => file[i] !== byte)) {
    throw new Error("Not an OLE2 compound file (.xls)");
  }
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const miniCutoff = u32(56);
  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;

  // The sectors of the FAT: the first 109 are listed in the header, the rest in the DIFAT chain.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) fatSectors.push(u32(76 + i * 4));
  for (let sector = u32(68), left = u32(72); left > 0 && sector < END_OF_CHAIN; left--) {
    const base = sectorOffset(sector);
    for (let i = 0; i < sectorSize / 4 - 1; i++) fatSectors.push(u32(base + i * 4));
    sector = u32(base + sectorSize - 4);
  }
  const fat: number[] = [];
  for (const sector of fatSectors.slice(0, u32(44))) {
    for (let i = 0; i < sectorSize / 4; i++) fat.push(u32(sectorOffset(sector) + i * 4));
  }

  const chain = (start: number, table: number[]) => {
    const sectors: number[] = [];
    for (let sector = start; sector !== END_OF_CHAIN && sector !== FREE_SECTOR; sector = table[sector]) {
      if (sector >= table.length || sectors.length > table.length) throw new Error("Broken sector chain in .xls");
      sectors.push(sector);
    }
    return sectors;
  };
  const readChain = (start: number) => {
    const sectors = chain(start, fat);
    const out = new Uint8Array(sectors.length * sectorSize);
    sectors.forEach((sector, i) => out.set(file.subarray(sectorOffset(sector), sectorOffset(sector) + sectorSize), i * sectorSize));
    return out;
  };

  const directory = readChain(u32(48));
  const dirView = new DataView(directory.buffer);
  type Entry = { name: string; start: number; size: number };
  const entries: Entry[] = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameBytes = dirView.getUint16(offset + 64, true);
    const name = String.fromCharCode(
      ...Array.from({ length: Math.max(0, nameBytes / 2 - 1) }, (_, i) => dirView.getUint16(offset + i * 2, true)),
    );
    entries.push({ name, start: dirView.getUint32(offset + 116, true), size: dirView.getUint32(offset + 120, true) });
  }

  const entry = entries.find((e) => wanted.includes(e.name));
  if (!entry) throw new Error(`No ${wanted.join(" or ")} stream in .xls`);
  if (entry.size >= miniCutoff) return readChain(entry.start).subarray(0, entry.size);

  // Small streams live in the mini stream, which is the root entry's chain, indexed by the mini FAT.
  const miniStream = readChain(entries[0].start);
  const miniFatBytes = readChain(u32(60));
  const miniFat = Array.from({ length: miniFatBytes.length / 4 }, (_, i) => new DataView(miniFatBytes.buffer).getUint32(i * 4, true));
  const sectors = chain(entry.start, miniFat);
  const out = new Uint8Array(sectors.length * miniSectorSize);
  sectors.forEach((sector, i) =>
    out.set(miniStream.subarray(sector * miniSectorSize, (sector + 1) * miniSectorSize), i * miniSectorSize),
  );
  return out.subarray(0, entry.size);
}

const RECORD = {
  eof: 0x000a,
  continue: 0x003c,
  boundSheet: 0x0085,
  mulRk: 0x00bd,
  sst: 0x00fc,
  labelSst: 0x00fd,
  number: 0x0203,
  rk: 0x027e,
} as const;

type BiffRecord = { type: number; offset: number; data: Uint8Array };

function* records(stream: Uint8Array, from = 0): Generator<BiffRecord> {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let offset = from; offset + 4 <= stream.length; ) {
    const type = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    yield { type, offset, data: stream.subarray(offset + 4, offset + 4 + length) };
    offset += 4 + length;
  }
}

const dataView = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** An RK value: a 30-bit integer or the high bits of a double, optionally divided by 100. */
function decodeRk(rk: number): number {
  let value: number;
  if (rk & 0x02) {
    value = rk >> 2;
  } else {
    const bits = new DataView(new ArrayBuffer(8));
    bits.setUint32(4, rk & 0xfffffffc, true);
    value = bits.getFloat64(0, true);
  }
  return rk & 0x01 ? value / 100 : value;
}

/**
 * The shared string table. Its strings may be split across CONTINUE records;
 * each continued piece of text starts with a fresh flags byte.
 */
function readSharedStrings(parts: Uint8Array[]): string[] {
  let part = 0;
  let pos = 0;
  const byte = () => {
    while (pos >= parts[part].length) {
      part++;
      pos = 0;
      if (part >= parts.length) throw new Error("Truncated shared string table in .xls");
    }
    return parts[part][pos++];
  };
  const u16 = () => byte() | (byte() << 8);
  const u32 = () => (u16() | (u16() << 16)) >>> 0;
  const skip = (count: number) => {
    for (let i = 0; i < count; i++) byte();
  };

  u32(); // total references
  const unique = u32();
  const strings: string[] = [];
  for (let s = 0; s < unique; s++) {
    let length = u16();
    let flags = byte();
    const runs = flags & 0x08 ? u16() : 0;
    const extension = flags & 0x04 ? u32() : 0;
    let text = "";
    while (length > 0) {
      const wide = flags & 0x01;
      const available = parts[part].length - pos;
      const take = Math.min(length, wide ? Math.floor(available / 2) : available);
      for (let i = 0; i < take; i++) text += String.fromCharCode(wide ? u16() : byte());
      length -= take;
      if (length > 0) {
        // The text continues in the next record, after its own flags byte.
        part++;
        pos = 0;
        if (part >= parts.length) throw new Error("Truncated shared string table in .xls");
        flags = byte();
      }
    }
    skip(runs * 4 + extension);
    strings.push(text);
  }
  return strings;
}

/** Numbers and texts of the first worksheet of a BIFF8 .xls file. */
export function readXls(file: Uint8Array): XlsRows {
  const stream = readCompoundStream(file, ["Workbook", "Book"]);

  let firstSheet: number | undefined;
  let strings: string[] = [];
  let sstParts: Uint8Array[] | undefined;
  for (const record of records(stream)) {
    if (sstParts && record.type === RECORD.continue) {
      sstParts.push(record.data);
      continue;
    }
    if (sstParts) {
      strings = readSharedStrings(sstParts);
      sstParts = undefined;
    }
    if (record.type === RECORD.boundSheet && firstSheet === undefined) firstSheet = dataView(record.data).getUint32(0, true);
    else if (record.type === RECORD.sst) sstParts = [record.data];
    else if (record.type === RECORD.eof) break;
  }
  if (firstSheet === undefined) throw new Error("No worksheet in .xls");

  const rows: XlsRows = [];
  const set = (row: number, col: number, value: XlsCell) => {
    (rows[row] ??= [])[col] = value;
  };
  for (const record of records(stream, firstSheet)) {
    const view = dataView(record.data);
    const row = record.data.length >= 4 ? view.getUint16(0, true) : 0;
    const col = record.data.length >= 4 ? view.getUint16(2, true) : 0;
    if (record.type === RECORD.number) set(row, col, view.getFloat64(6, true));
    else if (record.type === RECORD.rk) set(row, col, decodeRk(view.getUint32(6, true)));
    else if (record.type === RECORD.mulRk) {
      const last = view.getUint16(record.data.length - 2, true);
      for (let c = col; c <= last; c++) set(row, c, decodeRk(view.getUint32(4 + (c - col) * 6 + 2, true)));
    } else if (record.type === RECORD.labelSst) {
      const text = strings[view.getUint32(6, true)];
      if (text !== undefined) set(row, col, text);
    } else if (record.type === RECORD.eof) break;
  }
  return rows;
}
