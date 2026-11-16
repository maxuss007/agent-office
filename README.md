# Agent Office

*[Česká verze](README.cs.md)*

An office of AI agents on your Mac. Give the boss a goal and it builds a team (research, design, copy, review…), splits up the work, has it verified and hands back a finished result as clear HTML pages. It runs on your **subscriptions** to Claude and ChatGPT (Codex), optionally also Google Antigravity and Gemini. No API keys needed.

- The boss (Harvey) runs on the strongest Claude model available and picks a model for every other agent by task and by which subscription has the most room left.
- The office is an animated scene: agents sit at their desks, walk over to the boss with questions and so on. Next to it are the chat with the boss, tasks and outputs.
- When a limit runs out, work is saved and continues by itself once the limit resets.
- The interface is in English or Czech: the **EN | CS** switch in the top right. The boss talks to you in the same language.

> Everything runs locally. The server listens only on `127.0.0.1` and nothing is sent anywhere except to the services you connect (Claude, OpenAI, Google).

---

## 1. What you need

- **macOS 13 Ventura or newer**, Apple silicon or Intel (the server alone runs anywhere Node does).
- **Node.js 20+** (`brew install node`).
- At least one service:

| Service | Account | Install |
|---|---|---|
| **Claude** (recommended, the boss) | Claude Pro or Max | `curl -fsSL https://claude.ai/install.sh \| bash` |
| **Codex** | ChatGPT Plus or Pro | `npm install -g @openai/codex` or `brew install --cask codex` |
| **Antigravity** (optional) | Google account | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` (command `agy`) |
| **Gemini** (optional, study and research) | Google account or `GEMINI_API_KEY` | `npm install -g @google/gemini-cli` or `brew install gemini-cli` |

To build the Mac app you also need the **Xcode Command Line Tools** (`xcode-select --install`) for `swiftc`.

## 2. Getting started

### Download

Get `Agent.Office.dmg` from [Releases](../../releases/latest), open it and drag Agent Office onto the Applications folder. On first launch the app checks your tools and installs the plugins it needs (the same as `scripts/setup.sh`). If something is missing, it tells you what and how to install it.

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

1. On the **Projects** page click **New project** (creates a folder and a git repository) or connect an existing folder.
2. In the project, write the boss a goal. **New goal** offers the type of work, how thorough to be and room for materials.
3. The boss researches, writes criteria and a plan, splits up the tasks and has them verified. It only asks what it really needs, at most 3 questions with buttons.
4. Follow along in the office (the **Office | Team** switch), in the tasks and in the chat with the boss. Click a character to open the agent's details: what it does, which model it uses, a plain-language summary and a chat.
5. Results are on the right under **Outputs**; the main one is the `Project summary`. A project can be paused, stopped, accepted or opened in Codex or Claude Code.

## 5. How the orchestration works

- **"Done" means verified must-have criteria.** Before the work the boss writes `SCORECARD.md` (MUST/SHOULD/NICE). It is done only when every MUST has a documented PASS. Otherwise the project is *In progress* with a list of gaps.
- **Task board** (`office/BOARD.md`) with locks, **handoffs with evidence** (`office/handoffs/`), **decision log** (`office/DECISIONS.md`).
- **Resuming:** after an error, a restart or a used-up limit, work continues from the last verified state.
- **Saving tokens:** every agent gets only the tools and skills its task needs. Calculations and tests run as commands without a model, and code assembles the final report.
- **Usage:** every call is logged in `projects/<id>/attempts.jsonl`. The table is under **Progress and usage**.
- **Safety:** work happens on its own git branch `office/<id>` in a separate worktree, nothing is pushed, and agents only get Bash through an allowlist.

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

**Skills the agents like to work with** (not part of this repository, installed separately)
- SEO and ads: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) and [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads).
- Design, brand and slides: ClaudeKit (`design`, `brand`, `design-system`, `ui-styling`, `banner-design`, `slides`).
- Design and animation: the principles of [Emil Kowalski](https://emilkowal.ski).
- Marketing: skills drawing among others on *Founding Marketing* by Corey Haines.
- Visibility in AI search: [Knowatoa/ai-visibility-skills](https://github.com/Knowatoa/ai-visibility-skills).
- Model council: [karpathy/llm-council](https://github.com/karpathy/llm-council) by Andrej Karpathy, as a skill based on [aiwithremy/claude-skills-llm-council](https://github.com/aiwithremy/claude-skills-llm-council).
- Blender: blender-agent-skills. BIM and Bonsai: [OpenAEC Foundation](https://github.com/OpenAEC-Foundation). ArchiCAD: weltmaister.

**Art**
- The characters are a fan tribute to the TV series *Suits* (created by Aaron Korsh, USA Network). The project is not affiliated with the show's makers; the names and likenesses belong to their owners.
- The office and characters were generated with Codex.

If someone is missing or credited wrongly, please open an issue.
