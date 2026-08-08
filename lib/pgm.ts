const WHITESPACE_BYTES = [9, 10, 13, 32];
const COMMENT_MARKER = 35;

type Token = {
  value: string;
  nextIndex: number;
};

function isWhitespace(byte: number): boolean {
  return WHITESPACE_BYTES.includes(byte);
}

function readToken(bytes: Uint8Array, startIndex: number): Token {
  let index = startIndex;

  while (index < bytes.length && isWhitespace(bytes[index])) index++;

  if (bytes[index] === COMMENT_MARKER) {
    while (index < bytes.length && bytes[index] !== 10) index++;
    return readToken(bytes, index);
  }

  const tokenStart = index;
  while (index < bytes.length && !isWhitespace(bytes[index])) index++;

  return {
    value: new TextDecoder().decode(bytes.slice(tokenStart, index)),
    nextIndex: index,
  };
}

export async function parsePgm(file: File): Promise<HTMLCanvasElement> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let byteIndex = 0;

  const nextToken = () => {
    const token = readToken(bytes, byteIndex);
    byteIndex = token.nextIndex;
    return token.value;
  };

  const format = nextToken();
  const width = Number(nextToken());
  const height = Number(nextToken());
  const maximumValue = Number(nextToken());

  if (!["P2", "P5"].includes(format) || !width || !height || !maximumValue) {
    throw new Error("Please select a PGM file in P2 or P5 format.");
  }

  const pixels = new Uint8ClampedArray(width * height * 4);
  const setPixel = (pixelIndex: number, rawValue: number) => {
    const value = Math.round((rawValue / maximumValue) * 255);
    pixels.set([value, value, value, 255], pixelIndex * 4);
  };

  if (format === "P2") {
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex++) {
      setPixel(pixelIndex, Number(nextToken()));
    }
  } else {
    while (byteIndex < bytes.length && isWhitespace(bytes[byteIndex])) {
      byteIndex++;
    }

    const isSixteenBit = maximumValue > 255;
    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex++) {
      const rawValue = isSixteenBit
        ? bytes[byteIndex++] * 256 + bytes[byteIndex++]
        : bytes[byteIndex++];
      setPixel(pixelIndex, rawValue);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")!
    .putImageData(new ImageData(pixels, width, height), 0, 0);

  return canvas;
}
