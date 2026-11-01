import { execFileSync } from "node:child_process";
import { get, list } from "@vercel/blob";

const projectId = "prj_Qf4Ef3S8n0cNveCoRoqw2br1SAmC";
const teamId = "team_AnOdxEeUwCwUtPdqTk5I1Dkt";
const storeId = "store_ZjYAmEOEFgdPRT3y";

function api(path) {
  return JSON.parse(execFileSync("vercel", ["api", `${path}?teamId=${teamId}`], {
    encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "pipe"],
  }));
}

try {
  const project = api(`/v9/projects/${projectId}`);
  const { store } = api(`/v1/storage/stores/${storeId}`);
  if (project.id !== projectId || project.accountId !== teamId ||
      project.link?.org !== "abdulazizalrayes" || project.link?.repo !== "vestedksa-website" ||
      store.id !== storeId || store.access !== "private" || store.ownerId !== teamId ||
      store.totalConnectedProjects !== 1 ||
      !store.projectsMetadata?.some(p => p.projectId === projectId && p.environments?.length === 1 && p.environments[0] === "production")) {
    throw new Error("Vested identity lock failed");
  }
  const binding = project.env.find(e => e.key === "BLOB_READ_WRITE_TOKEN" && e.target?.includes("production"));
  if (!binding) throw new Error("Private storage binding missing");
  const credential = api(`/v1/projects/${projectId}/env/${binding.id}`);
  if (credential.key !== binding.key || !credential.decrypted || !credential.value) throw new Error("Storage access unavailable");
  const token = credential.value;
  const result = await list({ prefix: "vested-demand/v1/reports/", limit: 1000, token });
  if (result.hasMore) throw new Error("Report listing truncated; do not infer latest report");
  const sorted = result.blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  for (const kind of ["daily", "weekly"]) {
    const entry = sorted.find(item => item.pathname.endsWith(`/${kind}.json`));
    if (!entry) { console.log(JSON.stringify({ kind, status: "missing" })); continue; }
    const response = await get(entry.pathname, { access: "private", token });
    if (!response || response.statusCode !== 200) throw new Error("Report read failed");
    const report = JSON.parse(await new Response(response.stream).text());
    if (report.company !== "Vested KSA") throw new Error("Report company mismatch");
    console.log(JSON.stringify({
      company: report.company, kind, generatedAt: report.generatedAt, period: report.period,
      evidence: report.evidence, clustering: {
        status: report.clustering.status, recordsAvailable: report.clustering.recordsAvailable,
        modelTrained: report.clustering.modelTrained,
      }, recommendationCount: report.recommendations.length,
    }));
  }
} catch {
  console.error("Private Vested report check failed. Verify CLI access and exact project/store bindings; no credentials or report contents were logged.");
  process.exitCode = 1;
}
