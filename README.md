# Agent Office

*[Česká verze](README.cs.md)*

**An office of AI agents on your Mac.** Tell the boss what you need, in a few sentences. It studies the brief, hires a team, splits up the work, has every result checked independently and hands you a finished, verified deliverable. Code, websites, research, documents, pitch decks, marketing: any kind of project.

It runs on the subscriptions you already pay for (Claude, ChatGPT/Codex, optionally Google Antigravity and Gemini). No API keys, nothing in the cloud except the models themselves.

## What it does

**A boss that runs the project for you**
- Reads the brief and the project folder, researches the topic, and asks you only what it really needs (at most three questions, with answer buttons).
- Writes down your taste and a scorecard of MUST / SHOULD / NICE criteria before any work starts, so "done" has a definition.
- Plans the work as tasks with clear inputs, outputs and owners, so no two agents do the same thing, and hires the roles it is missing (researcher, designer, copywriter, tester, lawyer, finance… or roles you add yourself).

**A team that checks its own work**
- Agents work in parallel and hand over results with evidence, on a shared task board with a decision log.
- Critical tasks are re-checked by an independent agent; a tester runs the code, opens pages in a browser and takes desktop and mobile screenshots.
- The boss grades every round against the scorecard and sends the work back until each MUST criterion has a documented pass, for up to three or five rounds depending on how thorough you want it.
- Calculations, tests and other mechanical steps run as plain commands instead of burning model tokens.

**Smart use of your subscriptions**
- Picks a model for every task: the strongest Claude model for the boss, Codex or Antigravity for code, Gemini for research, cheaper models for routine work, and whichever subscription has the most room left.
- When a limit runs out, work is saved; it switches to another model or continues by itself once the limit resets. A restart or a crash picks up from the last verified state.
- Tracks token usage per project, phase, role and model.

**An office you can watch and talk to**
- An animated office: agents sit at their desks while they work, stand up when they are waiting or done, and walk over to the boss's benches when they are stuck.
- Click any agent to see what it is doing in plain language, which model it uses, and to chat with it or redirect it. Change the direction of the whole project with one message to the boss.
- Finished files appear under Outputs, with a project summary written as a clear HTML page.

**A proper Mac app**
- Menu bar status, notifications when the boss asks something (answer right from the notification) or finishes, and projects keep running in the background.
- A new project lives in a normal visible folder, `~/Agent Office/<name>`, where you see every file in Finder as it is made; git only keeps a local history. A connected existing code folder keeps a separate branch and worktree so your own work is untouched. Nothing is ever pushed. Open the work in Codex or Claude Code with one click.
- Agents can use the Mac like a person: see the screen, click, type, open apps, files and links, control apps with AppleScript, search with Spotlight and use the clipboard. Everyday things they do on their own; for important ones the app asks in plain words with **Allow once / Always allow / Deny**.
- Learns as it goes: lessons about your taste are kept per project, and the autoharness plugin turns finished work into reusable skills.
- Updates itself from GitHub, in English or Czech (chosen on the setup screen), and runs on macOS 13 or newer, Apple silicon and Intel.

> Everything runs locally. The server listens only on `127.0.0.1` and nothing is sent anywhere except to the services you connect (Claude, OpenAI, Google).

---

## 1. What you need

- **macOS 13 Ventura or newer**, Apple silicon or Intel.
- Nothing else to prepare: on first launch the app installs what is missing with one click each – Node.js, Claude Code, Codex, Gemini CLI, Antigravity, the Claude Code plugins and a set of recommended skills. No Homebrew and no admin password needed.
- At least one subscription:

