"""
Local GitHub Actions simulator for EVCP.

Reads .github/workflows/ci.yml and executes it on this machine the way a runner would:
  * each run starts from a fresh copy of the working tree (actions/checkout)
  * actions/setup-python  -> an isolated virtualenv, so global packages are never touched
  * actions/setup-node    -> the local Node.js (version mismatch is reported as a warning)
  * `needs:` ordering and `if:` conditions are honoured; a failed/skipped dependency skips dependents
  * jobs that need Docker are skipped with a clear reason when Docker isn't installed

Usage:
    python simulation/run_ci_local.py                        # simulate a push to main (full pipeline)
    python simulation/run_ci_local.py --event pull_request   # simulate a PR to main
    python simulation/run_ci_local.py --job backend-tests    # run one job (and nothing else)
    python simulation/run_ci_local.py --keep                 # keep the temp workspace for inspection
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKFLOW = os.path.join(ROOT, ".github", "workflows", "ci.yml")
IS_WIN = os.name == "nt"

if hasattr(sys.stdout, "reconfigure"):
    # line_buffering keeps our headers in order with the step subprocesses' output
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

GREEN, RED, YELLOW, DIM, BOLD, RESET = ("\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[1m", "\033[0m")


def find_bash() -> str:
    """Prefer Git Bash on Windows; System32\\bash.exe is WSL and wouldn't see this Python/Node."""
    if IS_WIN:
        git = shutil.which("git")
        if git:
            git_root = os.path.dirname(os.path.dirname(git))
            for candidate in ("bin/bash.exe", "usr/bin/bash.exe"):
                path = os.path.join(git_root, candidate)
                if os.path.exists(path):
                    return path
    bash = shutil.which("bash")
    if not bash:
        sys.exit("bash not found; install Git for Windows.")
    return bash


def checkout(workspace: str) -> None:
    """Copy tracked + untracked-but-not-ignored files, i.e. what a push of the working tree would contain."""
    files = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard", "-z"], cwd=ROOT, capture_output=True, check=True
    ).stdout.decode().split("\0")
    for rel in filter(None, files):
        src = os.path.join(ROOT, rel)
        if not os.path.isfile(src):
            continue
        dst = os.path.join(workspace, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)


def eval_if(expr, ctx) -> bool:
    if expr is None:
        return True
    expr = str(expr).strip()
    if expr.startswith("${{") and expr.endswith("}}"):
        expr = expr[3:-2]
    for name, value in ctx.items():
        expr = expr.replace(name, repr(value))
    expr = expr.replace("&&", " and ").replace("||", " or ").replace("!=", " != ")
    expr = re.sub(r"!(?!=)", " not ", expr)
    return bool(eval(expr, {"__builtins__": {}}, {}))


def topo_order(jobs: dict) -> list:
    order, seen = [], set()

    def visit(name):
        if name in seen:
            return
        seen.add(name)
        needs = jobs[name].get("needs") or []
        for dep in [needs] if isinstance(needs, str) else needs:
            visit(dep)
        order.append(name)

    for name in jobs:
        visit(name)
    return order


def job_needs_docker(job: dict) -> bool:
    for step in job.get("steps", []):
        if str(step.get("uses", "")).startswith("docker/") or re.search(r"\bdocker\b", str(step.get("run", ""))):
            return True
    return False


