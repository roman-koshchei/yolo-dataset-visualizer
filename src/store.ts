import { load } from "@tauri-apps/plugin-store";

const store = await load("store.json");

type RecentDataset = {
  images: string;
  labels: string;
};

export async function addRecentDataset(imagesDir: string, labelsDir: string) {
  const current = (await store.get<RecentDataset[]>("recent")) ?? [];
  if (current.some((x) => x.images == imagesDir)) return;

  const newDataset: RecentDataset = {
    images: imagesDir,
    labels: labelsDir,
  };

  await store.set("recent", [newDataset, ...current.slice(0, 4)]);
  await store.save();
}

export async function getRecentDatasets(): Promise<RecentDataset[]> {
  return (await store.get<RecentDataset[]>("recent")) ?? [];
}