| Service | Account | Install |
|---|---|---|
| **Claude** (recommended, the boss) | Claude Pro or Max | `curl -fsSL https://claude.ai/install.sh \| bash` |
| **Codex** | ChatGPT Plus or Pro | `npm install -g @openai/codex` or `brew install --cask codex` |
| **Antigravity** (optional) | Google account | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` (command `agy`) |
| **Gemini** (optional, study and research) | Google account or `GEMINI_API_KEY` | `npm install -g @google/gemini-cli` or `brew install gemini-cli` |

To build the Mac app from source you also need **Node.js 20+** and the **Xcode Command Line Tools** (`xcode-select --install`) for `swiftc`.

## 2. Getting started

### Download

Get `Agent.Office.dmg` from [Releases](../../releases/latest), open it and drag Agent Office onto the Applications folder.

On first launch a setup screen shows what is installed and installs the rest on a click (**View → Set Up Tools…** opens it again later):

| | How it is installed |
|---|---|
| **Node.js** (required) | official LTS build from nodejs.org, checksum verified, into `~/Library/Application Support/Agent Office/runtime/` |
| **Claude Code** | the official installer from claude.ai |
| **Codex**, **Gemini CLI** | npm packages `@openai/codex`, `@google/gemini-cli` into `~/.local` |
| **Antigravity** | the official installer from antigravity.google |
| **Claude Code plugins** | autoharness and the official marketplace (autoharness needs Python 3.11+) |
| **Skills** | the packs in [`scripts/skill-packs.txt`](scripts/skill-packs.txt), downloaded from their authors' GitHub repositories; skills you already have are never overwritten |

Each row also shows the command to run it yourself and a link to the official page. Missing tools can be installed later from **Connections** too. The same installer works from Terminal: `bash scripts/install.sh --status`, `bash scripts/install.sh node`, `… skills` and so on.

The app is not notarized by Apple (that needs a paid developer account), so on first launch macOS blocks it, saying it cannot verify the app is free of malware. To allow it:
1. Close the message (Done / OK).
2. Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to Agent Office, then confirm with your password or Touch ID.
3. You only do this once.

Or in Terminal: `xattr -dr com.apple.quarantine "/Applications/Agent Office.app"`. The DMG window shows this command too, and you can copy it from *Terminal command.txt* next to the app.

### Build the Mac app yourself

```bash
git clone https://github.com/maxuss007/agent-office.git
cd agent-office
bash mac/build.sh
```

On the first install `mac/build.sh` runs `scripts/setup.sh`: it checks your tools and installs the plugins (autoharness, the official marketplace). You can run setup on its own; `bash scripts/setup.sh --check` only lists what is missing and installs nothing. Skip it with `AO_SKIP_SETUP=1 bash mac/build.sh`.

The script builds `Agent Office.app`, installs it in `/Applications` (or `~/Applications`) and opens it. `bash mac/build.sh --no-install` only builds it into `mac/build/`, and `bash mac/make-dmg.sh` makes the installer DMG.

The app starts its own server. It keeps its data in `~/Library/Application Support/Agent Office/` and projects in `~/Agent Office/`.

### Updates

The app watches GitHub for a new version. When there is one, the **Updates** button in the header turns orange: **Update to X.Y.Z**. Clicking it downloads only the new server and interface (a few MB) into `~/Library/Application Support/Agent Office/app/` and restarts the app. You never have to download the whole app or DMG again. If a new version fails to start, the app falls back to its own copy.

To publish a new version, run one command from the folder you develop in:

```bash
bash scripts/release.sh 1.2.0 "What's new"
```

The script bumps `version.json` and copies the app into the checkout of the public repository (`AO_SHARE_DIR`, default `../agent-office-sdileni/agent-office`). It then makes sure the copy holds nothing personal: home folder paths, your e-mail, tokens or the names of your projects. Finally it runs the tests and pushes to GitHub. If anything is off, it sends nothing. `--dmg` also publishes a new DMG on GitHub Releases, `--dry-run` only tries everything out.

If you change `mac/AgentOffice.swift`, bump `shellVersion` in it and release with `--shell`. That part cannot be swapped by an update, so the app offers a link to the new DMG (`Releases → latest`) instead.

### Server only (no app)

```bash
node server.mjs
```

Open the address it prints (`http://localhost:4747/?t=<token>`). The token is created on first start in `config.json`.

## 3. Connecting services

In the app, click **Connections** in the top right. Each service has a **How to connect** section with steps, its connection status and the limits left (5-hour and weekly).

**Claude**
1. Install Claude Code (see the table).
2. Click **Reconnect**. Terminal opens with `claude auth login`, where you sign in.
3. So the sign-in does not expire, run `claude setup-token` in Terminal and paste the token into the **Long-lived token** field. It is stored only in your Mac's Keychain.

**Codex**
1. Install Codex (see the table); the ChatGPT or Codex app for Mac also works.
2. Click **Reconnect** (`codex login`) and sign in with your ChatGPT account.

**Antigravity (optional)**
1. Install the Antigravity CLI (command `agy`, see the table).
2. Click **Reconnect**. Terminal runs `agy` and you sign in with your Google account in the browser. The sign-in is stored in the Keychain.
3. Once connected, the boss gives it programming by itself, mainly when Codex is missing or running low. You can also pick it for an agent: click the character and choose **Model**. It may edit files but not run Terminal commands.

**Gemini (optional)**: direct access to Gemini, good for study, explanations and research.
1. Install the Gemini CLI (see the table).
2. Click **Reconnect**. Terminal runs `gemini` and you sign in with your Google account, or set `GEMINI_API_KEY`.
3. Once connected, the boss gives it study and research by itself. You can also pick it for an agent.

