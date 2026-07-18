function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function fileRecord(name, content) {
  const data = Buffer.from(content, "utf8");
  const filename = Buffer.from(name, "utf8");
  const checksum = crc32(data);
  const { time, day } = dosDateTime();
  const local = Buffer.alloc(30 + filename.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  filename.copy(local, 30);
  return { name, filename, data, local, checksum, time, day };
}

export function correctedPackageZip(project, review) {
  const files = [
    fileRecord(
      "readme.md",
      `# otherend corrected package\n\nthis is an otai paid-tier handoff package for "${project.title}".\n\nit does not secretly rewrite your whole app. it gives your builder or coding tool a corrected approach, safer plan, and implementation instructions based on the review.\n`,
    ),
    fileRecord(
      "corrected-approach.md",
      `# corrected approach\n\n${(review.paidFixes || []).map((item) => `- ${item}`).join("\n")}\n\n## blockers to fix\n\n${(review.blockers || []).map((item) => `- ${item}`).join("\n")}\n`,
    ),
    fileRecord("implementation-prompt.txt", review.implementationPrompt || ""),
    fileRecord(
      "launch-checklist.md",
      `# launch checklist\n\n${(review.controls || []).map((item) => `- ${item}`).join("\n")}\n\nreadiness: ${review.readiness}%\n`,
    ),
  ];

  let offset = 0;
  const central = [];
  const chunks = [];
  for (const file of files) {
    chunks.push(file.local, file.data);
    const centralFile = Buffer.alloc(46 + file.filename.length);
    centralFile.writeUInt32LE(0x02014b50, 0);
    centralFile.writeUInt16LE(20, 4);
    centralFile.writeUInt16LE(20, 6);
    centralFile.writeUInt16LE(0, 8);
    centralFile.writeUInt16LE(0, 10);
    centralFile.writeUInt16LE(file.time, 12);
    centralFile.writeUInt16LE(file.day, 14);
    centralFile.writeUInt32LE(file.checksum, 16);
    centralFile.writeUInt32LE(file.data.length, 20);
    centralFile.writeUInt32LE(file.data.length, 24);
    centralFile.writeUInt16LE(file.filename.length, 28);
    centralFile.writeUInt32LE(offset, 42);
    file.filename.copy(centralFile, 46);
    central.push(centralFile);
    offset += file.local.length + file.data.length;
  }

  const centralSize = central.reduce((total, item) => total + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}
