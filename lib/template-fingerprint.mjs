import { createHash } from "node:crypto";
import sharp from "sharp";

const CROP_MARGINS = [0, 0.04, 0.08, 0.14];

function bitStringToHex(bits) {
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

async function differenceHash(image, metadata, margin) {
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const left = Math.round(width * margin);
  const top = Math.round(height * margin);
  const cropWidth = Math.max(1, width - left * 2);
  const cropHeight = Math.max(1, height - top * 2);
  const { data } = await image
    .clone()
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column;
      bits += data[offset] > data[offset + 1] ? "1" : "0";
    }
  }
  return bitStringToHex(bits);
}

export function visualHashDistance(left, right) {
  const value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let bits = value;
  let count = 0;
  while (bits) {
    count += Number(bits & 1n);
    bits >>= 1n;
  }
  return count;
}

export function minimumVisualDistance(leftHashes = [], rightHashes = []) {
  let distance = Number.POSITIVE_INFINITY;
  for (const left of leftHashes) {
    for (const right of rightHashes) {
      distance = Math.min(distance, visualHashDistance(left, right));
    }
  }
  return distance;
}

export async function fingerprintImage(bytes) {
  const image = sharp(bytes, { failOn: "error" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Image dimensions could not be read.");

  const visualHashes = [];
  for (const margin of CROP_MARGINS) {
    visualHashes.push(await differenceHash(image, metadata, margin));
  }

  const pixels = metadata.width * metadata.height;
  const resolutionScore = Math.min(70, Math.round(Math.log10(Math.max(pixels, 1)) * 13));
  const fileScore = Math.min(20, Math.round(Math.log10(Math.max(bytes.byteLength, 1)) * 4));

  return {
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    visualHashes,
    width: metadata.width,
    height: metadata.height,
    qualityScore: Math.min(100, resolutionScore + fileScore + 10)
  };
}

