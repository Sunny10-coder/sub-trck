import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api } from "@/src/lib/api";
import type { ExportScope } from "@/src/lib/excel-export";

/** Builds the .xlsx on the phone, writes it to cache and opens the share sheet (Drive, Files, Email...). */
export async function exportAndShare(scope: ExportScope): Promise<string> {
  const { filename, base64 } = await api.exportWorkbook(scope);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Saved ${filename}, but sharing is not available on this device.`);
  await Sharing.shareAsync(uri, {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "Export to Excel",
    UTI: "org.openxmlformats.spreadsheetml.sheet",
  });
  return filename;
}
