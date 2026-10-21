import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("equipment registration stores an optional compressed photo in the existing private bucket", async () => {
  const [index, legacyApp, migration] = await Promise.all([
    read("../index.html"),
    read("../app.html"),
    read("../supabase/equipment_photos.sql"),
  ]);

  for (const [name, html] of [["index.html", index], ["app.html", legacyApp]]) {
    assert.match(html, /id="newEquipmentPhotoFile"/, `${name} should offer a gallery picker`);
    assert.match(html, /id="newEquipmentPhotoCameraFile"/, `${name} should offer camera capture`);
    assert.match(html, /async function prepareEquipmentPhoto\(file\)/);
    assert.match(html, /MAINTENANCE_PHOTOS|maintenance-photos/);
    assert.match(html, /photo_path:photoPath/);
    assert.match(html, /equipment-\$\{safeId\}\.jpg/);
  }
  assert.match(index, /signedEquipmentPhoto\(e\.photo_path\)/);
  assert.match(legacyApp, /createSignedUrl\(e\.photo_path,3600\)/);

  assert.match(migration, /alter table public\.equipment\s+add column if not exists photo_path text/i);
  assert.doesNotMatch(migration, /\b(drop|truncate|delete)\b/i);
});

test("PDF and print report is only offered to Windows administrators and groups all actual machines by sector", async () => {
  const html = await read("../index.html");
  const equipmentPanel = html.slice(
    html.indexOf("async function openEquipmentPanel"),
    html.indexOf("async function openPartsPanel"),
  );

  assert.match(html, /const printAction=isWindowsDesktopAdmin\(\)\?/);
  assert.match(html, /async function printEquipmentReport\(rows,sectors\)/);
  assert.match(html, /const key=machine\.sector_id\|\|'__no_sector__'/);
  assert.match(html, /machine\.active===false\?'Inativa':'Ativa'/);
  assert.match(html, /printWindow\.print\(\)/);
  assert.match(
    equipmentPanel,
    /from\('equipment'\)\.select\('id,name,code,location,sector_id,active,created_at,photo_path'\)\.eq\('organization_id',profile\.organization_id\)/,
  );
  assert.doesNotMatch(equipmentPanel, /\.eq\('active',true\)/);
});
