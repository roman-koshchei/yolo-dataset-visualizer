import { readDir, readTextFileLines, remove } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { path } from "@tauri-apps/api";
import { element, one } from "./dom";
import { BoundingBox, convertYoloToBoundingBox, readDataset } from "./helpers";

const main = one("main");
const dialog = element(
  "dialog",
  "m-auto outline-none backdrop:bg-stone-900/75"
);
dialog.addEventListener("click", () => {
  dialog.close();
});
document.body.append(dialog);

async function renderImages(
  datasetImagesDir: string,
  datasetLabelsDir: string
) {
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

    const editBtn = element("button", "cursor-pointer px-1 bg-blue-500", {
      textContent: "Edit",
    });
    editBtn.addEventListener("click", async () => {});
    actions.append(editBtn);

    const imgWrapper = element("div", "relative cursor-pointer");
    const img = element("img", "w-full h-auto", {
      src: convertFileSrc(file.imagePath),
    });
    imgWrapper.addEventListener("click", () => {
      const clone = imgWrapper.cloneNode(true) as HTMLDivElement;
      clone.className += " h-[90vh]";
      one("img", clone).className = "w-auto h-full";
      dialog.replaceChildren(clone);
      dialog.showModal();
    });

    for (const box of boxes) {
      const boxElement = element(
        "div",
        "absolute bg-white/40 border border-red-500"
      );

      boxElement.style.top = `${box.top * 100}%`;
      boxElement.style.left = `${box.left * 100}%`;
      boxElement.style.width = `${box.width * 100}%`;
      boxElement.style.height = `${box.height * 100}%`;

      imgWrapper.append(boxElement);
    }

    imgWrapper.appendChild(img);

    wrapper.appendChild(imgWrapper);
    wrapper.appendChild(actions);

    main.appendChild(wrapper);
  }
}

function renderForm() {
  const form = element(
    "form",
    "mt-10 md:col-start-2 p-2 border border-stone-700"
  );

  const imagesDirInput = element(
    "input",
    "mt-1 w-full p-3 border border-stone-700 text-white focus-visible:outline-none focus-visible:border-stone-500",
    { required: true, placeholder: "Dataset Images Directory" }
  );
  const labelsDirInput = element(
    "input",
    "mt-1 w-full p-3 border border-stone-700 text-white focus-visible:outline-none focus-visible:border-stone-500",
    { required: true, placeholder: "Dataset Labels Directory" }
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const datasetImagesDir = imagesDirInput.value;
    const datasetLabelsDir = labelsDirInput.value;

    form.remove();
    await renderImages(datasetImagesDir, datasetLabelsDir);
  });

  form.append(
    element("label", "text-white", {
      textContent: "Dataset Images Directory",
    }),
    imagesDirInput,
    element("label", "mt-2 block text-white", {
      textContent: "Dataset Labels Directory",
    }),
    labelsDirInput,
    element("button", "mt-2 p-2 w-full bg-red-500", { textContent: "Start" })
  );

  main.append(form);
}

renderForm();
