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

function makeBoxDraggable(
  boxElement: HTMLElement,
  box: BoundingBox,
  imgWrapper: HTMLElement
) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  boxElement.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origLeft = box.left;
    origTop = box.top;

    // Prevent image drag
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    // Get image wrapper size
    const rect = imgWrapper.getBoundingClientRect();
    const dx = (e.clientX - startX) / rect.width;
    const dy = (e.clientY - startY) / rect.height;

    // Clamp values between 0 and 1
    box.left = Math.max(0, Math.min(1 - box.width, origLeft + dx));
    box.top = Math.max(0, Math.min(1 - box.height, origTop + dy));
    updateBoxPosition(boxElement, box);
  });

  window.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.userSelect = "";
    }
  });
}

function makeBoxResizable(
  boxElement: HTMLElement,
  box: BoundingBox,
  imgWrapper: HTMLElement,
  onUpdate?: () => void
) {
  // Helper to create a handle
  function createHandle(cursor: string, pos: string) {
    const handle = document.createElement("div");
    handle.style.position = "absolute";
    handle.style.width = "12px";
    handle.style.height = "12px";
    handle.style.background = "#fff";
    handle.style.border = "2px solid #ef4444";
    handle.style.borderRadius = "50%";
    handle.style.cursor = cursor;
    handle.style.zIndex = "10";
    // Position the handle
    switch (pos) {
      case "nw":
        handle.style.left = "-6px";
        handle.style.top = "-6px";
        break;
      case "ne":
        handle.style.right = "-6px";
        handle.style.top = "-6px";
        break;
      case "sw":
        handle.style.left = "-6px";
        handle.style.bottom = "-6px";
        break;
      case "se":
        handle.style.right = "-6px";
        handle.style.bottom = "-6px";
        break;
    }
    return handle;
  }

  // Resizing logic
  function setupResize(handle: HTMLElement, dir: "nw" | "ne" | "sw" | "se") {
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;
    let origWidth = 0;
    let origHeight = 0;

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = box.left;
      origTop = box.top;
      origWidth = box.width;
      origHeight = box.height;
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const rect = imgWrapper.getBoundingClientRect();
      const dx = (e.clientX - startX) / rect.width;
      const dy = (e.clientY - startY) / rect.height;

      let newLeft = origLeft;
      let newTop = origTop;
      let newWidth = origWidth;
      let newHeight = origHeight;

      if (dir === "nw") {
        newLeft = Math.max(
          0,
          Math.min(origLeft + dx, origLeft + origWidth - 0.01)
        );
        newTop = Math.max(
          0,
          Math.min(origTop + dy, origTop + origHeight - 0.01)
        );
        newWidth = origWidth - dx;
        newHeight = origHeight - dy;
      } else if (dir === "ne") {
        newTop = Math.max(
          0,
          Math.min(origTop + dy, origTop + origHeight - 0.01)
        );
        newWidth = origWidth + dx;
        newHeight = origHeight - dy;
      } else if (dir === "sw") {
        newLeft = Math.max(
          0,
          Math.min(origLeft + dx, origLeft + origWidth - 0.01)
        );
        newWidth = origWidth - dx;
        newHeight = origHeight + dy;
      } else if (dir === "se") {
        newWidth = origWidth + dx;
        newHeight = origHeight + dy;
      }

      // Clamp width/height and left/top
      newWidth = Math.max(0.01, Math.min(1 - newLeft, newWidth));
      newHeight = Math.max(0.01, Math.min(1 - newTop, newHeight));
      newLeft = Math.max(0, Math.min(1 - newWidth, newLeft));
      newTop = Math.max(0, Math.min(1 - newHeight, newTop));

      box.left = newLeft;
      box.top = newTop;
      box.width = newWidth;
      box.height = newHeight;

      updateBoxPosition(boxElement, box);
      if (onUpdate) onUpdate();
    });

    window.addEventListener("mouseup", () => {
      if (resizing) {
        resizing = false;
        document.body.style.userSelect = "";
      }
    });
  }

  // Add handles to corners
  const handles = [
    { dir: "nw", cursor: "nwse-resize" },
    { dir: "ne", cursor: "nesw-resize" },
    { dir: "sw", cursor: "nesw-resize" },
    { dir: "se", cursor: "nwse-resize" },
  ] as const;
  for (const { dir, cursor } of handles) {
    const handle = createHandle(cursor, dir);
    boxElement.appendChild(handle);
    setupResize(handle, dir);
  }
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

  // Button to create a new bounding box in the centre of the image
  const addBtn = element(
    "button",
    "mt-2 py-2 px-3 bg-green-500 text-black cursor-pointer",
    {
      textContent: "Add New Box",
      onclick: () => {
        // default box at the centre occupying 20% of the image dimensions
        const newBox: BoundingBox = {
          top: 0.4,
          left: 0.4,
          width: 0.2,
          height: 0.2,
        };
        boxes.push(newBox);
        const boxElement = element(
          "div",
          "absolute bg-white/40 border border-red-500"
        );
        updateBoxPosition(boxElement, newBox);
        imgWrapper.append(boxElement);

        // Enable dragging
        makeBoxDraggable(boxElement, newBox, imgWrapper);
        // Enable resizing
        makeBoxResizable(boxElement, newBox, imgWrapper, () => {
          if (activeBox && activeBox.box === newBox) {
            topInput.value = newBox.top.toString();
            leftInput.value = newBox.left.toString();
            widthInput.value = newBox.width.toString();
            heightInput.value = newBox.height.toString();
          }
        });

        // set as active and update inputs
        activeBox = { element: boxElement, box: newBox };
        topInput.value = newBox.top.toString();
        leftInput.value = newBox.left.toString();
        widthInput.value = newBox.width.toString();
        heightInput.value = newBox.height.toString();

        // clicking the box again should activate it
        boxElement.addEventListener("click", () => {
          activeBox = { element: boxElement, box: newBox };
          topInput.value = newBox.top.toString();
          leftInput.value = newBox.left.toString();
          widthInput.value = newBox.width.toString();
          heightInput.value = newBox.height.toString();
        });
      },
    }
  );

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
  editArea.append(
    addBtn,
    topInput,
    leftInput,
    widthInput,
    heightInput,
    saveBtn
  );

  for (const box of boxes) {
    const boxElement = element(
      "div",
      "absolute bg-white/40 border border-red-500"
    );
    updateBoxPosition(boxElement, box);
    imgWrapper.append(boxElement);

    // Enable dragging
    makeBoxDraggable(boxElement, box, imgWrapper);
    // Enable resizing
    makeBoxResizable(boxElement, box, imgWrapper, () => {
      if (activeBox && activeBox.box === box) {
        topInput.value = box.top.toString();
        leftInput.value = box.left.toString();
        widthInput.value = box.width.toString();
        heightInput.value = box.height.toString();
      }
    });

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

  // Add filter toggle UI
  const filterWrapper = element("div", "mb-4 flex items-center gap-2");
  const filterCheckbox = inputElement("", {
    type: "checkbox",
    id: "show-with-boxes",
  });
  const filterLabel = element("label", "text-white", {
    textContent: "Show only images with at least 1 bounding box",
    htmlFor: "show-with-boxes",
  });
  filterWrapper.append(filterCheckbox, filterLabel);
  main.appendChild(filterWrapper);

  const files = await readDataset(datasetImagesDir, datasetLabelsDir);

  // Preload all boxes for filtering
  const filesWithBoxes: { file: ImageFile; boxes: BoundingBox[] }[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const labelFileLines = await readTextFileLines(file.txtPath);
    const boxes: BoundingBox[] = [];
    for await (const labelLine of labelFileLines) {
      boxes.push(convertYoloToBoundingBox(labelLine));
    }
    filesWithBoxes.push({ file, boxes });
  }

  function renderFileList() {
    // Remove previous image wrappers
    Array.from(main.querySelectorAll(".image-wrapper")).forEach((el) =>
      el.remove()
    );

    const showOnlyWithBoxes = filterCheckbox.checked;
    for (const { file, boxes } of filesWithBoxes) {
      if (showOnlyWithBoxes && boxes.length === 0) continue;

      const wrapper = element(
        "div",
        "border border-stone-700 p-2 image-wrapper"
      );

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

  filterCheckbox.addEventListener("change", renderFileList);

  renderFileList();
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
