#!/usr/bin/env node
/**
 * Validates Backstage catalog-info.yaml descriptors across the Demo
 * Commerce Platform repositories.
 *
 * Usage (from this repo, after `npm ci`):
 *   node scripts/validate-catalog.mjs [catalog-info.yaml ...]
 *
 * With no arguments it scans catalog-info.yaml in every sibling
 * repository (the sibling-checkout layout used by compose/kustomize).
 *
 * Exits 0 when every entity is structurally valid and all cross-entity
 * references resolve; exits 1 otherwise, printing one line per finding.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { loadAll } from "js-yaml";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const KINDS = new Set([
  "Component",
  "API",
  "System",
  "Domain",
  "Group",
  "Resource",
  "Location",
  "Template",
  "User",
]);
const REQUIRED = {
  Component: ["type", "lifecycle", "owner", "system"],
  API: ["type", "lifecycle", "owner", "definition"],
  System: ["owner"],
  Domain: ["owner"],
  Group: ["type"],
};

const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : globSync("demo-*/catalog-info.yaml", { cwd: resolve(REPO_ROOT, "..") }).map(
        (f) => join(resolve(REPO_ROOT, ".."), f),
      );

const problems = [];
const entities = [];

for (const file of files) {
  let docs;
  try {
    docs = loadAll(readFileSync(file, "utf8"));
  } catch (err) {
    problems.push(`${file}: YAML parse error: ${err.message}`);
    continue;
  }
  docs.forEach((doc, i) => {
    const at = `${file} [doc ${i}]`;
    if (!doc || typeof doc !== "object") {
      problems.push(`${at}: empty or non-object document`);
      return;
    }
    if (doc.apiVersion !== "backstage.io/v1alpha1") {
      problems.push(`${at}: apiVersion must be backstage.io/v1alpha1`);
    }
    if (!KINDS.has(doc.kind)) {
      problems.push(`${at}: unknown kind "${doc.kind}"`);
    }
    for (const field of ["name", "description"]) {
      if (!doc.metadata?.[field]) {
        problems.push(`${at}: metadata.${field} is required`);
      }
    }
    for (const field of REQUIRED[doc.kind] ?? []) {
      if (doc.spec?.[field] === undefined) {
        problems.push(`${at}: spec.${field} is required for kind ${doc.kind}`);
      }
    }
    entities.push({ doc, at });
  });
}

const names = new Set(
  entities.map(({ doc }) => `${doc.kind}:${doc.metadata?.name}`),
);
const systems = new Set(
  entities
    .filter(({ doc }) => doc.kind === "System")
    .map(({ doc }) => doc.metadata.name),
);
const apis = new Set(
  entities
    .filter(({ doc }) => doc.kind === "API")
    .map(({ doc }) => doc.metadata.name),
);

for (const { doc, at } of entities) {
  const spec = doc.spec ?? {};
  if (doc.kind === "Component" && spec.system && !systems.has(spec.system)) {
    problems.push(`${at}: spec.system "${spec.system}" has no matching System entity`);
  }
  if (doc.kind === "System" && spec.domain && !names.has(`Domain:${spec.domain}`)) {
    problems.push(`${at}: spec.domain "${spec.domain}" has no matching Domain entity`);
  }
  for (const rel of ["providesApis", "consumesApis"]) {
    for (const api of spec[rel] ?? []) {
      if (!apis.has(api)) {
        problems.push(`${at}: spec.${rel} "${api}" has no matching API entity`);
      }
    }
  }
  for (const dep of spec.dependsOn ?? []) {
    // Entity refs are "kind:name" (kind is case-insensitive); default Component.
    const [kind, target] = dep.includes(":")
      ? dep.split(":", 2)
      : ["component", dep];
    const key = `${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()}:${target}`;
    if (!names.has(key)) {
      problems.push(`${at}: spec.dependsOn "${dep}" has no matching entity`);
    }
  }
}

if (problems.length > 0) {
  console.error(`catalog validation FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`catalog validation OK — ${entities.length} entities across ${files.length} file(s)`);