Antigravity and Gemini are two routes to Google's models: Antigravity is an agent for code and files, the Gemini CLI is a direct chat with the model and Google search. In Connections, Antigravity is a subsection of the Gemini card.

Agent Office never stores passwords. Each service uses its own sign-in on your Mac. No Anthropic or OpenAI API keys from the environment are passed to subprocesses.

## 4. How to use it

1. On the **Projects** page click **New project**. One dialog does everything: describe what the team should do, pick the type of work and how thorough to be (each option shows how long it usually takes), optionally name the project, and press **Create and hand to the boss**. The project gets its own folder and git repository and the work starts right away; without a name the app names it from the brief. An existing folder can be connected from the same dialog.
2. Later goals for the same project go through **New brief** in the project, with the same choices. **Direct** works like a normal Claude Code or Codex session: one agent picks the model for the task itself and uses all tools (files, terminal, web, the Mac) and any fitting skill, with no research, plan or separate review. Its time estimate learns from your own direct runs (default 2–15 min).
3. The boss researches, writes criteria and a plan, splits up the tasks and has them verified. It only asks what it really needs, at most 3 questions with buttons.
4. While the team works, the project header shows progress and an estimate such as *done in about 25 min · around 14:35*; it learns from your finished projects. Follow along in the office (the **Office | Overview** switch; **+ Add role** next to it adds a team member), in the tasks and in the chat with the boss. Click a character to open the agent's details: what it does, which model it uses, a plain-language summary and a chat.
5. Results are on the right under **Outputs**; the main one is the `Project summary`. A project can be paused, stopped or accepted. The pencil next to the project name (in the header and on each project card) edits its name and description and opens the work in Codex, Claude Code or the guests in its folder. **Progress and usage** shows what the project has used so far on each connected service (tokens, runs, time, models; at API prices where the service reports it); services that are not connected are left out. Every window and side panel closes when you click outside it; nothing closes by itself.

### Mac access and permissions

On first launch the app opens **Mac access** (also in the header later). **macOS permissions** asks macOS once for **Screen Recording**, **Accessibility** and **Automation**: click **Allow** and turn on *Agent Office* in System Settings; **Full Disk Access** is optional; macOS never lists the app there by itself, so after **Allow** click **+** in System Settings and pick Agent Office (a Finder window with the app opens to drag it in). If a permission still shows *Not allowed* although the switch is on, click **Repair permission**: it clears the app's own entry so macOS asks again (it happens when the switch was turned on for an older build). **What agents may do** sets it per kind of action: **Always**, **Ask** or **Never** (opening apps and links, Spotlight search and reading web pages are *Always* by default). When an agent needs something set to *Ask*, a window explains in plain words who asks and why; **Always allow** remembers it (for example one program or one app), and **Always allowed** lists what you allowed so you can remove it. Actions that may send, delete or run something unknown are asked every time. Shell commands are judged by the programs they run, so everyday lines such as `cd app && npm test | tail` run without asking, and **Always allow** on an unknown program also covers it inside longer commands. Every agent gets the installed skills that fit its position (research, testing, design, code, writing, marketing, finance, sales, legal), on top of the ones the boss picks. An unanswered question waits 5 minutes, then the agent carries on without that action. A project keeps going until you pause or stop it: after an error it retries by itself (1, 2, 5, 10, 15, then every 30 minutes), a lost internet connection is waited out, a used-up run budget is extended, and an unfinished result gets another round as long as rounds still improve it. After a restart of the app or the Mac it continues by itself; the app adds itself to Login Items once for that (remove it there if you do not want it). Projects created before this version have their outputs copied once from the hidden working copy into the visible folder (nothing is overwritten).

## 5. How the orchestration works

- **"Done" means verified must-have criteria.** Before the work the boss writes `SCORECARD.md` (MUST/SHOULD/NICE). It is done only when every MUST has a documented PASS. Otherwise the project is *In progress* with a list of gaps.
- **Task board** (`office/BOARD.md`) with locks, **handoffs with evidence** (`office/handoffs/`), **decision log** (`office/DECISIONS.md`).
- **Resuming:** after an error, a restart or a used-up limit, work continues from the last verified state.
- **Saving tokens:** every agent gets only the tools and skills its task needs. Calculations and tests run as commands without a model, and code assembles the final report.
- **Usage:** every call is logged in `projects/<id>/attempts.jsonl`. The table is under **Progress and usage**.
- **Safety:** nothing is pushed. Projects created by the app work in their own folder; connected existing repositories get their own branch `office/<id>` in a separate worktree. Common, safe programs run without asking (git, node, python, file tools, ffmpeg, sips…); anything else is asked about in the app. Passwords and the keychain, `sudo`, wiping the disk, changes to macOS security and `git push` are never allowed, whatever the answer.

