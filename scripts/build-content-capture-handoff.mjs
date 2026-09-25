import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    result[key] = value;
    i += 1;
  }
  return result;
}

function readManifest(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  const required = [
    'articleId',
    'modelCaseId',
    'captureSpecId',
    'view',
    'captureRegion',
    'viewport',
    'viewportMatch',
    'imageFilename',
    'captureTimestamp',
    'sourceEnvironment',
    'sourcePlanId',
  ];
  for (const key of required) {
    if (parsed[key] == null) throw new Error(`${path.basename(filePath)} is missing ${key}.`);
  }
  if (parsed.viewportMatch !== true) {
    throw new Error(`${path.basename(filePath)} has viewportMatch=false.`);
  }
  return parsed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(args['input-dir'] ?? 'artifacts/content-captures');
  const outputFile = path.resolve(
    args['output-file'] ?? path.join(inputDir, 'SKILL-08-handoff.json'),
  );

  if (!existsSync(inputDir)) throw new Error(`Capture directory not found: ${inputDir}`);

  const manifestFiles = readdirSync(inputDir)
    .filter((name) => name.endsWith('.manifest.json'))
    .sort();

  if (manifestFiles.length === 0) {
    throw new Error(`No capture manifests found in ${inputDir}`);
  }

  const manifests = manifestFiles.map((name) =>
    readManifest(path.join(inputDir, name)),
  );

  const articleIds = new Set(manifests.map((item) => item.articleId));
  const modelCaseIds = new Set(manifests.map((item) => item.modelCaseId));
  if (articleIds.size !== 1) {
    throw new Error(`Handoff requires one articleId, got: ${[...articleIds].join(', ')}`);
  }
  if (modelCaseIds.size !== 1) {
    throw new Error(`Handoff requires one modelCaseId, got: ${[...modelCaseIds].join(', ')}`);
  }

  const captureSpecIds = new Set();
  for (const item of manifests) {
    if (captureSpecIds.has(item.captureSpecId)) {
      throw new Error(`Duplicate captureSpecId: ${item.captureSpecId}`);
    }
    captureSpecIds.add(item.captureSpecId);
    if (!existsSync(path.join(inputDir, item.imageFilename))) {
      throw new Error(`Image file not found for ${item.captureSpecId}: ${item.imageFilename}`);
    }
  }

  const handoff = {
    handoffVersion: 1,
    consumerSkill: 'SKILL-08',
    consumerSkillName: 'Blog Diagram',
    articleId: manifests[0].articleId,
    modelCaseId: manifests[0].modelCaseId,
    sourcePolicy: {
      sourceType: 'life-plan-real-screen-capture',
      originalScreenIsCanonical: true,
      allowAiRedrawOfScreen: false,
      editorialPlacementRequired: true,
      note:
        'Use captured product screens as fixed originals. Add callouts/annotations only in downstream diagram composition when needed.',
    },
    captures: manifests.map((item) => ({
      captureSpecId: item.captureSpecId,
      view: item.view,
      purpose: item.purpose ?? null,
      note: item.note ?? null,
      captureRegion: item.captureRegion,
      viewport: item.viewport,
      actualViewport: item.actualViewport ?? null,
      viewportMatch: item.viewportMatch,
      operatorMode: item.operatorMode ?? {},
      displayState: item.displayState ?? {},
      imageFilename: item.imageFilename,
      imageWidth: item.imageWidth ?? null,
      imageHeight: item.imageHeight ?? null,
      imageSha256: item.imageSha256 ?? null,
      captureTimestamp: item.captureTimestamp,
      sourceEnvironment: item.sourceEnvironment,
      sourceUrl: item.sourceUrl ?? null,
      sourcePlanId: item.sourcePlanId,
      diagramRole: 'real-screen-source',
    })),
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(outputFile, `${JSON.stringify(handoff, null, 2)}\n`);
  console.log(`SKILL-08 handoff: ${outputFile}`);
  console.log(`SKILL-08 handoff payload: ${JSON.stringify(handoff)}`);
}

main();
