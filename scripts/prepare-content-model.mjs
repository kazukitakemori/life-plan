// npx tsx scripts/prepare-content-model.mjs model.json request.json
import fs from 'node:fs';
import { toContentModelPlanRecord } from '../src/lib/contentModelCase.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: prepare-content-model.mjs model.json request.json');
const model = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
const plan = toContentModelPlanRecord(model);
fs.writeFileSync(output, JSON.stringify({ articleId: model.articleId, modelCaseId: model.modelCaseId, plan }, null, 2) + '\n');
console.log(`Prepared ${plan.id} (schema ${plan.schemaVersion}).`);