class Runner:
    def __init__(self, workspace: str, bash: str):
        self.workspace = workspace
        self.bash = bash

    def run_job(self, job_id: str, job: dict) -> bool:
        env = os.environ.copy()
        env.update({"CI": "true", "GITHUB_ACTIONS": "true", "GITHUB_WORKSPACE": self.workspace})
        # Keep the simulated runner clean: no Jira credentials leak in from the developer shell.
        for k in [k for k in env if k.startswith("JIRA_")]:
            del env[k]
        job_dir = tempfile.mkdtemp(prefix=f"{job_id}-", dir=self.workspace + "-runner")

        for i, step in enumerate(job.get("steps", []), 1):
            name = step.get("name") or step.get("uses") or step.get("run", "").splitlines()[0]
            print(f"\n{BOLD}  ▶ [{i}] {name}{RESET}")
            started = time.time()
            ok = self.run_step(step, env, job_dir)
            elapsed = time.time() - started
            mark = f"{GREEN}✓" if ok else f"{RED}✗"
            print(f"  {mark} {name} {DIM}({elapsed:.1f}s){RESET}")
            if not ok:
                return False
        return True

    def run_step(self, step: dict, env: dict, job_dir: str) -> bool:
        uses = step.get("uses")
        if uses:
            return self.run_action(uses, step.get("with") or {}, env, job_dir)

        script = step["run"]
        cwd = os.path.join(self.workspace, step.get("working-directory", "."))
        step_env = env.copy()
        step_env.update({k: str(v) for k, v in (step.get("env") or {}).items()})
        # GitHub's default bash shell is `bash -e {0}`; pipefail mirrors `shell: bash`.
        proc = subprocess.run([self.bash, "--noprofile", "--norc", "-eo", "pipefail", "-c", script], cwd=cwd, env=step_env)
        return proc.returncode == 0

    def run_action(self, uses: str, with_: dict, env: dict, job_dir: str) -> bool:
        action = uses.split("@")[0]
        if action == "actions/checkout":
            print(f"    {DIM}workspace: {self.workspace}{RESET}")
            return True
        if action == "actions/setup-python":
            want = str(with_.get("python-version", ""))
            have = f"{sys.version_info.major}.{sys.version_info.minor}"
            if want and want != have:
                print(f"    {YELLOW}! workflow asks for Python {want}; using local Python {have}{RESET}")
            venv = os.path.join(job_dir, "venv")
            print(f"    {DIM}creating isolated virtualenv {venv}{RESET}")
            if subprocess.run([sys.executable, "-m", "venv", venv]).returncode != 0:
                return False
            bin_dir = os.path.join(venv, "Scripts" if IS_WIN else "bin")
            env["PATH"] = bin_dir + os.pathsep + env["PATH"]
            env["VIRTUAL_ENV"] = venv
            return True
        if action == "actions/setup-node":
            want = str(with_.get("node-version", ""))
            node = shutil.which("node")
            if not node:
                print(f"    {RED}node not found on PATH{RESET}")
                return False
            have = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
            if want and not have.lstrip("v").startswith(want.split(".")[0] + "."):
                print(f"    {YELLOW}! workflow asks for Node {want}; using local Node {have}{RESET}")
            else:
                print(f"    {DIM}node {have}{RESET}")
            return True
        if action.startswith("docker/"):
            return shutil.which("docker") is not None
        print(f"    {YELLOW}! action {uses} is not simulated; treating as success{RESET}")
        return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--event", default="push", choices=["push", "pull_request"])
    parser.add_argument("--ref", default="refs/heads/main", help="simulated git ref (default: refs/heads/main)")
    parser.add_argument("--job", action="append", help="only run these job ids")
    parser.add_argument("--keep", action="store_true", help="keep the temporary workspace")
    args = parser.parse_args()

    with open(WORKFLOW, encoding="utf-8") as f:
        wf = yaml.safe_load(f)
    jobs = wf["jobs"]
    ctx = {"github.ref": args.ref, "github.event_name": args.event}
    has_docker = shutil.which("docker") is not None

    base = tempfile.mkdtemp(prefix="evcp-ci-")
    workspace = os.path.join(base, "workspace")
    os.makedirs(workspace)
    os.makedirs(workspace + "-runner")
    print(f"{BOLD}Workflow:{RESET} {wf.get('name')}  {DIM}({os.path.relpath(WORKFLOW, ROOT)}){RESET}")
    print(f"{BOLD}Event:{RESET} {args.event} on {args.ref}   {BOLD}Docker:{RESET} {'available' if has_docker else 'not installed'}")
    checkout(workspace)

    runner = Runner(workspace, find_bash())
    results = {}
    started_all = time.time()
    for job_id in topo_order(jobs):
        job = jobs[job_id]
        title = job.get("name", job_id)
        needs = job.get("needs") or []
        needs = [needs] if isinstance(needs, str) else needs

        reason = None
        if args.job and job_id not in args.job:
            reason = "not selected"
        elif any(results.get(d, ("skipped",))[0] != "success" for d in needs):
            reason = "a required job did not succeed"
        elif not eval_if(job.get("if"), ctx):
            reason = f"condition is false: {job.get('if')}"
        elif job_needs_docker(job) and not has_docker:
            reason = "Docker is not installed on this machine"

        print(f"\n{BOLD}━━ Job: {title} ({job_id}) ━━{RESET}")
        if reason:
            print(f"  {YELLOW}○ skipped — {reason}{RESET}")
            results[job_id] = ("skipped", reason, 0.0)
            continue
        t0 = time.time()
        ok = runner.run_job(job_id, job)
        results[job_id] = ("success" if ok else "failure", "", time.time() - t0)

    print(f"\n{BOLD}━━ Summary ({time.time() - started_all:.0f}s) ━━{RESET}")
    icons = {"success": f"{GREEN}✓ success", "failure": f"{RED}✗ failure", "skipped": f"{YELLOW}○ skipped"}
    for job_id, (state, reason, secs) in results.items():
        extra = f" — {reason}" if reason else f" ({secs:.0f}s)"
        print(f"  {icons[state]}{RESET}  {jobs[job_id].get('name', job_id)}{DIM}{extra}{RESET}")

    if args.keep:
        print(f"\n{DIM}workspace kept at {base}{RESET}")
    else:
        shutil.rmtree(base, ignore_errors=True)

    sys.exit(1 if any(r[0] == "failure" for r in results.values()) else 0)


if __name__ == "__main__":
    main()