The boss's instructions are in `boss.md`, roles in `roles/*.md`, shared rules in `roles/_contract.md` and presets in `presets/`.

## 6. Skills and autoharness

- Agents (Claude and Codex) may use your installed skills. Codex reads `~/.agents/skills`; Agent Office symlinks the skills from `~/.claude/skills` there and deletes nothing.
- The boss sees the catalog of skills and plugins and assigns them to tasks. It can install official plugins by itself, community ones only after you confirm.
- The **autoharness** plugin learns new skills from finished work. `scripts/setup.sh` installs it, or by hand:
  ```bash
  claude plugin marketplace add tigerless-labs/autoharness
  claude plugin install autoharness@autoharness --scope user
  ```
  It needs Python 3.11+ as `python3`.
- The boss installs plugins from the official `anthropics/claude-plugins-official` marketplace by itself; `scripts/setup.sh` adds it too.
- `.claude/skills/` holds skills for developing the app itself (scene, UI, limits, reinstalling). Claude Code uses them when you work on this repository.

## 7. The office and its art

The scene is in `public/office-suits.js`, the art in `public/assets/suits/`:
- `office.png`: the office (Harvey's room with guest benches, Donna's reception, 24 desks),
- `stand/` and `walk/`: standing characters and two walking frames,
- `seat/`: characters sitting at a desk with their backs to us,
- `front/`: Harvey and Donna sitting facing us (idle, asking, typing),
- `face/`: face crops for the team list.

Whoever is working sits at a desk. Whoever is idle, waiting or done stands by their chair. Whoever is stuck walks over to Harvey and sits on a bench. The characters are inspired by the TV series Suits.

## 8. Development

```bash
node --test tests/          # tests (use fake CLIs, no subscription usage)
```

Structure: `server.mjs` (HTTP + SSE) · `public/i18n.js` (English and Czech in the interface) · `updater.mjs` (updates from GitHub, `version.json`) · `orchestrator.mjs` (boss, plan, tasks, verification) · `providers.mjs` (Claude, Codex, Antigravity, Gemini, limits, model choice) · `report.mjs` (HTML outputs) · `public/` (UI) · `mac/` (Mac app).

The interface source is written in Czech; `public/i18n.js` translates what is on screen into English. To add a string, put the Czech text exactly as it appears as a key in its `EN` table.

### Optional

- **Phone:** `HOST=0.0.0.0 node server.mjs` prints an address for a phone on the same Wi-Fi. The token in the link is the only protection, so never expose the port to the internet.
- **Push notifications via ntfy:** add `{ "ntfyTopic": "your-secret-topic" }` to `config.json`. The boss's questions then go through the public ntfy.sh service.

## 9. Thanks

Agent Office is built on other people's work. Thank you:

**Tools it runs on**
- [Claude Code](https://claude.com/claude-code) and the [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) marketplace by Anthropic.
- [Codex](https://github.com/openai/codex) by OpenAI.
- [Antigravity](https://antigravity.google) and the [Gemini CLI](https://github.com/google-gemini/gemini-cli) by Google.
- [autoharness](https://github.com/tigerless-labs/autoharness) by Tigerless Labs: a plugin that learns new skills from finished work (the skills in `.claude/skills/` came from it).
- [Skills CLI](https://github.com/vercel-labs/skills) by Vercel Labs for finding and installing skills.

**Skills the agents like to work with** (not part of this repository; the setup screen installs them from these repositories, see `scripts/skill-packs.txt`)
- SEO and ads: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) and [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads).
- UI/UX, design, brand and slides: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
- Design engineering and animation: [emilkowalski/skill](https://github.com/emilkowalski/skill) by Emil Kowalski.
- Marketing: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) by Corey Haines.
- Visibility in AI search: [Knowatoa/ai-visibility-skills](https://github.com/Knowatoa/ai-visibility-skills).
- Model council: [karpathy/llm-council](https://github.com/karpathy/llm-council) by Andrej Karpathy, as a skill based on [aiwithremy/claude-skills-llm-council](https://github.com/aiwithremy/claude-skills-llm-council).
- Coding guidelines: [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills). Finding more skills: [vercel-labs/skills](https://github.com/vercel-labs/skills).

**Art**
- The characters are a fan tribute to the TV series *Suits* (created by Aaron Korsh, USA Network). The project is not affiliated with the show's makers; the names and likenesses belong to their owners.
- The office and characters were generated with Codex.

If someone is missing or credited wrongly, please open an issue.
