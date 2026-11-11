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
    assert.match(html, /photo_path:(?:photoPath|uploadedPhotoPath)/);
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
    /from\('equipment'\)\.select\(`id,name,code,location,sector_id,active,created_at,photo_path,\$\{equipmentLabelFields\.map\(field=>field\.key\)\.join\(','\)\}`\)\.eq\('organization_id',profile\.organization_id\)/,
  );
  assert.doesNotMatch(equipmentPanel, /\.eq\('active',true\)/);
});

test("machine list generates the supplied label image at exact 120 by 80 mm using saved machine data", async () => {
  const html = await read("../index.html");
  const panel = html.slice(
    html.indexOf("async function openEquipmentPanel"),
    html.indexOf("async function openPartsPanel"),
  );
  const label = html.slice(
    html.indexOf("async function printEquipmentLabel"),
    html.indexOf("let includeInactiveSectors"),
  );
  const image = await readFile(new URL("../public/etiqueta-equipamento.png", import.meta.url));

  assert.ok(image.length > 100_000, "the provided label artwork should be included as a local asset");
  assert.match(panel, /data-equipment-label=/);
  assert.match(panel, /printEquipmentLabel\(machine,sectors\)/);
  assert.match(label, /@page\{size:120mm 80mm;margin:0\}/);
  assert.match(label, /\.equipment\{left:21\.5%;top:15\.1%;width:74%;height:4\.3%\}/);
  assert.match(label, /\.sector,\.manufacturer,\.serial-number,\.installation-date\{left:20\.5%;width:28\.5%\}/);
  assert.match(label, /\.location,\.model,\.manufacturing-year\{left:68\.5%;width:27%\}/);
  assert.match(label, /\.status\{left:65\.8%;top:34\.8%;width:29%;height:4%\}/);
  assert.match(label, /new URL\('\.\/etiqueta-equipamento\.png',document\.baseURI\)/);
  assert.match(label, /machine\.code/);
  assert.match(label, /machine\.name/);
  assert.match(label, /sectors\[machine\.sector_id\]/);
  assert.match(label, /machine\.location/);
  assert.match(label, /machine\.active===false\?'Inativa':'Ativa'/);
  assert.match(label, /printWindow\.print\(\)/);
  assert.match(label, /field\('manufacturer'\)/);
  assert.match(label, /field\('serial_number'\)/);
  assert.match(label, /field\('voltage'\)/);
  assert.match(label, /field\('working_pressure'\)/);
  assert.match(label, /field\('preventive_general_overhaul'\)/);
});

test("equipment form persists every optional data field shown on the label with an additive Supabase migration", async () => {
  const [html, migration] = await Promise.all([
    read("../index.html"),
    read("../supabase/equipment_label_fields.sql"),
  ]);
  const fieldBlock = html.slice(
    html.indexOf("const equipmentLabelFieldGroups"),
    html.indexOf("async function prepareEquipmentPhoto"),
  );
  const expectedFields = [
    "manufacturer", "model", "serial_number", "manufacturing_year", "installation_date",
    "voltage", "current_rating", "power_rating", "frequency", "phase_count",
    "capacity", "working_pressure", "stroke", "dimensions", "weight",
    "lubricant", "lubricant_quantity", "lubrication_interval",
    "preventive_general_inspection", "preventive_electrical_check",
    "preventive_oil_change", "preventive_general_overhaul",
  ];

  for (const field of expectedFields) {
    assert.match(fieldBlock, new RegExp(`key:'${field}'`), `${field} is registered in the form`);
    assert.match(migration, new RegExp(`add column if not exists ${field} `, "i"), `${field} has a DB column`);
  }
  assert.match(html, /data-equipment-field="\$\{field\.key\}"/);
  assert.match(html, /equipmentLabelFields\.forEach\(field=>\{/);
  assert.match(html, /\.update\(equipmentData\)/);
  assert.match(html, /\.insert\(\{\.\.\.equipmentData,photo_path:uploadedPhotoPath\}\)/);
  assert.match(html, /data-equipment-edit=/);
  assert.match(html, /Foto da máquina \(opcional; não é a etiqueta\)/);
  assert.doesNotMatch(migration, /\b(drop|truncate|delete)\b/i);
});
