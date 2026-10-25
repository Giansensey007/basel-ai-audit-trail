import { describe, expect, it } from "vitest";
import dossiers from "../../tool/dossiers.json";
import gold from "../../tool/gold.json";
import rules from "../../tool/rules.json";
import schema from "../../tool/schema.json";
import templates from "../../tool/templates.json";
import { agreementCount, derive, pruefvermerk } from "./derive";
import type { Dossier, DossiersFile, GoldFile, RulesFile, SchemaFile, TemplatesFile } from "./types";

const file = dossiers as DossiersFile;
const schemaFile = schema as SchemaFile;
const rulesFile = rules as RulesFile;
const templatesFile = templates as TemplatesFile;
const goldFile = gold as GoldFile;

function dossier(id: string): Dossier {
  const found = file.dossiers.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("derive", () => {
  it("drops an unknown segment id", () => {
    const result = derive({
      dossier: dossier("klar"),
      schema: schemaFile,
      rules: rulesFile,
      templates: templatesFile,
      picked: { ...goldFile.readings.klar, supplier: ["NOPE", "BK-02"] },
    });
    expect(result.accepted.supplier).toEqual(["BK-02"]);
  });

  it("keeps a quantity conflict empty and cites both sources", () => {
    const result = derive({
      dossier: dossier("abweichung"),
      schema: schemaFile,
      rules: rulesFile,
      templates: templatesFile,
      picked: goldFile.readings.abweichung,
    });
    const quantity = result.fields.find((field) => field.id === "quantity");
    expect(quantity?.status).toBe("conflict");
    expect(quantity?.value).toBeNull();
    expect(quantity?.segmentIds).toEqual(["BA-05", "LA-04", "RA-06"]);
    expect(result.recommendation).toBe("hold");
    expect(result.costCentreMissing).toBe(true);
    expect(result.draftText.startsWith("Entwurf des Werkzeugs.")).toBe(true);
  });

  it("books the clean dossier from the reference reading", () => {
    const result = derive({
      dossier: dossier("klar"),
      schema: schemaFile,
      rules: rulesFile,
      templates: templatesFile,
      picked: goldFile.readings.klar,
    });
    expect(result.recommendation).toBe("book");
    expect(result.fields.every((field) => field.status === "filled")).toBe(true);
    expect(agreementCount(result.accepted, goldFile.readings.klar, schemaFile.fields.map((field) => field.id))).toEqual({
      hit: 8,
      total: 8,
    });
  });

  it("clears amounts when the VAT rate does not match the total", () => {
    const picked = {
      ...goldFile.readings.abweichung,
      vatRate: ["RA-08"],
      quantity: ["RA-06"],
    };
    const result = derive({
      dossier: dossier("abweichung"),
      schema: schemaFile,
      rules: rulesFile,
      templates: templatesFile,
      picked,
    });
    expect(result.vatCleared).toBe(true);
    for (const id of ["net", "vatRate", "gross"]) {
      expect(result.fields.find((field) => field.id === id)?.value).toBeNull();
    }
  });

  it("repeats the same draft for the same ids", () => {
    const once = derive({
      dossier: dossier("abweichung"),
      schema: schemaFile,
      rules: rulesFile,
      templates: templatesFile,
      picked: goldFile.readings.abweichung,
    });
    const twice = derive({
      dossier: dossier("abweichung"),
      schema: schemaFile,
      rules: rulesFile,
      templates: templatesFile,
      picked: goldFile.readings.abweichung,
    });
    expect(twice.draftText).toBe(once.draftText);
  });

  it("refuses a booking sentence when the person holds back", () => {
    const text = pruefvermerk({
      templates: templatesFile,
      recommendation: "book",
      decision: "reject",
      name: "Ada",
      time: "2026-10-25T12:00:00.000Z",
    });
    expect(text).toContain("Keine Buchungsempfehlung");
    expect(text).not.toContain("Buchung laut Werkzeug");
  });
});
