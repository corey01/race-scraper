import fs, { mkdirSync, mkdir } from "fs";
import { fileURLToPath } from "url";
import path, { dirname } from "path";

export const writeJson = async (dataToWrite) => {
  const { name, year, data } = dataToWrite;
  const stringifiedData = JSON.stringify(data);

  const safeName = name.replace(/[^A-Z0-9]+/gi, "_");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const filePath = path.join(__dirname, `../output/${safeName}`);

  await fs.promises.mkdir(filePath, {
    recursive: true,
  });

  await fs.writeFileSync(
    `${filePath}/${safeName}-${year}.json`,
    stringifiedData
  );
};
