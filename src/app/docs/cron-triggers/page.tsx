import type { Metadata } from "next";
import { DocsPage, CodeBlock, Section, Note } from "@/components/docs-page";

export const metadata: Metadata = { title: "Cron Triggers" };

export default function CronTriggersPage() {
  return (
    <DocsPage
      title="Cron Triggers"
      description="Cron triggers run workflows on a schedule, create an ephemeral agent for each run, and record scheduled workflow history."
    >
      <Section title="What cron triggers do">
        <p>
          A cron trigger starts a workflow from time instead of an issue tracker
          event. Use cron workflows for recurring repository maintenance,
          dependency updates, nightly checks, reports, audits, or other bounded
          work that should run without a person clicking a button.
        </p>
        <p>
          Each scheduled fire creates a workflow run, provisions a new agent,
          injects cron context into the run, and terminates the agent when the
          workflow reaches a terminal stage.
        </p>
      </Section>

      <Section title="Basic workflow">
        <CodeBlock lang="yaml">{`schema_version: v1
name: dependency-maintenance
enabled: true

trigger:
  cron:
    schedule: "0 9 * * 1"
    timezone: "America/Chicago"
    overlap_policy: skip
    timeout: 2h

provider: daytona
tags: ["cron", "dependencies"]
color: cyan

stages:
  - id: working
    label: Working
    entry: true
    on_enter:
      inject: |
        This is a scheduled dependency maintenance run.

        Inspect go.mod, package.json, and lockfiles.
        Apply safe patch and minor updates.
        Run tests.
        Open one grouped PR if changes are ready.
        Say [DONE] when the PR is open or no updates are needed.

  - id: complete
    label: Complete
    triggers:
      - message_contains: "[DONE]"
    terminal: true`}</CodeBlock>
        <Note>
          Cron workflows are still normal workflows. Stages, gates, run actions,
          labels, PR watchers, and terminal stages work the same way as
          issue-triggered workflows.
        </Note>
      </Section>

      <Section title="Cron fields">
        <div className="space-y-3 text-sm text-zinc-400">
          <p>
            <code className="text-cyan-300">schedule</code> - Required cron
            expression, such as <code>0 9 * * 1</code>. Descriptors such as
            <code>@daily</code> are also supported.
          </p>
          <p>
            <code className="text-cyan-300">timezone</code> - Optional IANA
            timezone. If omitted, the schedule uses UTC.
          </p>
          <p>
            <code className="text-cyan-300">overlap_policy</code> - Optional.
            Controls what happens when the next scheduled time arrives while a
            previous run is still active.
          </p>
          <p>
            <code className="text-cyan-300">timeout</code> - Optional Go-style
            duration such as <code>30m</code>, <code>2h</code>, or
            <code>1h30m</code>.
          </p>
        </div>
      </Section>

      <Section title="Overlap policy">
        <p>
          Cron workflows should usually avoid overlapping runs. The default
          policy is <code>skip</code>.
        </p>
        <div className="space-y-3 text-sm text-zinc-400">
          <p>
            <code className="text-cyan-300">skip</code> - If a previous run is
            active, record the new run as skipped and do not create another
            agent.
          </p>
          <p>
            <code className="text-cyan-300">queue</code> - Reserved for queued
            follow-up runs. In the current implementation, queued runs are
            skipped when another run is active.
          </p>
          <p>
            <code className="text-cyan-300">parallel</code> - Allow multiple
            active runs for the same workflow.
          </p>
        </div>
        <CodeBlock lang="yaml">{`trigger:
  cron:
    schedule: "0 */6 * * *"
    timezone: "UTC"
    overlap_policy: skip`}</CodeBlock>
      </Section>

      <Section title="Run context">
        <p>
          Scheduled runs receive generated context so the agent can distinguish
          a cron run from a manual or issue-triggered run.
        </p>
        <CodeBlock lang="json">{`{
  "run_id": "5f35f8f6-7a2a-4f32-bb50-6e0cbd53c6ef",
  "scheduled_at": "2026-06-15T14:00:00Z",
  "workflow_name": "dependency-maintenance",
  "workspace_name": "engineering",
  "trigger_type": "cron"
}`}</CodeBlock>
      </Section>

      <Section title="Manual runs">
        <p>
          Cron workflows can be triggered manually from the API when the cron
          scheduler is available. Manual runs use the same workflow definition
          and run history as scheduled runs.
        </p>
        <CodeBlock lang="bash">{`curl -X POST \\
  "$ELASTICCLAW_URL/api/workspaces/engineering/workflows/dependency-maintenance/cron/trigger" \\
  -H "Authorization: Bearer $ELASTICCLAW_TOKEN"`}</CodeBlock>
        <Note>
          Disabled workflows cannot be triggered by cron. Set{" "}
          <code>enabled: false</code> to pause a scheduled workflow.
        </Note>
      </Section>

      <Section title="Run history and next run">
        <p>
          ElasticClaw records cron workflow runs with status, result, claw ID,
          timestamps, and run context.
        </p>
        <CodeBlock lang="bash">{`curl \\
  "$ELASTICCLAW_URL/api/workspaces/engineering/workflows/dependency-maintenance/cron/runs?limit=20" \\
  -H "Authorization: Bearer $ELASTICCLAW_TOKEN"

curl \\
  "$ELASTICCLAW_URL/api/workspaces/engineering/workflows/dependency-maintenance/cron/next" \\
  -H "Authorization: Bearer $ELASTICCLAW_TOKEN"

# Or use the CLI
elasticclaw workflow runs dependency-maintenance --workspace engineering --limit 20
elasticclaw workflow logs dependency-maintenance <run-id> --workspace engineering`}</CodeBlock>
        <p>
          Run statuses include <code>pending</code>, <code>running</code>,
          <code>completed</code>, <code>failed</code>, <code>skipped</code>,
          <code>timed_out</code>, and <code>canceled</code>.
        </p>
      </Section>

      <Section id="v2-cron" title="Cron triggers in v2 workflows">
        <p>
          v2 workflows declare cron triggers under a top-level{" "}
          <code>trigger</code> block. The syntax is similar to v1, but the
          workflow must be <code>enabled: true</code> and uses v2 states and
          transitions instead of stages.
        </p>
        <CodeBlock lang="yaml">{`schema_version: 2
name: dependency-maintenance
enabled: true
initial_state: working

trigger:
  cron:
    schedule: "0 9 * * 1"
    timezone: "America/Chicago"
    overlap_policy: skip
    timeout: 2h

states:
  working:
    description: Inspect manifests and apply safe updates.
    phase: build
    on_enter:
      effects:
        - dependency.update:
            ecosystems: [go, npm]
            include_major: false
  complete:
    phase: done
    terminal: true

transitions:
  dependency_pr_opened:
    from: working
    on: pull_request.verified_open
    when:
      pull_request:
        state: open
    to: complete`}</CodeBlock>
        <p className="text-sm text-zinc-400 mt-2">
          <code>overlap_policy</code> supports <code>skip</code> (default) and{" "}
          <code>parallel</code>. v1 <code>queue</code> is converted to{" "}
          <code>skip</code> with a warning. Any enabled v2 cron workflow can also
          be triggered manually:
        </p>
        <CodeBlock lang="bash">{`elasticclaw workflow trigger dependency-maintenance --workspace engineering --cron

# Or via the API
curl -X POST \\
  "$ELASTICCLAW_URL/api/workspaces/engineering/workflows/dependency-maintenance/cron/trigger" \\
  -H "Authorization: Bearer $ELASTICCLAW_TOKEN"`}</CodeBlock>
        <p className="text-sm text-zinc-400 mt-2">
          Cron run history (including skipped ticks) is available from{" "}
          <code>/api/workspaces/&lt;ws&gt;/workflows/&lt;wf&gt;/cron/runs</code>{" "}
          or with{" "}
          <code>elasticclaw workflow runs dependency-maintenance --workspace engineering --cron</code>.
        </p>
      </Section>

      <Section title="Recommended patterns">
        <div className="space-y-3 text-sm text-zinc-400">
          <p>
            Use <code>overlap_policy: skip</code> for maintenance workflows.
            This prevents daily or hourly schedules from piling up when a run
            takes longer than expected.
          </p>
          <p>
            Keep the entry message explicit. Tell the agent whether to open a
            PR, skip when no work is needed, and what completion signal to use.
          </p>
          <p>
            Add deterministic <code>run</code> and <code>gate</code> stages for
            tests or scanners when a workflow should only proceed after a tool
            reports a clean result.
          </p>
          <p>
            Use one grouped PR per scheduled run for dependency maintenance
            unless major, security, or runtime updates need separate handling.
          </p>
        </div>
      </Section>
    </DocsPage>
  );
}
