import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEmbed, buildNotification } from "../src/format";

const repository = { full_name: "acme/app", html_url: "https://github.com/acme/app" };
const sender = { login: "octocat", html_url: "https://github.com/octocat", avatar_url: "x" };

test("ping produces no notification", () => {
  assert.equal(buildEmbed("ping", { zen: "hi", repository }), null);
});

test("push lists commits", () => {
  const embed = buildEmbed("push", {
    repository,
    sender,
    ref: "refs/heads/main",
    compare: "https://github.com/acme/app/compare/a...b",
    commits: [
      { id: "abcdef1234", message: "fix: thing\n\ndetails", url: "u1" },
      { id: "1234567890", message: "feat: stuff", url: "u2" },
    ],
  });
  assert.ok(embed);
  assert.match(embed!.title!, /2 new commits to acme\/app/);
  const branch = embed!.fields!.find((f) => f.name === "Branch");
  const commitsField = embed!.fields!.find((f) => f.name === "Commits");
  assert.equal(branch!.value, "`main`");
  assert.match(commitsField!.value, /abcdef1/);
  assert.match(commitsField!.value, /fix: thing/);
  assert.doesNotMatch(commitsField!.value, /details/);
});

test("push with no commits is skipped", () => {
  assert.equal(buildEmbed("push", { repository, ref: "refs/heads/main", commits: [] }), null);
});

test("merged PR is reported as merged", () => {
  const embed = buildEmbed("pull_request", {
    action: "closed",
    number: 7,
    repository,
    sender,
    pull_request: { number: 7, title: "Add feature", merged: true, html_url: "h", head: { ref: "f" }, base: { ref: "main" } },
  });
  assert.ok(embed);
  assert.match(embed!.title!, /PR #7 merged/);
});

test("uninteresting PR actions are skipped", () => {
  assert.equal(
    buildEmbed("pull_request", { action: "synchronize", repository, pull_request: {} }),
    null
  );
});

test("failed workflow run is red and reported", () => {
  const embed = buildEmbed("workflow_run", {
    action: "completed",
    repository,
    sender,
    workflow_run: { name: "CI", head_branch: "main", conclusion: "failure", html_url: "h" },
  });
  assert.ok(embed);
  assert.match(embed!.title!, /CI failed on main/);
});

test("unknown event with a repo falls back to a generic embed", () => {
  const embed = buildEmbed("deployment_status", { repository, sender, action: "created" });
  assert.ok(embed);
  assert.match(embed!.title!, /\[acme\/app\] deployment_status \(created\)/);
});

test("unknown event without a repo is skipped", () => {
  assert.equal(buildEmbed("meta", {}), null);
});

test("alerts: opened PR, merged PR and failed CI ping; others don't", () => {
  const openedPr = buildNotification("pull_request", {
    action: "opened",
    number: 1,
    repository,
    pull_request: { number: 1, title: "x", html_url: "h" },
  });
  const mergedPr = buildNotification("pull_request", {
    action: "closed",
    number: 1,
    repository,
    pull_request: { number: 1, title: "x", merged: true, html_url: "h" },
  });
  const closedPr = buildNotification("pull_request", {
    action: "closed",
    number: 1,
    repository,
    pull_request: { number: 1, title: "x", merged: false, html_url: "h" },
  });
  const failedCi = buildNotification("workflow_run", {
    action: "completed",
    repository,
    workflow_run: { name: "CI", head_branch: "main", conclusion: "failure", html_url: "h" },
  });
  const push = buildNotification("push", {
    repository,
    ref: "refs/heads/main",
    commits: [{ id: "a1b2c3d4", message: "m", url: "u" }],
  });

  assert.equal(openedPr?.alert, true);
  assert.equal(mergedPr?.alert, true);
  assert.equal(closedPr?.alert, false);
  assert.equal(failedCi?.alert, true);
  assert.equal(push?.alert, false);
});
