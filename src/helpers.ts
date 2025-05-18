import { readDir, writeTextFile } from "@tauri-apps/plugin-fs";
import { path } from "@tauri-apps/api";

export interface BoundingBox {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface FileInfo {
  basename: string;
  imageName: string;
  imagePath: string;
  txtName: string;
  txtPath: string;
}

// Convert YOLO format string to BoundingBox
export function convertYoloToBoundingBox(yoloLine: string): BoundingBox {
  const [_, xCenter, yCenter, width, height] = yoloLine
    .split(" ")
    .map(parseFloat);

  return {
    width: width,
    height: height,
    left: xCenter - width / 2,
    top: yCenter - height / 2,
  };
}

function removeExtension(filename: string) {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return filename;
  return filename.slice(0, lastDotIndex);
}

export async function readDataset(
  imagesDir: string,
  labelsDir: string
): Promise<FileInfo[]> {
  const files = await readDir(imagesDir)
    .then((images) =>
      images
        .filter((x) => x.isFile)
        .map(async (x) => {
          const basename = removeExtension(x.name);
          const txtName = `${basename}.txt`;
          return {
            basename,
            imageName: x.name,
            imagePath: await path.join(imagesDir, x.name),
            txtName: txtName,
            txtPath: await path.join(labelsDir, txtName),
          };
        })
    )
    .then((x) => Promise.all(x));

  if (files.length > 0 && Number.isFinite(parseFloat(files[0].basename))) {
    files.sort(
      (a, b) =>
        parseFloat(removeExtension(a.basename)) -
        parseFloat(removeExtension(b.basename))
    );
  }

  return files;
}

export async function saveImageLabels(txtPath: string, boxes: BoundingBox[]) {
  let contents = "";
  for (const box of boxes) {
    const xCenter = box.left + box.width / 2;
    const yCenter = box.top + box.height / 2;
    contents += `0 ${xCenter} ${yCenter} ${box.width} ${box.height}\n`;
  }
  console.log(contents);
  await writeTextFile(txtPath, contents, {
    append: false,
  }).catch((err) => console.log(err));
}
