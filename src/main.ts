import { readTextFileLines, remove } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { element, inputElement, one } from "./dom";
import {
  BoundingBox,
  convertYoloToBoundingBox,
  FileInfo as ImageFile,
  readDataset,
  saveImageLabels,
} from "./helpers";
import { addRecentDataset, getRecentDatasets } from "./store";

const main = one("main");
const dialog = element(
  "dialog",
  "m-auto outline-none backdrop:bg-stone-900/75"
);
document.body.append(dialog);

function updateBoxPosition(boxElement: HTMLElement, box: BoundingBox) {
  boxElement.style.top = `${box.top * 100}%`;
  boxElement.style.left = `${box.left * 100}%`;
  boxElement.style.width = `${box.width * 100}%`;
  boxElement.style.height = `${box.height * 100}%`;
}

function renderEditor(file: ImageFile, boxes: BoundingBox[]) {
  const panel = element("div", "grid grid-cols-[1fr_20rem]");

  const imgWrapper = element("div", "relative cursor-pointer h-[90vh]");
  const img = element("img", "w-auto h-full", {
    src: convertFileSrc(file.imagePath),
  });
  imgWrapper.append(img);

  const editArea = element("div", "bg-stone-900 p-5");
  editArea.append(
    element("button", "py-2 px-3 bg-stone-200 text-black cursor-pointer", {
      textContent: "Close",
      onclick: () => {
        dialog.close();
        dialog.replaceChildren();
      },
    })
  );

  let activeBox: { box: BoundingBox; element: HTMLElement } | null = null;

  const topInput = inputElement("mt-2", {
    type: "number",
    value: "",
    step: "0.001",
    oninput: (event) => {
      if (activeBox) {
        activeBox.box.top = Number((event.target as any).value);
        updateBoxPosition(activeBox.element, activeBox.box);
      }
    },
  });
  const leftInput = inputElement("mt-2", {
    type: "number",
    value: "",
    step: "0.001",
    oninput: (event) => {
      if (activeBox) {
        activeBox.box.left = Number((event.target as any).value);
        updateBoxPosition(activeBox.element, activeBox.box);
      }
    },
  });
  const widthInput = inputElement("mt-2", {
    type: "number",
    value: "",
    step: "0.001",
    oninput: (event) => {
      if (activeBox) {
        activeBox.box.width = Number((event.target as any).value);
        updateBoxPosition(activeBox.element, activeBox.box);
      }
    },
  });
  const heightInput = inputElement("mt-2", {
    type: "number",
    value: "",
    step: "0.001",
    oninput: (event) => {
      if (activeBox) {
        activeBox.box.height = Number((event.target as any).value);
        updateBoxPosition(activeBox.element, activeBox.box);
      }
    },
  });
  const saveBtn = element(
    "button",
    "mt-2 py-2 px-3 bg-red-500 text-black cursor-pointer",
    {
      textContent: "Save",
      onclick: async () => {
        await saveImageLabels(file.txtPath, boxes);
      },
    }
  );
  editArea.append(topInput, leftInput, widthInput, heightInput, saveBtn);

  for (const box of boxes) {
    const boxElement = element(
      "div",
      "absolute bg-white/40 border border-red-500"
    );
    updateBoxPosition(boxElement, box);
    imgWrapper.append(boxElement);

    boxElement.addEventListener("click", () => {
      activeBox = { element: boxElement, box: box };
      topInput.value = box.top.toString();
      leftInput.value = box.left.toString();
      widthInput.value = box.width.toString();
      heightInput.value = box.height.toString();
    });
  }

  panel.append(imgWrapper, editArea);
  dialog.replaceChildren(panel);
  dialog.showModal();
}

async function renderImages(
  datasetImagesDir: string,
  datasetLabelsDir: string
) {
  main.replaceChildren();
  const files = await readDataset(datasetImagesDir, datasetLabelsDir);

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const labelFileLines = await readTextFileLines(file.txtPath);
    const boxes: BoundingBox[] = [];
    for await (const labelLine of labelFileLines) {
      boxes.push(convertYoloToBoundingBox(labelLine));
    }

    const wrapper = element("div", "border border-stone-700 p-2");

    const actions = element("div", "flex pt-2 text-white gap-4");

    const name = element("p", "", {
      textContent: file.basename,
    });
    actions.append(name);

    const removeBtn = element("button", "cursor-pointer px-1 bg-red-500", {
      textContent: "Remove",
    });
    removeBtn.addEventListener("click", async () => {
      await Promise.all([remove(file.imagePath), remove(file.txtPath)]);
      wrapper.remove();
    });
    actions.append(removeBtn);

    const imgWrapper = element("div", "relative cursor-pointer");
    const img = element("img", "w-full h-auto", {
      src: convertFileSrc(file.imagePath),
    });
    imgWrapper.addEventListener("click", () => {
      renderEditor(file, boxes);
    });

    for (const box of boxes) {
      const boxElement = element(
        "div",
        "absolute bg-white/40 border border-red-500"
      );
      updateBoxPosition(boxElement, box);
      imgWrapper.append(boxElement);
    }

    imgWrapper.appendChild(img);

    wrapper.appendChild(imgWrapper);
    wrapper.appendChild(actions);

    main.appendChild(wrapper);
  }
}

async function renderForm() {
  const form = element(
    "form",
    "mt-10 md:col-start-2 p-2 border border-stone-700"
  );

  const imagesDirInput = inputElement("mt-1", {
    required: true,
    placeholder: "Dataset Images Directory",
    id: "images-directory",
  });
  const labelsDirInput = inputElement("mt-1", {
    required: true,
    placeholder: "Dataset Labels Directory",
    id: "labels-directory",
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const datasetImagesDir = imagesDirInput.value;
    const datasetLabelsDir = labelsDirInput.value;

    form.remove();
    addRecentDataset(datasetImagesDir, datasetLabelsDir);
    await renderImages(datasetImagesDir, datasetLabelsDir);
  });

  form.append(
    element("label", "text-white", {
      textContent: "Dataset Images Directory",
      htmlFor: "images-directory",
    }),
    imagesDirInput,
    element("label", "mt-2 block text-white", {
      textContent: "Dataset Labels Directory",
      htmlFor: "labels-directory",
    }),
    labelsDirInput,
    element("button", "mt-2 p-2 w-full bg-red-500", { textContent: "Start" })
  );

  main.append(form);

  // recent datasets
  const recentDatasets = await getRecentDatasets();
  console.log(recentDatasets);
  const datasetsWrapper = element(
    "div",
    "md:col-start-2 flex flex-col gap-4 mt-4 text-white"
  );
  datasetsWrapper.append(
    ...recentDatasets.map((x) =>
      element("button", "p-2 border border-stone-700 cursor-pointer", {
        textContent: `${x.images}`,
        onclick: () => {
          imagesDirInput.value = x.images;
          labelsDirInput.value = x.labels;
        },
      })
    )
  );
  main.append(datasetsWrapper);
}

await renderForm();
